# Cloud Run で動く podcast-ui 本体と、そのデプロイ基盤。
# イメージのビルド・デプロイは GitHub Actions（.github/workflows/）が行い、
# ここではサービス定義・レジストリを管理する。API 有効化は
# google_project_service.required（locals.required_services）に集約している。

resource "google_artifact_registry_repository" "sparkcast_ui" {
  project       = var.project_id
  location      = var.region
  repository_id = local.ui_name_prefix
  format        = "DOCKER"
  description   = "podcast-ui のアプリイメージ"

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "sparkcast_ui" {
  project  = var.project_id
  location = var.region
  name     = "${local.ui_name_prefix}-${var.environment}"
  ingress  = "INGRESS_TRAFFIC_ALL"

  # provider の既定は true。他の Cloud Run リソース（job.tf / agenda.tf / promoter.tf /
  # backup.tf / workflows.tf）と同様に false を明示する。true のままだと改名などの
  # replace が「cannot destroy service without setting deletion_protection=false」で
  # 失敗する（#72 Stage 7 で実際に発生）。
  deletion_protection = false

  template {
    service_account = google_service_account.app.email

    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    containers {
      # 初回 apply 用のプレースホルダ。実イメージは GitHub Actions がデプロイする。
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      # Supabase(Postgres) へ DATABASE_URL で接続する。
      # CLOUD_SQL_INSTANCE_CONNECTION_NAME を渡さないことで db-pool.ts の
      # DATABASE_URL 経路（discrete params + SSL）に載る。
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "GCS_UPLOAD_BUCKET"
        value = google_storage_bucket.input.name
      }
      env {
        name  = "GCS_SIGNED_URL_TTL_SECONDS"
        value = "900"
      }
      env {
        name = "CRON_SECRET"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.cron_secret.secret_id
            version = "latest"
          }
        }
      }
      dynamic "env" {
        for_each = var.enable_guest_mode ? [1] : []
        content {
          name  = "ENABLE_GUEST_MODE"
          value = "true"
        }
      }
      dynamic "env" {
        for_each = var.rate_limit_daily != "" ? [1] : []
        content {
          name  = "RATE_LIMIT_DAILY"
          value = var.rate_limit_daily
        }
      }
      dynamic "env" {
        for_each = var.rate_limit_hourly != "" ? [1] : []
        content {
          name  = "RATE_LIMIT_HOURLY"
          value = var.rate_limit_hourly
        }
      }
    }
  }

  # デプロイ（イメージ更新・リビジョン名・タグ付きプレビュー・トラフィック）は
  # GitHub Actions（gcloud）が行うため、terraform は初期作成のみ担い以降は無視する。
  # provider の default_labels 由来のサービスラベル更新も、gcloud 管理サービスへの
  # 不要な PATCH（リビジョン運用と競合し得る）を避けるため無視する。
  lifecycle {
    ignore_changes = [
      # ⚠️ #72 Stage 7 のあいだだけ template[0].containers[0].image も外している。
      # Artifact Registry を作り直した結果、state が持つイメージ
      # （.../podcast-ui/podcast-ui:<sha>）が実在しなくなり、ignore したまま TF が
      # それを再送して "Image not found" で更新に失敗した。外すと上のプレースホルダ
      # （cloudrun/container/hello）が適用され、サービス定義を収束させられる。
      # 実イメージは CD の gcloud run deploy が配信するので、改名完了後に必ず戻すこと。
      # 戻し忘れると infra apply のたびにアプリがプレースホルダへ巻き戻る。
      # template[0].containers[0].image,
      # ⚠️ #72 Stage 7 の 2 段階 apply のあいだだけ template[0].revision を外している。
      # ignore_changes に入れておくと gcloud が付けたリビジョン名が state に取り込まれ、
      # TF が env を変更する際に「同名リビジョンを別 config で再送」して 409 になる
      # （#90 Stage 2 と同じ罠）。外すと revision は空＝Cloud Run が自動採番するため衝突しない。
      # サービス改名が完了したら元に戻すこと。
      # template[0].revision,
      template[0].labels,
      template[0].annotations,
      # default_labels によるサービスラベル更新を抑止（gcloud 管理サービスへの不要 PATCH 回避）。
      # 「redundant」警告が出ても labels だけでは default_labels を止められないため両者を無視する。
      labels,
      terraform_labels,
      effective_labels,
      annotations,
      traffic,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.app_secrets,
  ]
}

# 管理画面はアプリ側の Firebase Auth で保護するため、HTTP は公開する。
#
# ⚠️ 一時的に state から切り離している（#72 Stage 7）。
#
# サービス改名は allUsers バインディングの replace を伴うが、旧サービスからの
# destroy に必要な run.services.setIamPolicy を共有デプロイ SA が持っていなかった。
# 権限付与（ui_github_actions.tf の shared_deployer_run_admin）を同じ plan に入れても、
# Terraform は destroy の 403 で新しい操作のスケジュールを止めるため、付与の create まで
# 到達せず永久に解消しない状態だった。
#
# そこで removed ブロックで「API を呼ばずに state から外す」ことで失敗する destroy を
# plan から消し、権限付与とサービス改名を通す。旧バインディングは旧サービスごと削除される。
# 次の PR でこの removed を消してリソース定義を復活させ、新サービスに付与し直す。
removed {
  from = google_cloud_run_v2_service_iam_member.public

  lifecycle {
    destroy = false
  }
}

output "cloud_run_uri" {
  description = "Cloud Run サービスの URL"
  value       = google_cloud_run_v2_service.sparkcast_ui.uri
}

# 組織のドメイン制限共有ポリシーの下では allUsers への権限付与ができないため、
# この プロジェクトに限り制限を解除する（公開 Web アプリの要件）。
resource "google_org_policy_policy" "allowed_policy_member_domains" {
  name   = "projects/${var.project_id}/policies/iam.allowedPolicyMemberDomains"
  parent = "projects/${var.project_id}"

  spec {
    inherit_from_parent = false

    rules {
      allow_all = "TRUE"
    }
  }

  depends_on = [google_project_service.required]
}

# db-backup: 日次で DB(Supabase) を pg_dump し GCS に保存する（#90 Stage 4）。
#
# 背景: Supabase 無料枠には自動バックアップが無い。Cloud SQL 廃止(Stage 5)後は
# Supabase が唯一のデータ所在になるため、その前提として自前バックアップを用意する。
#
# 設計方針（promoter と同じ）:
# - app job と同一イメージ(local.app_image_uri)を参照（Docker build の追加なし）
# - command で ENTRYPOINT を override し backup_main を実行
# - DATABASE_URL は既存の Supabase secret(var.database_url_secret_name)を注入
# - Cloud Scheduler から日次起動

resource "google_storage_bucket" "db_backup" {
  name     = lower("${local.automator_name_prefix}-db-backup-${var.environment}")
  location = var.region

  uniform_bucket_level_access = true
  # バックアップ保護のため誤削除を防ぐ（中身があると destroy できない）。
  # 既定は false。#72 のリネームでバケットを作り直す環境だけ true にする
  # （dev のダンプは開発データのため破棄可。prod は false のまま rsync で移送する）。
  force_destroy = var.backup_bucket_force_destroy

  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }
}

# バックアップジョブ(compute SA)がダンプを書き込むための権限。
resource "google_storage_bucket_iam_member" "db_backup_writer" {
  bucket = google_storage_bucket.db_backup.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.default_compute_service_account}"
}

resource "google_cloud_run_v2_job" "db_backup" {
  name                = "${local.automator_name_prefix}-db-backup-${var.environment}"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = local.default_compute_service_account
      timeout         = "600s"

      containers {
        image = local.app_image_uri

        # ENTRYPOINT を override して backup_main を実行
        command = ["python", "-m", "backup_main"]

        resources {
          limits = {
            memory = "512Mi"
            cpu    = "1"
          }
        }

        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "BACKUP_BUCKET"
          value = google_storage_bucket.db_backup.name
        }

        # 移行先(Supabase)の DATABASE_URL。Stage 2/3 で切替済みの secret を参照。
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.database_url_secret_name
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    module.cloud_run_job,
    google_project_service.required,
    google_storage_bucket_iam_member.db_backup_writer,
  ]
}

# Cloud Scheduler: 日次（デフォルト 03:00 JST）
resource "google_cloud_scheduler_job" "db_backup" {
  name             = "${local.automator_name_prefix}-db-backup-${var.environment}"
  description      = "Daily pg_dump of the database to GCS"
  schedule         = var.backup_scheduler_cron
  time_zone        = "Asia/Tokyo"
  attempt_deadline = "320s"
  region           = var.region

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.db_backup.name}:run"

    oauth_token {
      service_account_email = local.default_compute_service_account
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  depends_on = [
    google_cloud_run_v2_job.db_backup,
    google_project_service.required,
    google_service_account_iam_member.cloud_scheduler_sa_token_creator,
  ]
}

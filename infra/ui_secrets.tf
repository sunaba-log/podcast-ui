# sparkcast-ui アプリが参照するシークレットの権限付与。
# cron トークン・DATABASE_URL とも別管理のシークレットを data source で参照する。
#
# DB パスワードの secret は Cloud SQL 撤去（#90 Stage 5）で廃止した。
# prod ではこの secret 自体が cloud_sql.tf の管理下にあり、削除すると
# data 参照が解決できなくなるため、同時に外している。

data "google_secret_manager_secret" "cron_secret" {
  project   = var.project_id
  secret_id = var.cron_secret_id
}

# 移行先 DB（Supabase）の DATABASE_URL。値は手動管理（cloud_sql.tf での生成を廃止）。
data "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = var.database_url_secret_name
}

resource "google_secret_manager_secret_iam_member" "app_secrets" {
  for_each = {
    cron_secret  = data.google_secret_manager_secret.cron_secret.secret_id
    database_url = data.google_secret_manager_secret.database_url.secret_id
  }

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

# CD / PR プレビューの DB マイグレーション（apps/ui/scripts/migrate.ts）は
# github-actions-deployer が DATABASE_URL を読んで実行する（#120）。
# 同 SA 自体は dev-platform/infra 管理のため、ここでは secret への参照権限のみ付与する。
resource "google_secret_manager_secret_iam_member" "deployer_database_url" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:github-actions-deployer@${var.project_id}.iam.gserviceaccount.com"
}

# 鍵なし（ADC）で GCS V4 署名付きURLを発行するには、SA 自身への signBlob 権限が必要。
resource "google_service_account_iam_member" "app_self_token_creator" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.app.email}"
}

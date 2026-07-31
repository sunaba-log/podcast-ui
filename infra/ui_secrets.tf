# podcast-ui アプリが参照するシークレットの権限付与。
# DB パスワード・cron トークンとも手動 or 別管理のシークレットを data source で参照する
# （DB パスワードを直接参照化しない理由は variables.tf の db_password_secret_id を参照）。

data "google_secret_manager_secret" "db_password" {
  project   = var.project_id
  secret_id = var.db_password_secret_id
}

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
    db_password  = data.google_secret_manager_secret.db_password.secret_id
    cron_secret  = data.google_secret_manager_secret.cron_secret.secret_id
    database_url = data.google_secret_manager_secret.database_url.secret_id
  }

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

# 鍵なし（ADC）で GCS V4 署名付きURLを発行するには、SA 自身への signBlob 権限が必要。
resource "google_service_account_iam_member" "app_self_token_creator" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.app.email}"
}

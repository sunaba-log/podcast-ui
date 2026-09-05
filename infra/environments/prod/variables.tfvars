environment = "prod"
# provider の default_labels 用のシステム名（実リソース名の接頭辞ではない）。#72 Stage 1
system     = "sparkcast"
project_id = "sunabalog-prod"

# ⚠️ #72 Stage 5/6 の 1 段階目。force_destroy は destroy 時に state 側の値が読まれるため、
# 「true 化」と「改名」を同一 apply で行うと destroy が失敗する（dev で実際に踏んだ）。
# 先にフラグだけを state に入れ、次のリリースで接頭辞を切り替えて改名する。
# 入力バケットは gcs_retention_days = 30 の一時領域、バックアップは改名後に
# 日次ジョブが作り直す。改名完了後、gcs_force_destroy は false に戻すこと。
gcs_force_destroy           = true
backup_bucket_force_destroy = true

gcs_retention_days = 30
gcs_cors_origins = [
  "https://sparkcast.sunabalog.com",
]
discord_webhook_info_secret_name   = "discord-webhook-url-prod-info"
discord_webhook_error_secret_name  = "discord-webhook-url-prod-error"
discord_webhook_agenda_secret_name = "discord-webhook-url-prod-agenda"
cloudflare_account_id              = "8ed20f6872cea7c9219d68bfcf5f98ae"
cloudflare_zone_name               = "sunabalog.com"
r2_bucket_name                     = "podcast"
r2_subdomain                       = "podcast"
podcast_id                         = "1"
database_url_secret_name           = "supabase-database-url-prod"
cloud_sql_tier                     = "db-f1-micro"
enable_promoter                    = true
manage_firestore_database          = true
budget_amount_jpy                  = 10000

# podcast-ui（Cloud Run Service）
app_service_account_id           = "podcast-ui-prod"
app_service_account_display_name = "Podcast UI prod"
custom_domain                    = "sparkcast.sunabalog.com"
# prod の live サービスは automator と共有の既存シークレットを参照している
db_password_secret_id = "podcast-automator-database-password-prod"
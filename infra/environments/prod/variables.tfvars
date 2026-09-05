environment = "prod"
# provider の default_labels 用のシステム名（実リソース名の接頭辞ではない）。#72 Stage 1
system     = "sparkcast"
project_id = "sunabalog-prod"

# #72 のリネームは完了。誤削除を防ぐため force_destroy は false に戻す。
gcs_force_destroy           = false
backup_bucket_force_destroy = false

# #72 Stage 2-6: automator 系の実リソース名を sparkcast 系へ。
# GCS 入力バケット / バックアップバケット / Cloud Run Job / Scheduler /
# Workflows / Eventarc / Artifact Registry が対象。
automator_name_prefix = "sparkcast-automator"
# #72 Stage 7: Cloud Run Service / Artifact Registry / Scheduler を sparkcast 名へ。
# deletion_protection = false は #147 の apply で既に state に入っている。
ui_name_prefix = "sparkcast-ui"

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
enable_promoter                    = true
manage_firestore_database          = true
budget_amount_jpy                  = 10000

# sparkcast-ui（Cloud Run Service）
# #72 Stage 8: アプリ実行 SA を sparkcast 名へ。SA は再作成となり、
# ui_iam.tf / ui_secrets.tf / ui_github_actions.tf の binding が全て貼り直される。
app_service_account_id           = "sparkcast-ui-prod"
app_service_account_display_name = "SparkCast UI prod"
custom_domain                    = "sparkcast.sunabalog.com"

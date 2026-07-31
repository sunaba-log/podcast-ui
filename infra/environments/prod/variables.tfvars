environment        = "prod"
system             = "podcast-automator"
project_id         = "sunabalog-prod"
gcs_force_destroy  = false
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
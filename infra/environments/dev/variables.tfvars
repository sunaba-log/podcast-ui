environment        = "dev"
system             = "podcast-automator"
project_id         = "sunabalog-dev"
gcs_force_destroy  = true
gcs_retention_days = 3
gcs_cors_origins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "https://dev.sparkcast.sunabalog.com",
]
discord_webhook_info_secret_name   = "discord-webhook-url-dev-info"
discord_webhook_error_secret_name  = "discord-webhook-url-dev-error"
discord_webhook_agenda_secret_name = "discord-webhook-url-dev-agenda"
discord_bot_token_secret_name      = "discord-bot-token-dev"
discord_transcript_channel_id      = "1452839882320908359"
podcast_id                         = "1"
database_url_secret_name           = "supabase-database-url-dev"
cloudflare_account_id              = "8ed20f6872cea7c9219d68bfcf5f98ae"
cloudflare_zone_name               = "sunabalog.com"
r2_bucket_name                     = "podcast-dev"
r2_subdomain                       = "dev.podcast"
enable_promoter                    = false
manage_firestore_database          = false
budget_amount_jpy                  = 5000

# podcast-ui（Cloud Run Service）
app_service_account_id           = "podcast-ui-dev"
app_service_account_display_name = "Podcast UI dev"
custom_domain                    = "dev.sparkcast.sunabalog.com"
enable_guest_mode                = true
rate_limit_daily                 = "500"
rate_limit_hourly                = "100"
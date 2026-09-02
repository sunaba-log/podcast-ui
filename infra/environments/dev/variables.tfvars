environment = "dev"
# provider の default_labels 用のシステム名（実リソース名の接頭辞ではない）。#72 Stage 1
system            = "sparkcast"
project_id        = "sunabalog-dev"
gcs_force_destroy = true
# #72 Stage 6: バケット改名で作り直すため dev のみ true（ダンプは開発データ）
backup_bucket_force_destroy = true
# #72 Stage 6 の 2 段階 apply。まず旧名のまま force_destroy を true にする。
# この apply が通ったら次の PR でこの行を削除して改名する。
backup_bucket_name_override = "podcast-automator-db-backup-dev"

# 実リソース名の接頭辞（#72）
automator_name_prefix = "sparkcast-automator"
ui_name_prefix        = "sparkcast-ui"
gcs_retention_days    = 3
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
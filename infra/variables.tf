variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, prod)."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be one of: dev, prod."
  }
}

variable "system" {
  type        = string
  description = "System name for default labels."
}

variable "org" {
  type        = string
  description = "Organization name for default labels."
  default     = "sunabalog"
}

variable "project_id" {
  type        = string
  description = "Google Cloud project ID."
}

variable "region" {
  type        = string
  description = "Default region for resources that require it."
  default     = "asia-northeast1"
}

variable "gcs_retention_days" {
  type        = number
  description = "Days to retain input audio objects before deletion. Omit or set null to disable lifecycle deletion."
  default     = null

  validation {
    condition     = var.gcs_retention_days == null || var.gcs_retention_days > 0
    error_message = "gcs_retention_days must be null (disabled) or a positive number."
  }
}

variable "gcs_force_destroy" {
  type        = bool
  description = "Allow Terraform to delete the input bucket even if it contains objects."
  default     = false
}

variable "gcs_cors_origins" {
  type        = list(string)
  description = "Browser origins allowed to upload MP3 files directly."
}


variable "discord_webhook_info_secret_name" {
  type        = string
  description = "Secret Manager secret name for Discord info webhook URL."
}

variable "discord_webhook_error_secret_name" {
  type        = string
  description = "Secret Manager secret name for Discord error webhook URL."
}

variable "cloudflare_access_key_id_secret_name" {
  type        = string
  description = "Secret Manager secret name for Cloudflare R2 access key id."
  default     = "cloudflare-access-key-id"
}

variable "cloudflare_secret_access_key_secret_name" {
  type        = string
  description = "Secret Manager secret name for Cloudflare R2 secret access key."
  default     = "cloudflare-secret-access-key"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the R2 bucket."
}

variable "cloudflare_zone_name" {
  type        = string
  description = "Cloudflare zone name (e.g., example.com) for the custom domain."
}

variable "r2_bucket_name" {
  type        = string
  description = "Cloudflare R2 bucket name for podcast assets."
}

variable "r2_key_prefix" {
  type        = string
  description = "Key prefix in the R2 bucket for uploaded files (empty for root)."
  default     = "sunabalog"
}

variable "r2_subdomain" {
  type        = string
  description = "Subdomain part for the custom domain (e.g., dev.podcast)."
}

variable "discord_webhook_agenda_secret_name" {
  type        = string
  description = "Secret Manager secret name for Discord agenda webhook URL."
}

variable "discord_bot_token_secret_name" {
  type        = string
  description = "Secret Manager secret name for Discord Bot Token (read-only, used for transcript channel access). Empty string disables the env injection."
  default     = ""
}

variable "discord_transcript_channel_id" {
  type        = string
  description = "Discord channel ID for meeting transcripts. Empty string disables transcript fetch and preserves fallback path."
  default     = ""
}

variable "podcast_id" {
  type        = string
  description = "Firestore podcast document ID. Injected as PODCAST_ID into the Cloud Run job."
}

variable "database_url_secret_name" {
  type        = string
  description = "Secret Manager secret containing the PostgreSQL DATABASE_URL."
}

variable "cloud_sql_tier" {
  type        = string
  description = "Cloud SQL machine tier."
  default     = "db-f1-micro"
}

variable "cloud_sql_availability_type" {
  type        = string
  description = "Cloud SQL availability type (ZONAL or REGIONAL/HA). Shared-core tiers (db-f1-micro) are not compatible with REGIONAL."
  default     = "ZONAL"
}

variable "cloud_sql_database_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "podcast"
}

variable "cloud_sql_database_user" {
  type        = string
  description = "PostgreSQL application user."
  default     = "podcast_app"
}

variable "sns_schedule_offset_hours" {
  type        = number
  description = "Hours after episode processing to schedule the first SNS promotion. Default 1 hour."
  default     = 1
}

variable "manage_firestore_database" {
  type        = bool
  description = "Whether this Terraform stack creates and manages the default Firestore database."
  default     = false
}

variable "enable_promoter" {
  type        = bool
  description = "Whether to deploy the X auto-posting Cloud Run Job and Scheduler. Requires X API secrets to exist."
  default     = false
}

variable "x_api_key_secret_name" {
  type        = string
  description = "Secret Manager secret name for X API Key (Consumer Key)."
  default     = "x-api-key"
}

variable "x_api_secret_secret_name" {
  type        = string
  description = "Secret Manager secret name for X API Secret (Consumer Secret)."
  default     = "x-api-secret"
}

variable "x_access_token_secret_name" {
  type        = string
  description = "Secret Manager secret name for X Access Token."
  default     = "x-access-token"
}

variable "x_access_token_secret_secret_name" {
  type        = string
  description = "Secret Manager secret name for X Access Token Secret."
  default     = "x-access-token-secret"
}

variable "promoter_scheduler_cron" {
  type        = string
  description = "Execution frequency of the promoter (cron format)."
  default     = "0 * * * *"
}

# ---------------------------------------------------------------------------
# podcast-ui（旧 ui/infra）由来の変数。Cloud Run Service まわり。
# upload_bucket / cloud_sql_instance_connection_name / db_password_secret_id /
# db_name / db_user は同一 state 内のリソース直接参照に置換したため変数から削除した。
# ---------------------------------------------------------------------------
variable "app_service_account_id" {
  type        = string
  description = "podcast-ui アプリ実行用サービスアカウントの account_id"
}

variable "app_service_account_display_name" {
  type        = string
  description = "アプリ実行用サービスアカウントの表示名"
}

variable "cron_secret_id" {
  type        = string
  description = "cron エンドポイント保護用トークンの Secret Manager シークレット ID"
  default     = "cron-secret"
}

# Cloud Run サービスは gcloud（cd の ui デプロイ）がリビジョンを管理するため、
# TF が template（env）を変更するとリビジョン名衝突で失敗する。DB パスワードの
# 参照シークレットは live と一致させる必要があるため直接参照化せず変数で保持する
# （dev=db-password / prod=automator 管理シークレット）。
variable "db_password_secret_id" {
  type        = string
  description = "DB 接続パスワードを保持する Secret Manager シークレット ID"
  default     = "db-password"
}

variable "custom_domain" {
  type        = string
  description = "Cloud Run に割り当てるカスタムドメイン（例: dev.sparkcast.sunabalog.com）"
}

variable "billing_account_id" {
  type        = string
  description = "Cloud Billing account ID that funds this project (dev / prod 共通)."
  default     = "018558-5DAE46-0B8F06"
}

variable "budget_amount_jpy" {
  type        = number
  description = "Monthly budget amount in JPY for the project budget alert."

  validation {
    condition     = var.budget_amount_jpy > 0
    error_message = "budget_amount_jpy must be a positive number."
  }
}

variable "enable_guest_mode" {
  type        = bool
  description = "ゲストログイン（「ゲストとして試す」）機能の有効化フラグ（dev のみ true とする）"
  default     = false
}

variable "rate_limit_daily" {
  type        = string
  description = "1日あたりのレート制限回数"
  default     = ""
}

variable "rate_limit_hourly" {
  type        = string
  description = "1時間あたりのレート制限回数"
  default     = ""
}

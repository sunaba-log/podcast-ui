# podcast-ui の定期実行ジョブ（宛先は Cloud Run のアプリ）。
# cloudscheduler.googleapis.com は google_project_service.required に集約。

# アプリ側の検証と同じ Bearer トークンを Scheduler のヘッダに設定する。
data "google_secret_manager_secret_version" "cron_secret" {
  project = var.project_id
  secret  = data.google_secret_manager_secret.cron_secret.secret_id
}

locals {
  app_base_url = google_cloud_run_v2_service.sparkcast_ui.uri
}

resource "google_cloud_scheduler_job" "cleanup_uploads" {
  project          = var.project_id
  region           = var.region
  name             = "podcast-ui-cleanup-uploads"
  description      = "Triggers Next.js cleanup-uploads api endpoint"
  schedule         = "0 3 * * *"
  time_zone        = "Asia/Tokyo"
  attempt_deadline = "320s"

  http_target {
    http_method = "GET"
    uri         = "${local.app_base_url}/api/cron/cleanup-uploads"
    headers = {
      Authorization = "Bearer ${data.google_secret_manager_secret_version.cron_secret.secret_data}"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_scheduler_job" "reindex_minutes" {
  project          = var.project_id
  region           = var.region
  name             = "podcast-ui-reindex-minutes"
  description      = "Triggers Next.js reindex-minutes api endpoint"
  schedule         = "0 4 * * *"
  time_zone        = "Asia/Tokyo"
  attempt_deadline = "320s"

  http_target {
    http_method = "GET"
    uri         = "${local.app_base_url}/api/cron/reindex-minutes"
    headers = {
      Authorization = "Bearer ${data.google_secret_manager_secret_version.cron_secret.secret_data}"
    }
  }

  depends_on = [google_project_service.required]
}

output "sparkcast_ui_service_account_email" {
  description = "Service account used by the sparkcast ui (Cloud Run Service) runtime."
  value       = google_service_account.app.email
}

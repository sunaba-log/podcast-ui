# Cloud Run のカスタムドメインマッピング（#52 で手動作成した分を IaC 化）。
#   dev  : dev.sparkcast.sunabalog.com → podcast-ui-dev
#   prod : sparkcast.sunabalog.com     → podcast-ui-prod
# ドメイン所有権の確認・DNS レコード（Cloudflare）・Firebase 承認済みドメインは
# Terraform 管理外（手動 / 別管理）。
resource "google_cloud_run_domain_mapping" "app" {
  project  = var.project_id
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.sparkcast_ui.name
  }

  # 手動作成分を import したため、証明書モード（既定 AUTOMATIC で ForceNew になる）と
  # サーバー付与のメタデータは無視し、不要な再作成・差分を防ぐ。
  # provider の default_labels（org/environment/system）はドメインマッピングでは
  # effective_labels/terraform_labels 経由で ForceNew になり再作成＝一時断を招くため無視する。
  lifecycle {
    ignore_changes = [
      spec[0].certificate_mode,
      metadata[0].annotations,
      metadata[0].labels,
      # default_labels が effective_labels/terraform_labels 経由で ForceNew を起こすため、
      # 「redundant」警告が出ても両者を明示的に無視する必要がある（labels だけでは不十分）。
      metadata[0].effective_labels,
      metadata[0].terraform_labels,
    ]
  }
}

output "custom_domain" {
  description = "割り当てたカスタムドメイン"
  value       = google_cloud_run_domain_mapping.app.name
}

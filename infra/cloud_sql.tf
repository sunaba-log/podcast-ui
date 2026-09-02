# ⚠️ Cloud SQL は #90 Stage 5 で撤去予定のため、#72 の名前接頭辞の切替対象から外している。
# local.automator_name_prefix ではなく var.system を直接使うことで、接頭辞を切り替えても
# インスタンスが再作成（＝データ喪失）されないようにしている。
resource "google_sql_database_instance" "podcast" {
  name             = "${var.system}-postgres-${var.environment}"
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.environment == "prod"

  settings {
    edition           = "ENTERPRISE"
    tier              = var.cloud_sql_tier
    availability_type = var.cloud_sql_availability_type
    disk_type         = "PD_SSD"
    disk_size         = var.environment == "prod" ? 20 : 10
    disk_autoresize   = true

    backup_configuration {
      enabled                        = var.environment == "prod"
      point_in_time_recovery_enabled = false
    }

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_sql_database" "podcast" {
  name     = var.cloud_sql_database_name
  instance = google_sql_database_instance.podcast.name
  project  = var.project_id
}

resource "random_password" "podcast_database" {
  length  = 32
  special = false
}

resource "google_sql_user" "podcast" {
  name     = var.cloud_sql_database_user
  instance = google_sql_database_instance.podcast.name
  password = random_password.podcast_database.result
  project  = var.project_id
}

# DATABASE_URL シークレットは Supabase 移行に伴い「値は手動管理」へ移行した（#90）。
# 参照先は var.database_url_secret_name（環境別 tfvars）。ここでは生成しない。

resource "google_secret_manager_secret" "database_password" {
  secret_id = "${var.system}-database-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = random_password.podcast_database.result
}

# ⚠️ Cloud SQL は #90 Stage 5 で撤去予定のため、#72 のリネーム対象から外している。
# 名前は現行値をリテラルで固定する。var.system も local.automator_name_prefix も
# 参照しないのは、どちらを切り替えてもインスタンスが再作成（＝データ喪失）される
# ためで、#90 のロールバック先としても残しておく必要があるから。
resource "google_sql_database_instance" "podcast" {
  name             = "podcast-automator-postgres-${var.environment}"
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  # ⚠️ #90 Stage 5（Cloud SQL 撤去）の 1 段階目として false にしている。
  # deletion_protection は destroy 時に state 側の値が読まれるため、「false 化」と
  # 「リソース定義の削除」を同一 apply で行うと destroy が失敗する
  # （#72 でバケットと Cloud Run Service の両方で踏んだ）。
  # 次のリリースでこのファイルごと削除する。
  deletion_protection = false

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
  # 同上。prod の live サービスがこのシークレットを参照しているため、
  # ラベル用の var.system の変更で作り直されないよう名前をリテラル固定する。
  secret_id = "podcast-automator-database-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = random_password.podcast_database.result
}

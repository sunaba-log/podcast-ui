# podcast-ui アプリ SA に付与するプロジェクトロール一式。
# CD では Terraform がこの集合を真として権限を収束させる。
# （旧 automator/podcast_ui.tf の datastore.user / firebaseauth.admin / cloudsql.client と
#  旧 ui/infra/iam.tf の集合を統合。SA 実体・binding は ui 側定義を正とする）
locals {
  app_project_roles = [
    "roles/cloudsql.client",     # Cloud SQL 接続（Cloud SQL Connector）
    "roles/datastore.user",      # Firestore 読み書き
    "roles/firebaseauth.admin",  # セッションCookie検証 / Auth管理
    "roles/aiplatform.user",     # Vertex AI（議事録チャットの生成・埋め込み）
    "roles/secretmanager.admin", # シークレットの作成・取得・バージョン追加・削除
  ]
}

resource "google_project_iam_member" "app" {
  for_each = toset(local.app_project_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

# 署名付きURLでのアップロード（PUT）に必要なオブジェクト作成権限。
# バケットは同一 state の google_storage_bucket.input を直接参照する。
resource "google_storage_bucket_iam_member" "app_upload_object_creator" {
  bucket = google_storage_bucket.input.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.app.email}"
}

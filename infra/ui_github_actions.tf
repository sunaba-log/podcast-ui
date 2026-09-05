# GitHub Actions のデプロイ認証は dev-platform に集約した OIDC(WIF) 基盤を使う。
# WIF プール github-actions / プロバイダ github-oidc と、org 共有デプロイ SA
# github-actions-deployer は dev-platform/infra が管理する（本リポジトリでは定義しない）。
#
# ここでは、共有 SA が podcast-ui のランタイム SA (google_service_account.app) として
# Cloud Run をデプロイできるよう act-as 権限だけを付与する。
# DB パスワード読み取り・Artifact Registry・Firebase Auth 等は共有 SA が保有する
# 広い権限（editor / secretmanager.admin / firebaseauth.admin 等）でカバーされる。

resource "google_service_account_iam_member" "shared_deployer_act_as_app" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:github-actions-deployer@${var.project_id}.iam.gserviceaccount.com"
}

# Cloud Run サービスの IAM（allUsers への run.invoker）を Terraform で管理するには
# run.services.setIamPolicy が必要。共有 SA が持つ editor には含まれないため、
# サービス改名（#72 Stage 7）で旧サービスからバインディングを外す destroy が
# 403 で失敗した。Cloud Run の公開設定（ui_cloud_run.tf の
# google_cloud_run_v2_service_iam_member.public）は本リポジトリの TF が管理して
# いるので、それを完遂できるだけの権限をここで付与する。
#
# 共有 SA の実体は dev-platform/infra が管理するが、このプロジェクト固有の要件で
# あるため、上の act-as と同様にプロジェクト単位の binding は本リポジトリで持つ。
resource "google_project_iam_member" "shared_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:github-actions-deployer@${var.project_id}.iam.gserviceaccount.com"
}

# 同様に、アプリ実行 SA の IAM ポリシー（act-as / signBlob）を Terraform で管理するには
# iam.serviceAccounts.setIamPolicy が要る。これも editor には含まれない。
# SA を改名すると上の act-as と ui_secrets.tf の signBlob を貼り直すことになり、
# 権限が無いと 403 で失敗する（#72 Stage 8 で実際に発生）。
#
# より狭い roles/iam.serviceAccountIamAdmin はプロジェクトへの付与が拒否される
# （Error 400: Role ... is not supported for this resource）ため、
# プロジェクトに付与可能な roles/iam.serviceAccountAdmin を使う。
resource "google_project_iam_member" "shared_deployer_sa_admin" {
  project = var.project_id
  role    = "roles/iam.serviceAccountAdmin"
  member  = "serviceAccount:github-actions-deployer@${var.project_id}.iam.gserviceaccount.com"
}

# Terraform 論理アドレスの sparkcast 系リネーム（#73）。
#
# 実リソースは変更しない（cosmetic）。`terraform state mv` を手で叩く代わりに
# `moved` ブロックを使う:
#   - CI（CD の terraform apply）だけで dev / prod 両 state に自動適用される
#   - コードレビュー可能で、適用順序の取り違えや片側だけ実行した状態が起きない
#   - state に旧アドレスが無ければ no-op のため、再実行・新規環境でも安全
#
# 撤去タイミング: dev / prod 双方の apply が完了し、plan が no-change に
# 収束したことを確認したら、このファイルごと削除してよい。
moved {
  from = google_cloud_run_v2_service.podcast_ui
  to   = google_cloud_run_v2_service.sparkcast_ui
}

moved {
  from = google_artifact_registry_repository.podcast_ui
  to   = google_artifact_registry_repository.sparkcast_ui
}

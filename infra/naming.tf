# 実リソース名の接頭辞（#72: podcast-* → sparkcast-* リネーム）。
#
# var.system は provider の default_labels（ラベル値）と実リソース名の接頭辞を
# 兼ねていた。リネームを段階的・可逆に進めるため、「名前」を「ラベル」から
# 完全に分離する。
#
# ⚠️ ここは var.system を参照しない。参照すると「ラベルだけ sparkcast にする」
#    つもりの変更で全リソース名が一斉に変わり、再作成＝破壊的変更になるため。
#
# 既定値は現行名そのままなので、tfvars を指定しない限り plan は no-change。
# 実際の切替手順は infra/docs/sparkcast-rename-runbook.md を参照。
locals {
  # automator 系（GCS / Cloud Run Job / Scheduler / Workflows / Eventarc / Artifact Registry）
  automator_name_prefix = var.automator_name_prefix

  # ui 系（Cloud Run Service / Artifact Registry / Scheduler）
  ui_name_prefix = var.ui_name_prefix
}

# sparkcast リネーム 手順書（Issue #72）

> **進捗サマリ**
>
> | Stage | 内容 | 破壊性 | 状態 |
> | --- | --- | --- | --- |
> | 0 | 命名の変数化（名前とラベルの分離） | 非破壊 | ✅ 完了（本 PR） |
> | 1 | ラベル `system` を sparkcast へ | 非破壊（in-place） | ⬜ 未着手 |
> | 2 | Cloud Scheduler（ui / automator） | 再作成（数秒） | ⬜ 未着手 |
> | 3 | Cloud Run Job / Workflows / Eventarc | 再作成（数分・処理断） | ⬜ 未着手 |
> | 4 | Artifact Registry（ui / automator） | 再作成＋イメージ再 push | ⬜ 未着手 |
> | 5 | GCS 入力バケット | 再作成（**データ移行不要**・下記根拠） | ⬜ 未着手 |
> | 6 | GCS バックアップバケット | 再作成＋ダンプ移行 | ⬜ 未着手 |
> | 7 | Cloud Run Service（ui） | 再作成＋**カスタムドメイン断** | ⬜ 未着手 |
> | 8 | アプリ実行 SA（ui） | 再作成＋IAM 全付け替え | ⬜ 未着手 |
>
> **Stage 4 までで「見た目の一貫性」の大半が得られ、データ・公開 URL への影響はゼロ。**
> Stage 7・8 は**本番のダウンタイムと IAM 付け替え**を伴うため、実施是非を都度判断する。

Cloud SQL 系（`podcast-automator-postgres-*` / `podcast-automator-database-password-*`）は
**#90 Stage 5 で撤去予定**のため本手順の対象外。`infra/cloud_sql.tf` は名前接頭辞の
切替に巻き込まれないよう、意図的に `var.system` を直接参照したままにしてある。

---

## 0. 前提と設計

### Issue #72 の記述からの修正点（調査で判明したこと）

Issue 本文は「GCS オブジェクトコピー」「Cloud SQL ダンプ/リストア」を前提にしていたが、
実装を確認した結果、実際のコストは大きく異なる。

| Issue の想定 | 実際 | 根拠 |
| --- | --- | --- |
| GCS 入力バケットは**オブジェクトコピーが必要** | **不要**。切替後は放置して期限切れを待てばよい | `gcs_retention_days`（dev 3日 / prod 30日）で自動削除される**一時領域**。DB の `episodes.source_audio_path` は**バケット名を含まないオブジェクトパスのみ**（`podcasts/{id}/episodes/{id}/source/{file}`）を保持し、バケット名は env（`GCS_UPLOAD_BUCKET` / `GCS_BUCKET`）から与えられる。配信音声の実体は R2 側 |
| Cloud SQL のダンプ/リストアが必要 | **対象外** | #90 Stage 5 で廃止。移行先の Supabase は GCP リソースではない |
| （言及なし） | **Cloud Run Service の改名はカスタムドメインの一時断を伴う** | `google_cloud_run_domain_mapping.app` の `spec.route_name` 変更は ForceNew。マッピング再作成中は証明書再発行待ちで `sparkcast.sunabalog.com` が不通になる |
| （言及なし） | **R2（Cloudflare）は絶対に改名しない** | `r2_subdomain`（prod `podcast.sunabalog.com`）は**配信済みエピソードの音声 URL / RSS の enclosure URL**。変更すると既存購読者の再生が全滅する。GCP 外でもあり本 Issue のスコープ外 |

### Stage 0 で入れた仕組み（本 PR）

`var.system` が「provider の default_labels のラベル値」と「実リソース名の接頭辞」を
兼ねていたため、片方を変えるともう片方も動く状態だった。これを分離した。

```hcl
# infra/naming.tf
locals {
  automator_name_prefix = var.automator_name_prefix  # default "podcast-automator"
  ui_name_prefix        = var.ui_name_prefix         # default "podcast-ui"
}
```

- `local.automator_name_prefix` … GCS / Cloud Run Job / Scheduler / Workflows / Eventarc / Artifact Registry(automator)
- `local.ui_name_prefix` … Cloud Run Service / Artifact Registry(ui) / Scheduler(ui)
- **`var.system` は参照しない。** 参照すると「ラベルだけ変えるつもり」の変更で全リソース名が
  一斉に変わってしまうため。

既定値は現行名と完全に同一（`terraform console` で dev/prod とも検証済み）なので、
tfvars を触らない限り plan は no-change。以降の Stage は**該当クラスの接頭辞だけを
tfvars で切り替える**という、小さく可逆な操作になる。

### 全 Stage 共通の進め方

1. **dev で先に実施**し、動作確認してから prod。
2. plan を必ず目視し、**想定したリソースだけが replace されること**を確認してから apply。
3. リネームは `create_before_destroy` ではないため、多くは destroy → create の順になる。
   その間サービス断が起きるものは、下記各 Stage の「影響」に記載する。
4. 各 Stage は独立して revert 可能（tfvars を戻して apply）。ただし**再作成の往復コスト**は
   かかるので、戻すより前に進む判断をしたい。

---

## Stage 1 — ラベル `system` を sparkcast へ（非破壊）

- 🤖 `infra/environments/{dev,prod}/variables.tfvars` の `system = "podcast-automator"` を `"sparkcast"` に変更。
- **影響**: provider の `default_labels` が変わるだけ。GCP のラベルは in-place 更新。
- ⚠️ `google_cloud_run_domain_mapping` はラベル変更が ForceNew になるため
  `ignore_changes` で `metadata[0].labels` / `effective_labels` / `terraform_labels` を
  無視済み（`infra/ui_domain_mapping.tf`）。plan にドメインマッピングの replace が
  出ていないことを必ず確認する。
- ✅ 検証: plan が全て in-place（`~`）で、`-/+`（replace）が無いこと。

## Stage 2 — Cloud Scheduler（安い）

- 対象: `podcast-ui-cleanup-uploads` / `podcast-ui-reindex-minutes` /
  `podcast-automator-{agenda,promoter,db-backup}-{env}`
- 🤖 `ui_name_prefix = "sparkcast-ui"` を tfvars に追加（automator 側は Stage 3 とまとめてよい）。
- **影響**: cron ジョブの再作成のみ。実行中のジョブが無い時間帯に実施すれば無影響。
- ✅ 検証: `gcloud scheduler jobs list` で新名が ENABLED、次回実行時刻が入っていること。
  一度手動 run して成功すること。

## Stage 3 — Cloud Run Job / Workflows / Eventarc（automator 本体）

- 対象: `podcast-automator-app-{env}` / `-agenda-{env}` / `-promoter-{env}` / `-db-backup-{env}`、
  Workflow `podcast-automator-{env}`、Eventarc トリガ `podcast-automator-gcs-finalize-{env}`
- 🤖 `automator_name_prefix = "sparkcast-automator"` を tfvars に追加。
- **影響**: Job / Workflow / トリガが順に再作成される。**この間の GCS アップロードは
  パイプラインが起動しない**（Eventarc トリガ不在の窓がある）。収録アップロードが無い
  時間帯に実施する。ジョブの実行履歴は失われる（ログは Cloud Logging に残る）。
- ⚠️ Workflows は Job 名を本文に埋め込む（`infra/workflows.tf` の `- job: ${module.cloud_run_job.job_name}`）。
  Job と Workflow の再作成順序は Terraform の依存解決に任せてよいが、
  **apply 後に必ず 1 本 E2E を通す**こと。
- ✅ 検証: テスト音声をアップロード → Eventarc → Workflows → Job 起動 → エピソードが
  `completed` になり Discord 通知が届くまで。

## Stage 4 — Artifact Registry

- 対象: `podcast-ui`（ui）/ `podcast-automator-{env}`（automator、モジュール内 `lower("${system}-${env}")`）
- **影響**: 新リポジトリが空で作られる。
  - automator 側は `module.cloud_run_job` の local-exec が **apply 時に自動で build & push** するため追加作業は不要。
  - ui 側は **CD がイメージを push する**ため、`.github/workflows/cd.yml` / `pr-preview.yml` の
    `IMAGE` を新リポジトリへ更新する PR を**同時に**出す必要がある。更新前に apply すると
    次の deploy まで新リポジトリが空のままになる。
- 🤖 手順: (1) CD の `IMAGE` を新パスに変更する PR を用意 → (2) infra apply → (3) CD を流して push。
- 旧リポジトリはイメージ削除課金を避けるため、切替確認後に手動削除。
- ✅ 検証: `gcloud artifacts docker images list` で新リポジトリにイメージがあること。

## Stage 5 — GCS 入力バケット（データ移行不要）

- 対象: `podcast-automator-audio-input-{env}` → `sparkcast-automator-audio-input-{env}`
- **データ移行は不要**（上表「Issue の記述からの修正点」参照）。ライフサイクルで消える
  一時領域であり、DB はバケット名を保持していない。
- **影響**: 新バケット作成 → Eventarc トリガ・UI の `GCS_UPLOAD_BUCKET`・automator の
  `GCS_BUCKET` が新バケットを指す。**切替時点で処理中（`processing`）のエピソードは
  入力オブジェクトを見失う**ため、処理中が無いことを確認してから実施する。
- ⚠️ `gcs_force_destroy` は prod で `false`。旧バケットは中身が空になるまで destroy できない。
  Terraform の destroy が失敗する場合は、**旧バケットを一旦 state から外し**
  （`terraform state rm`）、保持期間経過後に手動削除するのが安全。
- ⚠️ CORS 設定（`gcs_cors_origins`）は新バケットにも同じ値が入る。ブラウザからの
  署名付き URL アップロードが通ることを必ず確認する。
- ✅ 検証: UI から音声をアップロードし、新バケットにオブジェクトが置かれ、パイプラインが
  完走すること。

## Stage 6 — GCS バックアップバケット

- 対象: `podcast-automator-db-backup-{env}` → `sparkcast-automator-db-backup-{env}`
- **影響**: 新バケット作成後、db-backup ジョブの `BACKUP_BUCKET` が新バケットを指す。
- 🤖 過去ダンプは保全したいので手動コピー:
  ```sh
  gcloud storage rsync -r \
    gs://podcast-automator-db-backup-<env> \
    gs://sparkcast-automator-db-backup-<env>
  ```
- ⚠️ `force_destroy = false` かつ「誤削除を防ぐ」設計のため、旧バケットは自動 destroy されない。
  Stage 5 と同様に state から外して手動削除する。
- ✅ 検証: db-backup ジョブを手動実行し、新バケットにダンプが出力されること。

## Stage 7 — Cloud Run Service（ui）※ ダウンタイムあり

- 対象: `podcast-ui-{env}` → `sparkcast-ui-{env}`
- **影響（重要）**: `google_cloud_run_domain_mapping.app` の `spec.route_name` が変わるため
  **マッピングが再作成され、証明書の再発行が完了するまでカスタムドメインが不通**になる。
  所要時間は Google 側の発行次第で、数分〜十数分を見込む。**本番の計画停止が必要**。
- 併せて更新が必要なもの（**infra apply と同じタイミングで揃える**）:
  - `.github/workflows/cd.yml` の `SERVICE=podcast-ui-{env}`
  - `.github/workflows/pr-preview.yml` の `SERVICE`
  - Firebase Auth の承認済みドメイン（新しい `*.run.app` デフォルト URL を使う場合）
  - Discord 通知の説明文（`APP_URL` はカスタムドメインなので変更不要）
- 🤖 推奨手順:
  1. 収録・視聴の少ない時間帯を告知して確保する。
  2. CD の `SERVICE` を新名にする PR を用意しておく（マージはまだしない）。
  3. infra apply（サービス再作成 → ドメインマッピング再作成）。
  4. `gcloud beta run domain-mappings describe` で証明書 ready を待つ。
  5. CD の PR をマージし、新サービスへイメージをデプロイ。
  6. ✅ カスタムドメインでログイン〜エピソード表示まで確認。
- **ロールバック**: `ui_name_prefix` を戻して apply。ただし**再度ドメイン断が発生する**ため、
  切り戻しは最終手段。
- **判断材料**: 得られるのは名前の一貫性のみで、機能的な利得は無い。
  Stage 4 までで止める選択も十分に合理的。

## Stage 8 — アプリ実行 SA（ui）※ IAM 全付け替え

- 対象: `podcast-ui-{env}@<project>.iam.gserviceaccount.com` → `sparkcast-ui-{env}@...`
  （tfvars の `app_service_account_id` / `app_service_account_display_name`）
- **影響**: SA は再作成され、以下の binding が全て貼り直しになる。
  - `infra/ui_iam.tf` のプロジェクトロール群
  - `infra/ui_secrets.tf` の secretAccessor（db_password / cron_secret / database_url）
  - `google_service_account_iam_member.app_self_token_creator`（署名付き URL 用 signBlob）
  - `google_storage_bucket_iam_member.app_upload_object_creator`
  - `google_service_account_iam_member.shared_deployer_act_as_app`
  - Cloud Run Service の `service_account`（＝サービスの新リビジョン）
- ⚠️ Terraform は依存順に処理するが、**新 SA への binding 反映には数十秒〜数分の伝播遅延**が
  ある。apply 直後にアプリが 403 を返すことがあるので、少し待ってから検証する。
- ⚠️ 削除した SA は 30 日間 tombstone として残る（同名再作成は不可）。**新しい名前を使うので
  問題にはならない**が、ロールバックで旧名に戻す場合は 30 日制約に注意。
- ✅ 検証: ログイン、エピソード一覧、**音声アップロード（署名付き URL ＝ signBlob）**、
  Firestore 読み書き、cron エンドポイントの疎通。

---

## 対象外（意図的にリネームしない）

| 対象 | 理由 |
| --- | --- |
| R2 バケット `podcast` / `podcast-dev`、カスタムドメイン `podcast.sunabalog.com` / `dev.podcast.sunabalog.com` | **配信済みエピソードの音声 URL・RSS の enclosure URL**。変更すると既存購読者の再生が壊れる。Cloudflare 側でもあり GCP スコープ外 |
| Cloud SQL `podcast-automator-postgres-*`、Secret `podcast-automator-database-password-*` | #90 Stage 5 で撤去予定。消す予定のリソースを改名するのは無駄 |
| Terraform state のオブジェクトパス（`backend.conf` の `prefix = "podcast-automator"`） | state の引っ越しであり cosmetic ではない。移行するなら `terraform init -migrate-state` を dev/prod 個別に実施する独立作業。本手順では扱わない |
| GCP プロジェクト ID `sunabalog-dev` / `sunabalog-prod` | プロジェクト ID は変更不可。sparkcast は sunabalog 配下の 1 プロダクトなので現状で正しい |
| カスタムドメイン `sparkcast.sunabalog.com` | すでに sparkcast 命名 |

## 完了条件（Issue #72）

- [ ] Stage 1〜4 が dev / prod で完了し、アプリ / ジョブが正常稼働
- [ ] Stage 5〜8 は実施可否を判断のうえ、実施したものについて検証完了
- [ ] 旧リソースを安全に廃止（バケットは保持期間経過後に手動削除）
- [ ] Terraform 設定・tfvars・ワークフロー（`SERVICE` / `IMAGE`）の参照が新名に揃っている

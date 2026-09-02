# sparkcast リネーム 手順書（Issue #72）

> **進捗サマリ（2026-09-03 更新）**
>
> | Stage | 内容 | 破壊性 | dev | prod |
> | --- | --- | --- | --- | --- |
> | 0 | 命名の変数化（名前とラベルの分離） | 非破壊 | ✅ | ✅（共通コード） |
> | 1 | ラベル `system` を sparkcast へ | 非破壊（in-place） | ✅ | ⬜ |
> | 2 | Cloud Scheduler（ui / automator） | 再作成（数秒） | ✅ | ⬜ |
> | 3 | Cloud Run Job / Workflows / Eventarc | 再作成（数分・処理断） | ✅ | ⬜ |
> | 4 | Artifact Registry（ui / automator） | 再作成＋イメージ再 push | ✅ | ⬜ |
> | 5 | GCS 入力バケット | 再作成（**データ移行不要**・下記根拠） | ✅ | ⬜ |
> | 6 | GCS バックアップバケット | 再作成＋ダンプ移行 | ✅ | ⬜ |
> | 7 | Cloud Run Service（ui） | 再作成＋**カスタムドメイン断** | ✅ | ⬜ |
> | 8 | アプリ実行 SA（ui） | 再作成＋IAM 全付け替え | ✅ | ⬜ |
>
> **dev は全 Stage 完了。prod は未着手。**
> prod を実施する前に、必ず下記「[dev で踏んだ落とし穴](#dev-で踏んだ落とし穴prod-実施前に必読)」を読むこと。
> dev では 10 回以上 apply に失敗しており、**素直に tfvars を書き換えるだけでは通らない**。

Cloud SQL 系（`podcast-automator-postgres-*` / `podcast-automator-database-password-*`）は
**#90 Stage 5 で撤去予定**のため本手順の対象外。`infra/cloud_sql.tf` は名前接頭辞の
切替に巻き込まれないよう、意図的に `var.system` を直接参照したままにしてある。

---

---

## dev で踏んだ落とし穴（prod 実施前に必読）

dev の実施で判明した、手順書の初版に書かれていなかった制約。**いずれも prod でも同じように起きる。**

### 1. `editor` ロールには `setIamPolicy` 系が含まれない

共有デプロイ SA（`github-actions-deployer@`）は `editor` を持つが、**リソースの IAM ポリシー設定権限は editor から除外されている**。そのため以下がすべて 403 で失敗した。

| 失敗した操作 | 不足していた権限 | 付与したロール |
| --- | --- | --- |
| Cloud Run Service 改名時の `allUsers` バインディング貼り直し | `run.services.setIamPolicy` | `roles/run.admin` |
| アプリ実行 SA 改名時の act-as / signBlob 貼り直し | `iam.serviceAccounts.setIamPolicy` | `roles/iam.serviceAccountAdmin` |

どちらも `infra/ui_github_actions.tf` で付与済み。**prod でも同じ付与が必要**（同ファイルは環境共通なので、prod への apply 時に自動で入る）。

⚠️ `roles/iam.serviceAccountIamAdmin`（より狭い）は**プロジェクトへの付与が拒否される**（`Error 400: Role ... is not supported for this resource`）。

### 2. 権限付与は「失敗する destroy」と同じ plan では作成されない

Terraform は destroy がエラーになった時点で**新しい操作のスケジュールを止める**。そのため「権限が無くて失敗する destroy」と「その権限を付与するリソース」を同じ apply に入れても、**付与は永久に作成されない**。dev では 4 回連続で同じ 403 を踏んだ。

**必ず 2 段階に分ける。**

1. 改名を一旦戻す（＝失敗する destroy を plan から消す）＋ 権限付与だけを入れて apply
2. 改名を再投入して apply

⚠️ `depends_on` で順序を付けるのは**逆効果**。付与の create が失敗する destroy と同じ依存鎖に載り、かえって実行されなくなる。

### 3. `force_destroy` / `deletion_protection` は destroy 時に *state 側の値* が読まれる

「`false` にする」と「改名する」を同一 apply で行うと、**destroy が古い値のまま実行されて失敗する**。

```
Error: Error trying to delete bucket ... without `force_destroy` set to true
Error: cannot destroy service without setting deletion_protection=false
```

**必ず 2 段階に分ける。** 1 回目は旧名のまま値だけ更新（in-place）、2 回目に改名（replace）。
バックアップバケットには `backup_bucket_name_override` を用意してあるので、1 段階目でこれに旧名を入れる。

### 4. Artifact Registry を作り直すと中のイメージが消える

`template[0].containers[0].image` は `ignore_changes` に入っているため、**TF が state に残る実在しないイメージを再送して `Image not found` で失敗する**。

一時的に `image` を `ignore_changes` から外し、プレースホルダ（`cloudrun/container/hello`）へ収束させてから改名する。**改名完了後に必ず戻すこと**（戻し忘れると infra apply のたびにアプリがプレースホルダへ巻き戻る）。

### 5. `template[0].revision` の ignore が 409 を生む

TF が template（env / service_account）を変更する際、`ignore_changes` に入れた `revision` の値（gcloud が付けた名前）を state から拾って**別 config で再送**するため 409 になる。

```
Error 409: Revision named 'podcast-ui-dev-sha-...' with different configuration already exists.
```

TF 側から template を変更する Stage（1・8 など）では、**一時的に `revision` を `ignore_changes` から外す**。外すと Cloud Run が自動採番するので衝突しない。完了後に戻す。

### 6. Cloud Run のドメインマッピングは CI から作成できない

マッピングの作成には **Google Search Console でのドメイン所有権**が必要で、共有デプロイ SA は `sunabalog.com` の確認済み所有者ではない。

```
Error: Caller is not authorized to administer the domain ...
```

replace の順序上、マッピングの create は**サービス作成の後**に来るため、**改名自体は完了したうえでマッピングだけが失敗する**。所有権を持つアカウントのトークンでターゲット apply して復旧する。

```sh
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=admin@sunabalog.com)"
terraform -chdir=infra apply -input=false \
  -var-file=environments/<env>/variables.tfvars \
  -target=google_cloud_run_domain_mapping.app
```

**恒久対策**: Search Console で `github-actions-deployer@<project>.iam.gserviceaccount.com` を `sunabalog.com` の所有者に追加すれば、この手動ステップは不要になる。

### 7. トラフィックのピン留めで旧リビジョンが残り続ける

`cd.yml` は `--no-traffic` + `update-traffic --to-revisions <suffix>=100` で**特定リビジョンにトラフィックを固定**する。TF が新しいリビジョンを作っても（`traffic` は `ignore_changes`）**トラフィックは移らない**。

Stage 8 で SA を改名した直後、トラフィックが旧 SA を使う旧リビジョンに固定されたままで、**旧 SA 削除により全リクエストが 500** になった（アプリログは出ず `latency: 0s` の 500 だけが残る）。

**TF がサービスの template を変更する Stage の後は、必ず ui デプロイでトラフィックを新リビジョンへ寄せること。**

```sh
gh workflow run cd.yml --ref <branch> -f target_branch=<branch> -f deploy_mode=plan -f deploy_ui=true
```

### 8. `var.system` はラベル専用にしてある

`var.system` を変えると `infra/cloud_sql.tf` の Cloud SQL インスタンス名まで変わり、**再作成＝データ喪失**になる状態だった。現在は `cloud_sql.tf` の名前をリテラル固定してあるので安全だが、**新しいリソースの名前に `var.system` を使ってはいけない**。実リソース名は `local.automator_name_prefix` / `local.ui_name_prefix` を使う。

### prod 実施時の推奨順序

1. Search Console で deployer SA を `sunabalog.com` の所有者に追加（落とし穴 6 の恒久対策）
2. Stage 1（ラベル）— `revision` の ignore を一時的に外す
3. Stage 2〜5（automator 系）— 収録の無い時間帯に
4. Stage 6 — **先に `gcloud storage rsync` でダンプを移送**してから 2 段階 apply
5. Stage 7 — `deletion_protection` の 2 段階 apply。`cd.yml` / `pr-preview.yml` の `SERVICE`・`IMAGE` 更新 PR を別途用意
6. Stage 8 — `revision` の ignore を外す。完了後に ui デプロイでトラフィックを寄せる
7. `revision` / `image` の `ignore_changes` を戻す

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

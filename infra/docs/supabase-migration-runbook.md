# Supabase 移行 手順書（Issue #90）

> **進捗サマリ（2026-07-31 更新）**
>
> | Stage | 内容 | 状態 |
> | --- | --- | --- |
> | 1 | dev データ移行 | ✅ 完了 |
> | 2 | dev 切替（UI + automator → Supabase） | ✅ 完了・E2E実証済み |
> | 3 | prod 切替 | ⬜ 未着手 |
> | 4 | 日次バックアップ（pg_dump → GCS） | ⬜ 未着手 |
> | 5 | Cloud SQL 撤去（**＝月約$27のコスト削減が実現**） | ⬜ 未着手 |
>
> - **dev は現在 Supabase で本番稼働**（UI `podcast-ui-dev` / automator Job とも）。Cloud SQL dev は**残置**＝ロールバック可。
> - 実行の詳細・発生した問題・対処は下記「[実行結果ログ](#実行結果ログエンジニア向け)」に記録。
> - **コスト削減が数値化するのは Stage 5（Cloud SQL 削除）以降。** それまでは Cloud SQL 併存＝安全マージン。


Cloud SQL（PostgreSQL・常時課金 月約 $27）を廃止し、Supabase 無料枠の PostgreSQL へ移行する。
**dev を先に完全に通してから prod**、という順で進める。破壊的操作（Cloud SQL 削除）は両環境の切替・検証が終わった最後に 1 回だけ行う。

> この手順書は「一緒に実行する台本」です。各ステップに担当を明記します。
> 👤=あなたが操作 / 💻=コマンド実行（`!` で session 内可） / 🤖=Claude がリポジトリを編集 / ✅=動作確認

---

## 実行結果ログ（エンジニア向け）

> Stage 1・2 の実施記録。技術的な勘所と発生した問題・対処を残す。

### 環境・ツール
- 接続: **Supabase Session pooler（IPv4 / Supavisor）** を使用。無料枠の Direct 接続は **IPv6 専用**で Mac・Cloud Run（IPv4）から不可。
  - pooler: `aws-0-ap-northeast-1.pooler.supabase.com:5432` / user `postgres.<project-ref>` / db `postgres` / `sslmode=require`。
- クライアント: Homebrew `libpq`（keg-only, v18）。移行元 Cloud SQL へは **Cloud SQL Auth Proxy** 経由。
  - ⚠️ proxy の ADC が失効（`invalid_rapt`）していたため、`cloud-sql-proxy <conn> --token "$(gcloud auth print-access-token)"` で CLI トークンを渡して回避。

### Stage 1（dev データ移行）— 結果 ✅
- `pg_dump -Fc --no-owner --no-privileges`（proxy 経由）→ `pg_restore`（Supabase pooler）。
- 全7テーブルの行数一致を確認（users2 / podcasts7 / podcast_ownerships4 / episodes10 / api_usage_logs5 / pre_registered_emails1 / schema_migrations8）。`schema_migrations` も複製済み＝マイグレーションは適用済み状態で移行。
- 完全 DATABASE_URL（percent-encode 済み）を Secret Manager `supabase-database-url-dev` に格納・接続実証。

### 重要な技術的発見：node-pg の SSL（UI）
UI の `ui/src/server/db-pool.ts` は `CLOUD_SQL_INSTANCE_CONNECTION_NAME` 未設定時に `DATABASE_URL` へフォールバックするが、**`new Pool({ connectionString })` 直渡しは Supabase プーラーで失敗**する。実測:

| 方式 | 結果 |
| --- | --- |
| `connectionString`（URLに`sslmode=require`） | ❌ `SELF_SIGNED_CERT_IN_CHAIN` |
| `connectionString` + `ssl:{rejectUnauthorized:false}` | ❌ 同上（URLの sslmode が明示 ssl を上書き。新しい pg は `require`→`verify-full` 扱い） |
| **discrete params + `ssl:{rejectUnauthorized:false}`** | ✅ 成功 |

→ `db-pool.ts` の DATABASE_URL 経路を **URL をパースして host/port/user/password/database に分解し、非ローカルは `ssl:{rejectUnauthorized:false}` を付与**する実装に変更。automator（psycopg/libpq）は URL の `sslmode=require` のままで可（psql で実証）。

### Stage 2（dev 切替）— 結果 ✅（PR #113）
変更6ファイル: `ui/src/server/db-pool.ts`（SSL）/ `infra/ui_cloud_run.tf`（DB env → `DATABASE_URL` secret）/ `infra/ui_secrets.tf`（アプリSAへ secret accessor 付与）/ `infra/cloud_sql.tf`（DATABASE_URL secret の TF 生成を廃止＝値は手動管理）/ `infra/job.tf`（廃止 secret への depends_on 除去）/ `infra/environments/dev/variables.tfvars`（`database_url_secret_name = supabase-database-url-dev`）。automator の secret アクセスは `iam.tf` の**プロジェクト全体の secretAccessor**で充足済み。

**検証**: dev UI でログイン→チャンネル/エピソード（概要文まで）表示、`/episodes` が HTTP 200、DB/SSL エラーログなし。automator も Supabase secret を参照。

### ⚠️ 発生した問題：CD のリビジョン名衝突（prod でも再発する）
`develop` マージで CD の `ui`（gcloud deploy）と `infra`（terraform apply）が**並行実行**され、両方が同一 Cloud Run サービス `podcast-ui-dev` を更新 → terraform が
`Error 409: Revision named 'podcast-ui-dev-sha-...-N' with different configuration already exists` で失敗（2回）。

- **根因**: `ui_cloud_run.tf` の `lifecycle.ignore_changes = [template[0].revision, ...]` により、gcloud が付けたリビジョン名が TF state に取り込まれ、TF の env 変更適用時に**同名リビジョンを別 config で再送**してしまう。通常運用（env 不変・image のみ gcloud 更新）では顕在化しないが、今回のように **TF がサービス template（env）を変更**すると衝突する。
- **対処（実施）**: (1) `gcloud run services update podcast-ui-dev --remove-env-vars=CLOUD_SQL_INSTANCE_CONNECTION_NAME,DB_NAME,DB_USER --remove-secrets=DB_PASSWORD --update-secrets=DATABASE_URL=supabase-database-url-dev:latest` で live を TF 目標構成へ収束 → (2) infra ジョブ再実行で terraform が refresh し差分ゼロ＝成功。この間 dev は「Cloud SQL のまま」で常時正常（automator だけ先行して Supabase になった短時間の分裂状態はデータ同一のため無害）。
- **⚠️ さらに落とし穴②（トラフィックのピン留め）**: cd.yml の ui deploy は `--no-traffic` + `update-traffic --to-revisions ${SUFFIX}=100` で**特定リビジョンにトラフィックを固定**する。そのため上記「対処」の `services update` で作った DATABASE_URL リビジョンは **0% トラフィック**のままで、旧 connector リビジョンが 100% を保持し続けた。結果、**UI は Cloud SQL に書き続け（automator だけ Supabase）、テストアップロードで `Episode not found: episode_id=11` が発生**（automator が Supabase を見るが、UI が Cloud SQL に書いたため不一致）。読み取りは両DB同一データのため成功に見え、盲点だった。**修正**: `gcloud run services update-traffic podcast-ui-dev --to-revisions=<DATABASE_URL revision>=100`。**教訓**: env 切替は「リビジョン作成」＋「**トラフィックの明示切替**」＋「**書き込み系のE2E検証**（読み取りは同一データで盲点になる）」まで必須。
- **恒久対策（未実施・要判断）**: 案a) UI の DB env を gcloud 側管理にし TF は `template[0].containers[0].env` も ignore、案b) `ui`/`infra` ジョブを直列化（infra→ui 依存）。**Stage 3（prod）では上記「対処」＋トラフィック明示切替を最初から手順に織り込む**（下記 Stage 3 参照）。

### E2E 検証結果（dev）✅
- **読み取り**: UI ログイン→チャンネル/エピソード表示（`/episodes` HTTP 200）。
- **書き込み＋パイプライン**: テストアップロード → UI が **Supabase** に episode 11 作成（`processing`）→ GCS→Eventarc→Workflows→automator Job 起動 → automator が Supabase 上で処理（文字起こし＋Gemini 要約で **title/概要を自動生成**）→ 音声変換・R2 配信 → Supabase を `completed` に更新（duration 4502s, description 1407字）。Discord に完了通知。**全経路 Supabase で実証**。

---

## 0. 前提と全体像

### 現状の配線（調査で判明したこと）

| 参照元 | DB への繋ぎ方 | 認証情報の出どころ |
| --- | --- | --- |
| **automator**（Cloud Run Job / Python・psycopg） | `DATABASE_URL` 環境変数（ソケット式） | Secret Manager `DATABASE_URL`（**Terraform が cloud_sql.tf で値まで生成**） |
| **UI**（Cloud Run Service / TS・pg） | `@google-cloud/cloud-sql-connector` 経由。ただし **`CLOUD_SQL_INSTANCE_CONNECTION_NAME` が無ければ `DATABASE_URL` に自動フォールバック**（`ui/src/server/db-pool.ts`） | DB パスワード Secret（dev=`db-password` / prod=`podcast-automator-database-password-prod`）。UI 側は **CD の gcloud deploy で env 注入**（TF 管理外） |
| **UI マイグレーション** | CD の `npm run db:migrate`（connector 経由） | 同上（CD が env 注入） |

### 重要な技術ポイント（ここが移行の勘所）

1. **接続文字列の形式が変わる。**
   - 現在（Cloud SQL・ソケット）: `postgresql://podcast_app:PASS@/podcast?host=/cloudsql/CONN_NAME`
   - Supabase（TCP＋SSL）: `postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres?sslmode=require`
2. **UI はコード変更ほぼ不要。** `CLOUD_SQL_INSTANCE_CONNECTION_NAME` を渡すのをやめ、`DATABASE_URL`（Supabase）を渡せばフォールバック経路で繋がる。SSL の効き方だけ要検証（`sslmode=require` を pg が解釈するか）。
3. **automator の `DATABASE_URL` は今 Terraform が生成している。** 手で新バージョンを入れても次の `terraform apply` で socket 式に戻される。→ **先に「この Secret の値は手動管理」へ小さく寄せる**（UI の `db-password` が既にこの方式）。これを Stage 1 で行う。
4. **Terraform は dev/prod で同じ .tf を共有**し、`environments/dev|prod` の tfvars/backend で切替。よって **cloud_sql.tf の削除は dev/prod 両方に効く** → 後片付け（Stage 5）は両環境の検証完了後に 1 回だけ。

### 事前に必要なもの（👤 あなた側）

- [ ] Supabase アカウント（無料）。dev/prod で 2 プロジェクトを作る（東京＝AWS ap-northeast-1）
- [ ] `gcloud` にログイン済みで dev/prod プロジェクトを操作できること（Secret 更新・Cloud Run デプロイ・Cloud SQL 接続に必要）
- [ ] PostgreSQL クライアント（`pg_dump` / `psql`。Postgres 17 と揃えるのが安全）
- [ ] コマンドは session で `! <command>` で実行 → 出力を私に貼ってもらえば次の判断をします

> 破壊はまだ一切しません。Cloud SQL は Stage 5 まで**残したまま**進めるので、いつでも切り戻せます。

---

## Stage 1 — dev：Supabase 準備 ＋ データ移行（切替なし・無影響）

**ゴール**: Supabase dev に本番同等のスキーマ＋データが入っている。既存 dev は一切変わらない。

1. 👤 Supabase で dev プロジェクト作成（東京）。プロジェクトの接続文字列とパスワードを控える。
2. 💻 現 dev Cloud SQL からダンプを取得（公開IP＋SSL、または Cloud SQL Auth Proxy 経由）。
   ```sh
   pg_dump "現dev接続URL" --no-owner --no-privileges -Fc -f dev_dump.dump
   ```
3. 💻 Supabase dev へリストア。
   ```sh
   pg_restore --no-owner --no-privileges -d "Supabase dev URL" dev_dump.dump
   ```
4. ✅ 行数照合（5 テーブル: users / podcasts / podcast_ownerships / episodes / api_usage_logs）。
   ```sh
   psql "Supabase dev URL" -c "select 'episodes' t, count(*) from episodes union all select 'podcasts', count(*) from podcasts;"
   ```

> 🤖 Claude 側: 2〜4 の正確なコマンド（authorized network 追加 or proxy 起動含む）を、あなたの接続情報を見ながら確定します。

---

## Stage 2 — dev：切替 ＋ 検証（可逆）

**ゴール**: dev の automator と UI が Supabase を向く。Cloud SQL dev は残す（＝即ロールバック可）。

1. 🤖 **Terraform 小改修（Secret の値を手動管理へ）**: `cloud_sql.tf` の `google_secret_manager_secret_version.database_url`（値生成）を外し、Secret の器だけ TF 管理に。UI の `db-password` と同じ「値は out-of-band」方式へ。※この改修は dev/prod 共通コードだが、**値は各環境で手動投入するので prod には影響しない**。
2. 💻 dev の `DATABASE_URL` Secret に Supabase の TCP+SSL URL を新バージョンとして投入。
   ```sh
   printf '%s' "postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres?sslmode=require" \
     | gcloud secrets versions add <dev DATABASE_URL secret> --data-file=- --project <dev project>
   ```
3. 🤖 **UI の CD 設定変更**（`.github/workflows/cd.yml`）: dev デプロイで `CLOUD_SQL_INSTANCE_CONNECTION_NAME` を渡さず `DATABASE_URL`（Supabase）を注入、`--add-cloudsql-instances` を外す。`db:migrate` も同 URL を使うよう調整。
4. 💻 automator dev を再実行（テスト音声を dev 入力バケットに1つ置く）→ Firestore/DB 反映と Discord 通知を確認。
5. 💻 UI dev を再デプロイ（develop への push で CD 起動）→ ログイン・チャンネル/エピソード表示・アップロードを確認。
6. ✅ **E2E**: dev で「アップロード → 処理 → エピソード completed → RSS 反映」まで通す。

**ロールバック（dev）**: `DATABASE_URL` Secret を前バージョンに戻す＋UI env を connector に戻して再デプロイ。Cloud SQL dev は生きているので数分で復帰。

---

## Stage 3 — prod：切替 ＋ 検証（慎重に）

Stage 1〜2 と同一だが、**本番** かつ **dev で踏んだ CD リビジョン衝突を回避**するため順序を明示する。

**3-1. prod 準備（非破壊）**
- 👤 Supabase prod プロジェクト作成（`sparkcast-prod` / 東京 / Free）。パスワードを安全保管。
- 💻 Supabase prod の Session pooler URL を Secret Manager `supabase-database-url-prod`（prod プロジェクト）に格納・接続実証。
- 💻 移行元 prod Cloud SQL（`podcast-automator-postgres-prod`, db `podcast`, user `podcast_app`, パスワード secret `podcast-automator-database-password-prod`）から **切替直前に** `pg_dump`（proxy 経由）→ Supabase prod へ `pg_restore` → 行数照合。
  - 👤 収録が無い時間帯に実施（短いダウンタイム想定）。直前ダンプで差分を取り込む。

**3-2. prod 切替**
- 🤖 `infra/environments/prod/variables.tfvars` の `database_url_secret_name` を `supabase-database-url-prod` に変更 → `main` へ PR。
- ⚠️ **CD 衝突の先回り回避（重要）**: `main` マージで `ui`+`infra` が並行し dev と同じ 409 が起きる。**マージ直後に**次を実行して live を TF 目標構成へ収束させ、その後 infra ジョブを再実行する（refresh 差分ゼロで成功）:
  ```sh
  gcloud run services update podcast-ui-prod --project=sunabalog-prod --region=asia-northeast1 \
    --remove-env-vars=CLOUD_SQL_INSTANCE_CONNECTION_NAME,DB_NAME,DB_USER \
    --remove-secrets=DB_PASSWORD \
    --update-secrets=DATABASE_URL=supabase-database-url-prod:latest
  ```
  - （恒久対策を先に入れる場合は「実行結果ログ」の案a/案bを Stage 3 の前に別 PR で実施）
- ✅ prod で E2E を1本通す（本番 UI ログイン→データ表示）。
- **ロールバック**: UI env を connector に戻す（`--update-secrets`/`--set-env-vars` で復元）＋ tfvars revert。Cloud SQL prod は**まだ消さない**。

---

## Stage 4 — バックアップ手当（無料枠はバックアップ無し）

- 🤖 日次 `pg_dump` → GCS 保存の Cloud Scheduler ジョブを追加（TF）。dev/prod 両方。
- ✅ 手動実行で GCS にダンプが出力されることを確認。

---

## Stage 5 — 後片付け ＋ Cloud SQL 削除（両env検証後に1回・不可逆）

**前提**: dev/prod とも Supabase で数日〜1週間、安定稼働を確認済みであること。

1. 🤖 Terraform から Cloud SQL 一式を削除:
   - `infra/cloud_sql.tf`（instance / database / user / password random / socket 前提の記述）
   - `infra/job.tf` の `cloud_sql_instances`（automator のソケットマウント）
   - `infra/iam.tf` / `infra/ui_iam.tf` の `roles/cloudsql.client`
   - `infra/locals.tf` の `sqladmin.googleapis.com`（不要なら）
2. 💻 dev に `terraform apply`（インスタンス削除が計画に出ることを確認してから承認）。
3. 💻 prod は `deletion_protection = true` のため、まず解除してから apply。
4. ✅ 課金コンソールで Cloud SQL 料金が止まったことを確認（数日後）。

**ロールバックはこの Stage 以降は不可**（インスタンス削除は不可逆）。だから Stage 4 までで確信を得てから実施する。

---

## 完了条件（Issue #90）

- [ ] ui / automator が dev・prod とも Supabase の Postgres で正常動作
- [ ] Cloud SQL（dev / prod）削除、課金停止
- [ ] 日次バックアップ（pg_dump → GCS）稼働

## PR の分け方（docs ルール）

大きいので `feature/90` から段階的に PR を出す想定:
1. 本手順書＋TF小改修（Secret 値を手動管理へ）＋UI CD の Supabase 対応（Stage 2 の 1・3）
2. バックアップ cron（Stage 4）
3. Cloud SQL 撤去（Stage 5）

いずれも PR 本文に `#90` を記載して紐づける（最後の撤去 PR で `Close #90`）。

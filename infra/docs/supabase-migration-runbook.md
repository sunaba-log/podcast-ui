# Supabase 移行 手順書（Issue #90）

> **進捗（2026-07-31）**
> - ✅ **Stage 1（dev データ移行）完了**。Supabase `sparkcast-dev`（ref `jsxhsxvpzszdtjolqsyv` / 東京 / Free）を作成し、Cloud SQL dev の全7テーブルを移行（行数一致を確認: users2 / podcasts7 / podcast_ownerships4 / episodes10 / api_usage_logs5 / pre_registered_emails1 / schema_migrations8）。
> - 接続は **Session pooler（IPv4）** `aws-0-ap-northeast-1.pooler.supabase.com:5432` / user `postgres.jsxhsxvpzszdtjolqsyv` / `sslmode=require`（Direct は IPv6 専用のため不可）。
> - 検証済みの完全 DATABASE_URL を Secret Manager `supabase-database-url-dev`（dev プロジェクト）に格納・接続実証済み。
> - 既存 dev には未変更（Cloud SQL 稼働のまま＝ロールバック可）。**次は Stage 2（dev 切替）**。


Cloud SQL（PostgreSQL・常時課金 月約 $27）を廃止し、Supabase 無料枠の PostgreSQL へ移行する。
**dev を先に完全に通してから prod**、という順で進める。破壊的操作（Cloud SQL 削除）は両環境の切替・検証が終わった最後に 1 回だけ行う。

> この手順書は「一緒に実行する台本」です。各ステップに担当を明記します。
> 👤=あなたが操作 / 💻=コマンド実行（`!` で session 内可） / 🤖=Claude がリポジトリを編集 / ✅=動作確認

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

Stage 1〜2 と同一手順を prod で。追加の注意:

- 👤 収録が無い時間帯に実施（短いダウンタイム想定）。
- 💻 prod の DB パスワード Secret 名は `podcast-automator-database-password-prod`。
- 💻 切替直前にもう一度 `pg_dump`（差分を取り込むため直前ダンプ）→ Supabase prod へ。
- ✅ prod で E2E を1本通してから次へ。
- **ロールバック**: dev と同じ。Cloud SQL prod は**まだ消さない**。

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

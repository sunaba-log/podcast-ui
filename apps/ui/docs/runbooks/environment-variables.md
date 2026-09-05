# Environment Variables Runbook

## Purpose

This document explains how to prepare `podcast-ui/.env.local` without sharing
real secret values, and where each value lives in the deployed environment.
Share this runbook and `.env.example`, not `.env.local`.

## Source of Truth

Deployed (Cloud Run) configuration lives in `infra/cloud-run.tf`. Secrets are
referenced from GCP Secret Manager, and `NEXT_PUBLIC_*` build-time values are
injected by the GitHub Actions workflows (`.github/workflows/`).

| Variable | Required | Local source | Deployed source | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | Local PostgreSQL connection string | Secret Manager (`supabase-database-url-{dev,prod}`) | Supabase 接続文字列。Cloud Run と CI/CD のマイグレーションはどちらもこれを使う（#90 / #120）。 |
| `CLOUD_SQL_INSTANCE_CONNECTION_NAME` | Legacy / optional | GCP Cloud SQL instance name | 未設定 | 設定されている場合のみ Cloud SQL Connector 経路になる。Supabase 移行後は通常未設定。 |
| `DB_NAME` | Legacy / optional | — | 未設定 | `CLOUD_SQL_INSTANCE_CONNECTION_NAME` 使用時のみ。 |
| `DB_USER` | Legacy / optional | — | 未設定 | `CLOUD_SQL_INSTANCE_CONNECTION_NAME` 使用時のみ。 |
| `DB_PASSWORD` | Legacy / optional | GCP Secret Manager | 未設定 | `CLOUD_SQL_INSTANCE_CONNECTION_NAME` 使用時のみ。Do not paste into docs or chat. |
| `GOOGLE_CLOUD_PROJECT` | Required | GCP project ID | `infra/cloud-run.tf` | `sunabalog-dev` or `sunabalog-prod`. |
| `DEV_ALLOWED_EMAILS` | Optional | team allowlist | `infra/cloud-run.tf`（現在は未設定＝全アカウント許可） | Comma-separated login allowlist. Unset or empty allows all accounts. |
| `GCS_UPLOAD_BUCKET` | Required | GCS bucket name | `infra/cloud-run.tf` | Dev and prod buckets must not be mixed. |
| `GCS_SIGNED_URL_TTL_SECONDS` | Optional | `.env.example` default | `infra/cloud-run.tf` | Defaults to `900` seconds. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Required outside GCP only | SA key for local use | 不要（Cloud Run は ADC で認証） | JSON for server-side Firebase/GCS signing credentials when running outside GCP. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Required | Firebase Console | `.github/workflows/`（build arg） | Public Firebase Web SDK config（ビルド時に埋め込み）. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Required | Firebase Console | `.github/workflows/`（build arg） | Dev は `sunabalog-dev.firebaseapp.com`。モバイルのリダイレクトログインを使う本番は UI ホストを指定する（下記参照）. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Required | Firebase Console | `.github/workflows/`（build arg） | Must match the Firebase project used for auth. |
| `FIREBASE_AUTH_HELPER_DOMAIN` | Optional | Firebase project auth helper domain | `.github/workflows/`（build arg） | Defaults to `${NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`. Used by Next.js rewrites for `/__/auth/*`. |
| `CRON_SECRET` | Required | generated local value | Secret Manager (`cron-secret`) | Cloud Scheduler ジョブが `Authorization: Bearer` で送る値と一致させる。 |
| `ENABLE_GUEST_MODE` | Optional | 通常は未設定（ローカルはモック認証を使う） | gcloud で dev の Cloud Run にのみ設定 | `true` でログイン画面に「ゲストとして試す」を表示し、共有ゲストアカウントで利用可能にする。prod には設定しない。 |
| `GUEST_EMAIL` | Optional | 未設定 | 未設定（デフォルトを使用） | ゲストアカウントのメール。デフォルトは `guest@sunabalog.com`。 |
| `RATE_LIMIT_HOURLY` / `RATE_LIMIT_DAILY` | Optional | 未設定 | 未設定（デフォルト 20 / 100） | ユーザー単位のレート制限。ゲストモード中は全ゲストで共有されるため、審査期間中は dev で引き上げる。 |

## Current Secret Stores

- `infra/cloud-run.tf` / `.github/workflows/`: non-secret runtime/build configuration for the deployed app.
- GCP Secret Manager: `podcast-ui` の `DB_PASSWORD` / `CRON_SECRET`。ほかに
  `podcast-automator` やインフラ共有のシークレット（Cloud SQL, Cloudflare R2,
  Discord, X API など）もここにある。
- GitHub Secrets: GitHub Actions secrets, mainly Discord notifications and
  deployment credentials.

`podcast-ui` local development should copy non-secret values from
`infra/cloud-run.tf` / the workflows, and secret values from GCP Secret Manager.

## How to Create `.env.local`

1. Copy the template:

   ```bash
   cp .env.example .env.local
   ```

2. Fill non-secret values from `infra/cloud-run.tf` / Firebase Console:

   ```text
   GOOGLE_CLOUD_PROJECT
   GCS_UPLOAD_BUCKET
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   FIREBASE_AUTH_HELPER_DOMAIN
   ```

3. Fill secret values from GCP Secret Manager:

   ```text
   DB_PASSWORD
   CRON_SECRET
   ```

   ローカルから Firestore / GCS 署名を使う場合のみ、SA 鍵を
   `FIREBASE_SERVICE_ACCOUNT_JSON` に設定する（Cloud Run では不要）。

4. Set `DATABASE_URL` to your local PostgreSQL.

   デプロイ環境（Cloud Run）と CI/CD のマイグレーションはいずれも Supabase の
   `DATABASE_URL`（Secret Manager `supabase-database-url-{dev,prod}`）を使うため、
   ローカルでも `DATABASE_URL` を使うのがデプロイ環境と同じ経路になる。

   `CLOUD_SQL_INSTANCE_CONNECTION_NAME` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` は
   Cloud SQL Connector 経路のレガシー変数で、設定されている場合のみそちらが優先される。
   Supabase 移行（#90）後は通常設定しない。

5. Never commit `.env.local`.

## Verification

Run the normal checks after preparing environment variables:

```bash
npm run lint
npm test
npm run build
```

For upload testing, use the target environment's matching Cloud SQL database,
GCS bucket, Firebase project, and service account. Mixing dev and prod values
can create signed URLs that fail with GCS `AccessDenied`.

## Firebase Redirect Sign-In on a Custom Host

Mobile browsers may block the cross-origin storage access used by Firebase
`signInWithRedirect()` when the app is served from a host other than
`<project>.firebaseapp.com` while `authDomain` points at
`<project>.firebaseapp.com`. In that state, Google sign-in appears to
complete, but the app returns to `/login` because `getRedirectResult()` is empty
and `/api/auth/session` is never called.

If mobile redirect sign-in is needed, set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to
the serving host (Cloud Run domain) and keep `FIREBASE_AUTH_HELPER_DOMAIN` at
the Firebase helper host. The Next.js rewrite proxies `/__/auth/*` to the
Firebase helper domain. Also make sure Firebase Auth authorized domains include
the serving host, and the Google OAuth client allows this redirect URI:

```text
https://<cloud-run-domain>/__/auth/handler
```

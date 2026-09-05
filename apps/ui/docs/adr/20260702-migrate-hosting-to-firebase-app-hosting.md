---
date: 2026-07-02
status: superseded by 20260703-migrate-hosting-to-cloud-run.md
issue: https://github.com/sunaba-log/podcast-ui/issues/29
---

# ホスティングを Vercel から Firebase App Hosting へ移行する

## 背景

- podcast-ui は Vercel（個人アカウント配下）でホスティングされていたが、チームがその
  アカウントへログインできず、環境変数の変更・再デプロイ・cron 管理を自分たちで行えなかった。
- Cloud SQL / Firestore / GCS / Vertex AI / Firebase Auth など他のリソースはすべて
  GCP（sunabalog-dev）にあり、ホスティングだけが管理外の外部サービスだった。

## 決定

- ホスティングを **Firebase App Hosting** に移行する（backend: `podcast-ui`、
  live branch: `develop` = dev 環境、GitHub 連携で develop への push を自動デプロイ）。
- サーバー側の GCP 認証は `FIREBASE_SERVICE_ACCOUNT_JSON`（SA 鍵の貼り付け）をやめ、
  ランタイム SA + ADC に置き換える。SA 鍵は GCP 外で動かす場合のみ使う。
- cron（cleanup-uploads / reindex-minutes）は Cloud Scheduler に移行する
  （`vercel.json` は削除）。

## 代替案: Cloud Run 直接運用

Terraform 親和性・構成の透明性では Cloud Run が勝るが、Dockerfile・ビルドパイプライン・
CDN 統合を自作する必要がある。本アプリは Next.js 単体で、Firebase（Auth / Firestore）へ
既に依存しているため、Next.js 特化で GitHub 連携・ビルドまでマネージドな App Hosting を
採用した（内部実行基盤は同じ Cloud Run）。

## 帰結・制約

- 環境変数は `apphosting.yaml`（公開値）と Secret Manager（`DB_PASSWORD` / `CRON_SECRET`）で
  管理する。`NEXT_PUBLIC_*` はビルド時埋め込みのため `availability: BUILD` が必要。
- backend・GitHub 連携（Developer Connect）・ランタイム SA
  （`firebase-app-hosting-compute@…`）・IAM・Cloud Scheduler は Terraform
  （`infra/`）で管理する。Terraform 化できないのは GitHub App の初回認可・
  シークレット値の投入・apply の認証のみ。既存のアプリ用 SA
  （`podcast-ui-dev@…`）は GCP 外実行（ローカル等）用に残す。
- App Hosting は東京（asia-northeast1）未対応のため `asia-east1`（台湾）を使う。
  Cloud SQL（東京）とはリージョンをまたぐが、dev 用途では許容する。
- 鍵なし（ADC）での GCS V4 署名付き URL 発行には、ランタイム SA 自身への
  `roles/iam.serviceAccountTokenCreator`（signBlob）が必要。
- Vercel の PR プレビュー環境は失われる。動作確認はローカルまたは dev 環境
  （develop マージ後）で行う。
- Vercel 側のプロジェクト停止は元アカウント所有者の作業として残る。

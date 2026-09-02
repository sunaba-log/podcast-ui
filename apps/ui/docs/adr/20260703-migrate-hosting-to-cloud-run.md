---
date: 2026-07-03
status: accepted
issue: https://github.com/sunaba-log/podcast-ui/issues/29
---

# ホスティングを Cloud Run + GitHub Actions に決定（App Hosting から変更）

## 背景

Vercel からの移行先として一度 Firebase App Hosting を選定し backend まで構築したが
（`20260702-migrate-hosting-to-firebase-app-hosting.md`）、構築の過程で次が確定した。

- **PR ごとのプレビュー環境が提供されない**（backend の live branch 1 本のみ）。
  チームは Vercel の PR プレビュー体験を重視している
- 東京リージョン未対応（asia-east1 のみ、Cloud SQL は東京）
- IaC で扱いづらい挙動が多い（接続は Firebase GitHub App 製のみ可、
  サービスエージェントの権限が条件付き binding では評価されない、等）

## 決定

- ホスティングは **Cloud Run**（`podcast-ui-dev` / asia-northeast1）とし、
  Next.js は `output: "standalone"` + `Dockerfile` でコンテナ化する
- デプロイは **GitHub Actions**（Workload Identity Federation、鍵ファイルなし）
  - develop への push → イメージ build & 本番トラフィックへデプロイ
  - **PR 作成/更新 → `pr-<番号>` のタグ付きリビジョン（no-traffic）をデプロイし、
    プレビュー URL を PR にコメント**。クローズでタグ削除
- サービス定義・Artifact Registry・WIF・Scheduler は Terraform（`infra/`）で管理。
  Cloud Run の image はデプロイ主体が Actions のため `ignore_changes` とする

## マルチ環境（#35）

- dev / prod をプロジェクト単位で分離（`sunabalog-dev` / `sunabalog-prod`）。
  Terraform は `environments/<env>/{backend.conf,variables.tfvars}` で切り替え、
  state バケットも環境ごとに分ける（`make terraform-{plan,apply} ENVIRONMENT=<env>`）。
- デプロイ: dev=`develop` push、prod=`main` push、PR プレビュー=develop 宛 PR。
- Cloud Run の image / revision / traffic は Actions が管理するため terraform は
  `ignore_changes` とし、初期作成のみ担う。

## 帰結・制約

- PR プレビューはタグ付きリビジョン方式のため、**DB 等のバックエンドは dev 環境と共有**
  （Vercel のような環境分離はない）。スキーマ変更を含む PR の確認には注意
- App Hosting 用に作成した backend / traffic / Firebase GitHub App 接続は撤去。
  並行作業由来の残置リソース（DEVELOPER_CONNECT 接続・App Hosting 用 IAM）は
  作業者と確認のうえ別途整理する
- カスタムドメイン（podcast-ui-dev.web.sunabalog.com）の接続は未実施。
  当面は run.app URL を使い、Scheduler の宛先も run.app とする

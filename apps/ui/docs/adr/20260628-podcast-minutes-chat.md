---
date: 2026-06-28
status: accepted
issue: https://github.com/sunaba-log/podcast-ui/issues/18
---

# 配信済み議事録を横断するチャット機能（RAG）の設計

## Context

配信済みエピソードの議事録（Firestore に蓄積）を横断して自然言語で質問できる
チャットアシスタントを追加する。podcast-ui には従来 LLM 連携が無かったため、
LLM プロバイダ・認証・知識参照方式を新規に決める必要があった。
議事録は複数エピソードにまたがるため、横断検索（RAG）を要件とする。

## Decision

- **生成 LLM は Vertex AI 上の Gemini** を `@google/genai` SDK 経由で利用する。
  既存基盤が Google Cloud（Cloud SQL / Firestore / GCS）に寄っており、
  認証・運用を同じ基盤へ統合できるため。
- **認証はサービスアカウントを流用**する。`FIREBASE_SERVICE_ACCOUNT_JSON` /
  `GOOGLE_CLOUD_PROJECT` を Vertex AI の認証にもそのまま使い、Vercel など
  Google Cloud 外でも追加クレデンシャルなしで動かす。未設定時は ADC。
- **横断検索は RAG（embeddings + ベクトル検索）** で行う。
  - 埋め込みモデルは Vertex AI `text-multilingual-embedding-002`（768次元・日本語対応）。
  - **ベクトルストアは Firestore のベクトル検索**（`findNearest` / KNN, COSINE）。
    議事録が既に Firestore にあり追加インフラが不要なため。Cloud SQL + pgvector は
    マネージドインスタンスへの拡張有効化が必要で採用しない。
  - チャンクは `podcasts/{podcastId}/minutes_index` に保存し、エピソード単位の
    議事録ハッシュ（`minutes_index_meta`）で**冪等**に再インデックスする。
- **インデックス作成は管理用 API** `POST /api/chat/reindex`（認証付き）で明示実行する。
  遅延生成は初回質問で全件埋め込みが走り Vercel のタイムアウトに乗りやすいため避ける。
  将来は podcast-automator のエピソード完了フックから叩く拡張を想定。
- **検索失敗 / ヒット無し時は全文コンテキストにフォールバック**し、インデックス未構築でも
  チャットが動作するようにする。
- **API はストリーミング**（`ReadableStream` を `text/plain` で返す）。
  既存ルートと同じ `requireSessionUser` + `requirePodcastAccess` で認証する。

## Consequences

- Vertex AI（生成＋埋め込み）利用分の課金が発生する。モデル・リージョンは
  `VERTEX_AI_MODEL` / `VERTEX_AI_EMBEDDING_MODEL` / `VERTEX_AI_LOCATION` で切り替え可能。
- Firestore に**ベクトルインデックスの作成が必要**（下記）。未作成だと `findNearest` が
  失敗するが、全文フォールバックで縮退動作する。
- 議事録更新後は再インデックスが必要（自動フックは将来対応）。
- 会話履歴は永続化せずクライアント保持のみ（スコープ外）。

### Firestore ベクトルインデックス作成

```bash
gcloud firestore indexes composite create \
  --project=sunabalog-dev \
  --collection-group=minutes_index \
  --query-scope=COLLECTION \
  --field-config=field-path=embedding,vector-config='{"dimension":768,"flat":{}}'
```

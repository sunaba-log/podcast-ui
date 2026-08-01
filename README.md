![SparkCast Logo](docs/images/leader_board.png)

# SparkCast


SparkCast — ポッドキャストの運営を自動化・支援するツールのモノレポ。Web 管理アプリと
音声処理オートメーターを単一リポジトリで管理する。

> 統合の背景と全体計画は [sunaba-log/dev-platform#17](https://github.com/sunaba-log/dev-platform/issues/17) を参照。

## 構成

```
.
├── ui/          # Web 管理アプリ（Next.js / TypeScript）→ Cloud Run Service
├── automator/   # 音声処理オートメーター（Python / uv）→ Cloud Run Job
└── .github/     # パスフィルタ付き CI/CD ＋ 共有 org ワークフロー
```

| ディレクトリ | 役割 | スタック | ランタイム |
| --- | --- | --- | --- |
| [`ui/`](ui/) | チャンネル/エピソード管理、アップロード、議事録・RAG チャット等 | Next.js 16 / React 19 / TS | Cloud Run Service |
| [`automator/`](automator/) | GCS アップロードを起点にした音声変換・AI 解析・RSS/SNS 配信 | Python 3.12 / uv（ffmpeg・pydub） | Cloud Run Job ×3（main / agenda / promoter） |

両者は同一 GCP プロジェクト（`sunabalog-dev` / `sunabalog-prod`）上で、GCS イベント駆動
（Eventarc → Workflows → Job）で連携する。コード共有はなく、契約（Firestore/DB スキーマ・
GCS オブジェクト命名）を通じて疎結合に連携する。

## 開発

各サブプロジェクトの詳細は個別 README を参照。

- Web アプリ: [`ui/README.md`](ui/README.md)
- オートメーター: [`automator/README.md`](automator/README.md) / [`automator/ARCHITECTURE.md`](automator/ARCHITECTURE.md)

## CI/CD

`.github/workflows/` でパスフィルタにより2スタックを分離してビルド・デプロイする。

| ワークフロー | 対象 | トリガー |
| --- | --- | --- |
| `cd.yml` / `pr-preview.yml` | `ui/**` | develop→dev / main→prod、PR プレビュー |
| `ci-automator.yml` / `cd-automator.yml` | `automator/**` | PR/CI、Terraform デプロイ |

> 認証の WIF 一本化・Web アプリ用 Node CI の新設・Terraform state 統合は後続フェーズで実施。

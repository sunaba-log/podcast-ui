![SparkCast Logo](docs/images/leader_board.png)

# SparkCast


SparkCast — ポッドキャストの運営を自動化・支援するツールのモノレポ。Web 管理アプリと
音声処理オートメーターを単一リポジトリで管理する。

> 統合の背景と全体計画は [sunaba-log/dev-platform#17](https://github.com/sunaba-log/dev-platform/issues/17) を参照。

## 構成

```
.
├── apps/
│   ├── ui/        # Web 管理アプリ（Next.js / TypeScript）→ Cloud Run Service
│   └── automator/ # 音声処理オートメーター（Python / uv）→ Cloud Run Job
├── infra/         # Terraform（dev / prod を単一 state で一元管理）
└── .github/       # パスフィルタ付き CI/CD ＋ 共有 org ワークフロー
```

| ディレクトリ | 役割 | スタック | ランタイム |
| --- | --- | --- | --- |
| [`apps/ui/`](apps/ui/) | チャンネル/エピソード管理、アップロード、議事録・RAG チャット等 | Next.js 16 / React 19 / TS | Cloud Run Service |
| [`apps/automator/`](apps/automator/) | GCS アップロードを起点にした音声変換・AI 解析・RSS/SNS 配信 | Python 3.12 / uv（ffmpeg・pydub） | Cloud Run Job ×3（main / agenda / promoter） |
| [`infra/`](infra/) | GCP リソース定義（Cloud Run / GCS / Eventarc / Workflows / Secret 等） | Terraform | — |

両者は同一 GCP プロジェクト（`sunabalog-dev` / `sunabalog-prod`）上で、GCS イベント駆動
（Eventarc → Workflows → Job）で連携する。コード共有はなく、契約（Firestore/DB スキーマ・
GCS オブジェクト命名）を通じて疎結合に連携する。

## 開発

各サブプロジェクトの詳細は個別 README を参照。

- Web アプリ: [`apps/ui/README.md`](apps/ui/README.md)
- オートメーター: [`apps/automator/README.md`](apps/automator/README.md) / [`apps/automator/ARCHITECTURE.md`](apps/automator/ARCHITECTURE.md)

## CI/CD

`.github/workflows/` でパスフィルタにより2スタックを分離してビルド・デプロイする。

| ワークフロー | 対象 | トリガー |
| --- | --- | --- |
| `ci.yml` | `apps/ui/**` / `apps/automator/**` / `infra/**` | PR。パスフィルタで該当スタックのみ検証（必須チェックは `ci-ok`） |
| `pr-preview.yml` | `apps/ui/**` | PR。タグ付きリビジョンでプレビュー配信 |
| `cd.yml` | `apps/ui/**`（deploy） / `infra/**`・`apps/automator/**`（terraform apply） | develop→dev / main→prod |

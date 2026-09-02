---
date: 2026-07-10
status: accepted
issue: https://github.com/sunaba-log/sparkcast/issues/103
---

# dev 環境ゲストモード（ログインなしお試し利用）の設計

## Context

ハッカソン審査で審査員に dev 環境（https://dev.sparkcast.sunabalog.com）を
実際に触ってもらう必要があるが、アプリは Firebase Auth（Google ログイン）→
事前登録制 → 管理者承認の 3 段ゲートで守られており、第三者は利用できない。
既存のモック認証（`/api/auth/mock-session`）は `NODE_ENV !== production`
限定のため、dev の Cloud Run（本番ビルド）では使えない。

## Decision

- **サーバ側フラグ `ENABLE_GUEST_MODE=true` を dev の Cloud Run にのみ設定**し、
  ログイン画面に「ゲストとして試す」ボタンを出す。prod はフラグ未設定＝無効で、
  コードパス自体が 403 になるため影響しない。
- 方式は**共有ゲストアカウント（1 クリックログイン）**とする。
  - URL を開いた瞬間の自動ログインは採らない（管理者が自分でログインする導線
    `/login` の扱いに例外処理が要り複雑になるため）。
  - 訪問者ごとの匿名ユーザー分離も採らない（ユーザー自動生成・掃除の仕組みが
    必要で、審査用途に対して過剰なため）。
- **Cookie 値は固定マーカー（`guest_session`）のみ**とし、誰のセッションかは
  サーバ env（`GUEST_EMAIL`、デフォルト `guest@sunabalog.com`）で解決する。
  セッション Cookie は署名なしの平文のため、Cookie にメール等を載せる方式だと
  偽装で任意ユーザーになりすませる。マーカー方式なら偽装してもゲストにしか
  なれない。
- ゲストの `isAdmin` は **DB や `ADMIN_EMAILS` の内容に関わらず常に `false`**
  とする（誤設定でも管理画面は開かない）。
- ゲスト users 行は「/register からの明示登録のみ」という原則の例外として、
  `POST /api/auth/guest-session` が初回に自動作成する（`approval_status='active'`、
  デフォルトチャンネル付き）。退会操作などで行が消えても、事前登録ゲートを
  ゲストメールに限りバイパスしているため自己修復できる。
- レート制限（`RATE_LIMIT_HOURLY` / `RATE_LIMIT_DAILY`）はユーザー単位のため
  全ゲストで共有になる。審査期間中は dev の env で引き上げて運用する。

## Consequences

- 審査員全員が同じチャンネル・チャット履歴を共有する（審査用途では許容）。
- PR プレビュー環境（`pr-preview.yml` のタグ付きリビジョン）はサービスの env を
  継承するため、dev にフラグを設定すると同様にお試し可能になる。
- 審査終了後は `gcloud run services update podcast-ui-dev --remove-env-vars
  ENABLE_GUEST_MODE,RATE_LIMIT_HOURLY,RATE_LIMIT_DAILY` で無効化できる
  （コード削除は不要）。

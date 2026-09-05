-- ユーザー承認ステータス（管理者が許可するまで AIチャット機能は使用不可）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending_approval';

-- ユーザーごとの API 呼び出しログ（レート制限チェック用）
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  called_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ユーザーごと・エンドポイントごと・時間ごとのクエリ高速化
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_endpoint_time
  ON api_usage_logs (user_id, endpoint, called_at DESC);

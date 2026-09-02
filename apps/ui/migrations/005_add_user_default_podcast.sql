-- ユーザーごとのデフォルトチャンネル。未選択時のフォールバック先に使う。
-- チャンネル削除時は自動的に NULL に戻す。
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_podcast_id INT
  REFERENCES podcasts(podcast_id) ON DELETE SET NULL;

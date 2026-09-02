ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS source_audio_path TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'upload_pending',
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

UPDATE episodes
SET source_audio_path = NULLIF(audio_file_path, '')
WHERE source_audio_path IS NULL;

ALTER TABLE episodes
  ALTER COLUMN audio_file_path DROP NOT NULL;

ALTER TABLE episodes
  DROP CONSTRAINT IF EXISTS episodes_status_valid;

ALTER TABLE episodes
  ADD CONSTRAINT episodes_status_valid
    CHECK (status IN ('upload_pending', 'uploaded', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_episodes_podcast_status
  ON episodes (podcast_id, status, created_at DESC);

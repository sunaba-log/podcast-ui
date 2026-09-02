-- Assumes the podcasts table from docs/schemas/episode-firestore-schema-spec.md exists.
CREATE TABLE IF NOT EXISTS episodes (
  episode_id SERIAL PRIMARY KEY,
  podcast_id INT NOT NULL REFERENCES podcasts(podcast_id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  audio_file_path TEXT,
  duration_seconds INT,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT episodes_duration_seconds_non_negative
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT episodes_published_after_created
    CHECK (published_at IS NULL OR published_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_episodes_podcast_created_at
  ON episodes (podcast_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_episodes_podcast_published_at
  ON episodes (podcast_id, published_at DESC);

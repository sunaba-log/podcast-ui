CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS podcasts (
  podcast_id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  rss_feed_path TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS podcast_ownerships (
  podcast_id INT NOT NULL REFERENCES podcasts(podcast_id),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
  role VARCHAR(50) NOT NULL,
  PRIMARY KEY (podcast_id, user_id),
  CONSTRAINT podcast_ownerships_role_valid CHECK (role IN ('owner', 'editor'))
);

CREATE INDEX IF NOT EXISTS idx_podcast_ownerships_user_role
  ON podcast_ownerships (user_id, role);

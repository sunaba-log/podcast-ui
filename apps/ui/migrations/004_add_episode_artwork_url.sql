ALTER TABLE episodes ADD COLUMN IF NOT EXISTS artwork_url TEXT;

-- Update default podcast cover image
UPDATE podcasts
SET cover_image_url = '/images/default-podcast-cover.png'
WHERE podcast_id = 1;

-- Update a test episode artwork to verify custom artwork fallback
UPDATE episodes
SET artwork_url = '/images/episode-1-cover.png'
WHERE episode_id = (
  SELECT MIN(episode_id) FROM episodes WHERE podcast_id = 1
);


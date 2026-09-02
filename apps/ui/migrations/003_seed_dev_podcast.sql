INSERT INTO podcasts (
  podcast_id,
  title,
  description,
  cover_image_url
)
VALUES (
  1,
  'Podcaster''s DevLog',
  'Development environment podcast managed by podcast-ui.',
  '/images/default-podcast-cover.png'
)
ON CONFLICT (podcast_id) DO UPDATE SET
  cover_image_url = EXCLUDED.cover_image_url;

SELECT setval(
  pg_get_serial_sequence('podcasts', 'podcast_id'),
  GREATEST((SELECT MAX(podcast_id) FROM podcasts), 1)
);

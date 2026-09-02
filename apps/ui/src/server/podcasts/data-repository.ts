import "server-only";
import { getDbPool } from "@/server/db";
import type { PodcastSummary } from "@/types/podcast";

export type Podcast = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  rssFeedPath: string | null;
};

const DEFAULT_COVER_IMAGE_URL = "/images/default-podcast-cover.png";

export async function getPodcast(podcastId: number): Promise<Podcast | null> {
  const result = await (await getDbPool()).query(
    `SELECT podcast_id, title, description, cover_image_url, rss_feed_path
     FROM podcasts
     WHERE podcast_id = $1`,
    [podcastId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.podcast_id,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    rssFeedPath: row.rss_feed_path,
  };
}

export async function listPodcastsForUser(
  userId: string,
): Promise<PodcastSummary[]> {
  const result = await (await getDbPool()).query(
    `SELECT p.podcast_id, p.title, p.description, p.cover_image_url, p.rss_feed_path, o.role
     FROM podcasts p
     JOIN podcast_ownerships o ON o.podcast_id = p.podcast_id
     WHERE o.user_id = $1
       AND o.role IN ('owner', 'editor')
     ORDER BY p.podcast_id`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.podcast_id,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    rssFeedPath: row.rss_feed_path,
    role: row.role,
  }));
}

export async function listAllPodcastIds(): Promise<number[]> {
  const result = await (await getDbPool()).query(
    `SELECT podcast_id FROM podcasts ORDER BY podcast_id`
  );
  return result.rows.map((row) => row.podcast_id);
}

export async function createPodcast(input: {
  title: string;
  description: string | null;
  ownerUserId: string;
}): Promise<Podcast> {
  const client = await (await getDbPool()).connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO podcasts (title, description, cover_image_url)
       VALUES ($1, $2, $3)
       RETURNING podcast_id, title, description, cover_image_url, rss_feed_path`,
      [input.title, input.description, DEFAULT_COVER_IMAGE_URL]
    );
    const row = inserted.rows[0];
    await client.query(
      `INSERT INTO podcast_ownerships (podcast_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [row.podcast_id, input.ownerUserId]
    );
    await client.query("COMMIT");
    return {
      id: row.podcast_id,
      title: row.title,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      rssFeedPath: row.rss_feed_path,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// 登録直後の利用開始用に、所属チャンネルが無ければデフォルトチャンネルを作成する。
// 作成時はそのチャンネルをユーザーのデフォルトにも設定する。
// 選択すべき podcast_id（新規または既存の先頭）を返す。
export async function ensureDefaultChannel(input: {
  userId: string;
  title: string;
}): Promise<number> {
  const existing = await listPodcastsForUser(input.userId);
  if (existing.length > 0) return existing[0].id;
  const podcast = await createPodcast({
    title: input.title,
    description: null,
    ownerUserId: input.userId,
  });
  await setUserDefaultPodcast(input.userId, podcast.id);
  return podcast.id;
}

// ユーザーのデフォルトチャンネル（未選択時のフォールバック先）。
export async function getUserDefaultPodcastId(
  userId: string,
): Promise<number | null> {
  const result = await (await getDbPool()).query<{ default_podcast_id: number | null }>(
    "SELECT default_podcast_id FROM users WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.default_podcast_id ?? null;
}

// アクセス権は呼び出し側で確認する。
export async function setUserDefaultPodcast(
  userId: string,
  podcastId: number,
): Promise<void> {
  await (await getDbPool()).query(
    "UPDATE users SET default_podcast_id = $2 WHERE user_id = $1",
    [userId, podcastId],
  );
}

// 同一ユーザーが所有するチャンネル内で同名が既に存在するか（自分自身は除外可）。
export async function userHasChannelWithTitle(
  userId: string,
  title: string,
  excludePodcastId?: number,
): Promise<boolean> {
  const result = await (await getDbPool()).query(
    `SELECT 1
     FROM podcasts p
     JOIN podcast_ownerships o ON o.podcast_id = p.podcast_id
     WHERE o.user_id = $1
       AND o.role = 'owner'
       AND lower(p.title) = lower($2)
       AND ($3::int IS NULL OR p.podcast_id <> $3)
     LIMIT 1`,
    [userId, title, excludePodcastId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function isPodcastOwner(
  userId: string,
  podcastId: number,
): Promise<boolean> {
  const result = await (await getDbPool()).query(
    `SELECT 1 FROM podcast_ownerships
     WHERE user_id = $1 AND podcast_id = $2 AND role = 'owner'`,
    [userId, podcastId],
  );
  return result.rowCount === 1;
}

export async function updatePodcast(input: {
  podcastId: number;
  title: string;
  description: string | null;
  // undefined のときは rss_feed_path を変更しない
  rssFeedPath?: string | null;
}): Promise<void> {
  if (input.rssFeedPath === undefined) {
    await (await getDbPool()).query(
      `UPDATE podcasts SET title = $2, description = $3 WHERE podcast_id = $1`,
      [input.podcastId, input.title, input.description],
    );
    return;
  }
  await (await getDbPool()).query(
    `UPDATE podcasts SET title = $2, description = $3, rss_feed_path = $4
     WHERE podcast_id = $1`,
    [input.podcastId, input.title, input.description, input.rssFeedPath],
  );
}

// チャンネルを削除する。エピソードと所有権も併せて削除する
// （Firestore 側の議事録等は別途整理が必要）。
export async function deletePodcast(podcastId: number): Promise<void> {
  const client = await (await getDbPool()).connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM episodes WHERE podcast_id = $1", [podcastId]);
    await client.query("DELETE FROM podcast_ownerships WHERE podcast_id = $1", [
      podcastId,
    ]);
    await client.query("DELETE FROM podcasts WHERE podcast_id = $1", [podcastId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

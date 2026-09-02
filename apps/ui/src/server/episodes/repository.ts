import "server-only";

import type { Pool, PoolClient } from "pg";
import { getDbPool } from "@/server/db";

type CreateEpisodeRecordInput = {
  podcastId: number;
  title?: string;
  description?: string;
  fileName: string;
};

function buildProvisionalTitle(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? "";
  const title = baseName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKC")
    .replace(/[_-]+/g, " ")
    .trim();

  return (title || "Untitled episode").slice(0, 255);
}

export async function createEpisodeRecord(
  client: PoolClient,
  input: CreateEpisodeRecordInput,
): Promise<number> {
  const title = input.title?.trim() || buildProvisionalTitle(input.fileName);
  const result = await client.query<{ episode_id: number }>(
    `INSERT INTO episodes (podcast_id, title, description, status)
     VALUES ($1, $2, $3, 'upload_pending')
     RETURNING episode_id`,
    [input.podcastId, title, input.description ?? null],
  );
  return result.rows[0].episode_id;
}

export async function setEpisodeAudioFilePath(
  client: PoolClient,
  episodeId: number,
  objectPath: string,
): Promise<void> {
  await client.query(
    `UPDATE episodes
     SET source_audio_path = $1, updated_at = now()
     WHERE episode_id = $2`,
    [objectPath, episodeId],
  );
}

export async function markEpisodeUploadResult(
  episodeId: number,
  status: "uploaded" | "failed",
  errorMessage?: string,
  pool?: Pick<Pool, "query">,
): Promise<boolean> {
  const result = await (pool ?? (await getDbPool())).query(
    `UPDATE episodes
     SET status = $1,
         processing_error = $2,
         updated_at = now()
     WHERE episode_id = $3 AND status = 'upload_pending'`,
    [status, errorMessage ?? null, episodeId],
  );
  return result.rowCount === 1;
}

export async function markAbandonedUploadsFailed(
  olderThanMinutes: number,
  pool?: Pick<Pool, "query">,
): Promise<number> {
  const result = await (pool ?? (await getDbPool())).query(
    `UPDATE episodes
     SET status = 'failed',
         processing_error = 'Upload result was not received before the timeout.',
         processing_completed_at = now(),
         updated_at = now()
     WHERE status = 'upload_pending'
       AND created_at < now() - ($1 * interval '1 minute')`,
    [olderThanMinutes],
  );
  return result.rowCount ?? 0;
}

import type { Pool, PoolClient } from "pg";
import type {
  CreateEpisodeUploadInput,
  CreateEpisodeUploadResponse,
} from "@/server/episodes/upload-contract";
import { buildEpisodeSourceObjectPath } from "@/server/episodes/upload-contract";

type Dependencies = {
  pool: Pick<Pool, "connect">;
  signUpload: (objectPath: string) => Promise<{ uploadUrl: string; expiresAt: Date }>;
  createRecord: (client: PoolClient, input: CreateEpisodeUploadInput) => Promise<number>;
  setAudioPath: (client: PoolClient, episodeId: number, objectPath: string) => Promise<void>;
};

export async function createEpisodeUpload(
  input: CreateEpisodeUploadInput,
  dependencies: Dependencies,
): Promise<CreateEpisodeUploadResponse> {
  const client = (await dependencies.pool.connect()) as PoolClient;
  try {
    await client.query("BEGIN");
    const episodeId = await dependencies.createRecord(client, input);
    const objectPath = buildEpisodeSourceObjectPath(
      input.podcastId,
      episodeId,
      input.fileName,
    );
    await dependencies.setAudioPath(client, episodeId, objectPath);
    const { uploadUrl, expiresAt } = await dependencies.signUpload(objectPath);
    await client.query("COMMIT");

    return {
      episodeId,
      podcastId: input.podcastId,
      objectPath,
      uploadUrl,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

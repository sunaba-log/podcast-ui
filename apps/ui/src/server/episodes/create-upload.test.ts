import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createEpisodeUpload } from "@/server/episodes/create-upload";

function createClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

const input = {
  podcastId: 7,
  title: "New episode",
  description: "Description",
  fileName: "recording.mp3",
  contentType: "audio/mpeg" as const,
  fileSize: 1024,
};

describe("createEpisodeUpload", () => {
  it("creates an episode and signs its contract object path in one transaction", async () => {
    const client = createClient();
    const createRecord = vi.fn().mockResolvedValue(42);
    const setAudioPath = vi.fn().mockResolvedValue(undefined);
    const signUpload = vi.fn().mockResolvedValue({
      uploadUrl: "https://storage.example/upload",
      expiresAt: new Date("2026-06-12T00:15:00.000Z"),
    });

    const result = await createEpisodeUpload(input, {
      pool: { connect: vi.fn().mockResolvedValue(client) },
      createRecord,
      setAudioPath,
      signUpload,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(setAudioPath).toHaveBeenCalledWith(
      client,
      42,
      "podcasts/7/episodes/42/source/recording.mp3",
    );
    expect(signUpload).toHaveBeenCalledWith(
      "podcasts/7/episodes/42/source/recording.mp3",
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
    expect(result.episodeId).toBe(42);
  });

  it("preserves m4a filenames for signed uploads", async () => {
    const client = createClient();
    const signUpload = vi.fn().mockResolvedValue({
      uploadUrl: "https://storage.example/upload",
      expiresAt: new Date("2026-06-12T00:15:00.000Z"),
    });

    await createEpisodeUpload(
      { ...input, fileName: "recording.m4a", contentType: "audio/mp4" },
      {
        pool: { connect: vi.fn().mockResolvedValue(client) },
        createRecord: vi.fn().mockResolvedValue(42),
        setAudioPath: vi.fn().mockResolvedValue(undefined),
        signUpload,
      },
    );

    expect(signUpload).toHaveBeenCalledWith(
      "podcasts/7/episodes/42/source/recording.m4a",
    );
  });

  it("rolls back when signing fails", async () => {
    const client = createClient();

    await expect(
      createEpisodeUpload(input, {
        pool: { connect: vi.fn().mockResolvedValue(client) },
        createRecord: vi.fn().mockResolvedValue(42),
        setAudioPath: vi.fn().mockResolvedValue(undefined),
        signUpload: vi.fn().mockRejectedValue(new Error("signing failed")),
      }),
    ).rejects.toThrow("signing failed");

    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});

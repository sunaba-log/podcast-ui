import { describe, expect, it, vi } from "vitest";
import {
  createEpisodeRecord,
  markAbandonedUploadsFailed,
  markEpisodeUploadResult,
} from "@/server/episodes/repository";

describe("createEpisodeRecord", () => {
  it("uses the provided title when present", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ episode_id: 42 }] }),
    };

    await expect(
      createEpisodeRecord(client as never, {
        podcastId: 7,
        title: "Manual title",
        fileName: "recording.m4a",
      }),
    ).resolves.toBe(42);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO episodes"),
      [7, "Manual title", null],
    );
  });

  it("uses a provisional filename title when title is omitted", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ episode_id: 42 }] }),
    };

    await createEpisodeRecord(client as never, {
      podcastId: 7,
      fileName: "devlog_recording-01.m4a",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO episodes"),
      [7, "devlog recording 01", null],
    );
  });
});

describe("markEpisodeUploadResult", () => {
  it("updates only an episode still waiting for upload", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });

    const updated = await markEpisodeUploadResult(
      42,
      "uploaded",
      undefined,
      { query },
    );

    expect(updated).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'upload_pending'"),
      ["uploaded", null, 42],
    );
  });

  it("does not overwrite an automator processing state", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0 });

    await expect(
      markEpisodeUploadResult(42, "failed", "network error", { query }),
    ).resolves.toBe(false);
  });
});

describe("markAbandonedUploadsFailed", () => {
  it("fails only timed-out pending uploads", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3 });

    await expect(
      markAbandonedUploadsFailed(60, { query }),
    ).resolves.toBe(3);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'upload_pending'"),
      [60],
    );
  });
});

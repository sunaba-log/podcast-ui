import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import {
  addPreRegisteredEmail,
  isEmailPreRegistered,
  listPreRegisteredEmails,
  removePreRegisteredEmail,
} from "@/server/admin/pre-registered-emails-repository";

const mockPool = {
  query: vi.fn(),
} as unknown as Pool;

describe("pre-registered-emails-repository", () => {
  beforeEach(() => {
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("listPreRegisteredEmails", () => {
    it("maps rows to camelCase", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ email: "foo@example.com", created_at: "2026-07-05T00:00:00Z" }],
      });

      const result = await listPreRegisteredEmails(mockPool);

      expect(result).toEqual([
        { email: "foo@example.com", createdAt: "2026-07-05T00:00:00Z" },
      ]);
    });
  });

  describe("addPreRegisteredEmail", () => {
    it("trims, lowercases and inserts with ON CONFLICT DO NOTHING", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rowCount: 1,
      });

      await addPreRegisteredEmail(mockPool, " Foo@Example.COM ");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (email) DO NOTHING"),
        ["foo@example.com"],
      );
    });
  });

  describe("removePreRegisteredEmail", () => {
    it("deletes with lowercased email", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rowCount: 0,
      });

      await removePreRegisteredEmail(mockPool, "Foo@Example.com");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM pre_registered_emails"),
        ["foo@example.com"],
      );
    });
  });

  describe("isEmailPreRegistered", () => {
    it("returns true when a row exists", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ "?column?": 1 }],
      });

      await expect(
        isEmailPreRegistered(mockPool, "foo@example.com"),
      ).resolves.toBe(true);
    });

    it("returns false when no row exists and lowercases the lookup", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await expect(
        isEmailPreRegistered(mockPool, "Foo@Example.com"),
      ).resolves.toBe(false);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM pre_registered_emails"),
        ["foo@example.com"],
      );
    });
  });
});

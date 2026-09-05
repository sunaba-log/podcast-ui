import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import type { SessionUser } from "@/server/auth";
import { checkUsageAllowed, recordUsage } from "@/server/usage-limit";

const mockPool = {
  query: vi.fn(),
} as unknown as Pool;

const pendingUser: SessionUser = {
  uid: "user-pending",
  email: "user@example.com",
  displayName: "Test User",
  registered: true,
  approvalStatus: "pending_approval",
  isAdmin: false,
};

const activeUser: SessionUser = {
  uid: "user-active",
  email: "user@example.com",
  displayName: "Test User",
  registered: true,
  approvalStatus: "active",
  isAdmin: false,
};

describe("usage-limit", () => {
  beforeEach(() => {
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("checkUsageAllowed", () => {
    it("allows pending user when under chat limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ count: 2 }],
      });

      const result = await checkUsageAllowed(mockPool, pendingUser, "chat");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("blocks pending user when at chat limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ count: 5 }],
      });

      const result = await checkUsageAllowed(mockPool, pendingUser, "chat");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("お試し枠");
    });

    it("allows pending user when under episode upload limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ count: 1 }],
      });

      const result = await checkUsageAllowed(
        mockPool,
        pendingUser,
        "episode_upload",
      );

      expect(result.allowed).toBe(true);
    });

    it("blocks pending user when at episode upload limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ count: 2 }],
      });

      const result = await checkUsageAllowed(
        mockPool,
        pendingUser,
        "episode_upload",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("お試し枠");
    });

    it("allows active user when under hourly limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ count: 10 }] })
        .mockResolvedValueOnce({ rows: [{ count: 30 }] });

      const result = await checkUsageAllowed(mockPool, activeUser, "chat");

      expect(result.allowed).toBe(true);
    });

    it("blocks active user when at hourly limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ count: 20 }] })
        .mockResolvedValueOnce({ rows: [{ count: 20 }] });

      const result = await checkUsageAllowed(mockPool, activeUser, "chat");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("上限に達しました");
    });

    it("blocks active user when at daily limit", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ count: 10 }] })
        .mockResolvedValueOnce({ rows: [{ count: 100 }] });

      const result = await checkUsageAllowed(mockPool, activeUser, "chat");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("1日");
    });

    it("allows active user for episode upload (no limit)", async () => {
      const result = await checkUsageAllowed(
        mockPool,
        activeUser,
        "episode_upload",
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe("recordUsage", () => {
    it("inserts usage log", async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      await recordUsage(mockPool, "user-123", "chat");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO api_usage_logs"),
        ["user-123", "chat"],
      );
    });
  });
});

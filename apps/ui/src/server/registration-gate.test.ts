import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  isRegistrationAllowed,
  PRE_REGISTRATION_REQUIRED_MESSAGE,
} from "@/server/registration-gate";

const mockPool = {
  query: vi.fn(),
} as unknown as Pool;

describe("registration-gate", () => {
  beforeEach(() => {
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows already registered users without querying the allowlist", async () => {
    const allowed = await isRegistrationAllowed(mockPool, {
      email: "someone@example.com",
      registered: true,
    });

    expect(allowed).toBe(true);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("allows admin emails without querying the allowlist", async () => {
    // ADMIN_EMAILS 未設定時のデフォルトは admin@sunabalog.com
    const allowed = await isRegistrationAllowed(mockPool, {
      email: "admin@sunabalog.com",
      registered: false,
    });

    expect(allowed).toBe(true);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("allows unregistered non-admins when the email is pre-registered", async () => {
    (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ "?column?": 1 }],
    });

    const allowed = await isRegistrationAllowed(mockPool, {
      email: "invited@example.com",
      registered: false,
    });

    expect(allowed).toBe(true);
  });

  it("denies unregistered non-admins when the email is not pre-registered", async () => {
    (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const allowed = await isRegistrationAllowed(mockPool, {
      email: "stranger@example.com",
      registered: false,
    });

    expect(allowed).toBe(false);
  });

  it("allows the guest email without pre-registration when guest mode is enabled", async () => {
    vi.stubEnv("ENABLE_GUEST_MODE", "true");

    const allowed = await isRegistrationAllowed(mockPool, {
      email: "guest@sunabalog.com",
      registered: false,
    });

    expect(allowed).toBe(true);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("denies the guest email when guest mode is disabled and not pre-registered", async () => {
    (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const allowed = await isRegistrationAllowed(mockPool, {
      email: "guest@sunabalog.com",
      registered: false,
    });

    expect(allowed).toBe(false);
  });

  it("keeps the pre-registration message wording", () => {
    expect(PRE_REGISTRATION_REQUIRED_MESSAGE).toContain("事前登録制");
  });
});

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDbPool } from "@/server/db";
import {
  getGuestEmail,
  isAdminUser,
  isGuestModeEnabled,
  isLocalMockAuthEnabled,
} from "@/server/env";
import { getAdminAuth } from "@/server/firebase-admin";

export const SESSION_COOKIE_NAME = "podcast_session";

// ゲストセッションの Cookie 値は固定マーカーのみ。誰のセッションかは
// サーバ env（GUEST_EMAIL）で決めるため、Cookie を偽装してもゲスト以外にはなれない。
export const GUEST_SESSION_COOKIE_VALUE = "guest_session";

export type SessionUser = {
  uid: string;
  email: string;
  displayName: string | null;
  registered: boolean;
  approvalStatus: "pending_approval" | "active";
  isAdmin: boolean;
};

export function mockUidForEmail(email: string): string {
  return "dev_mock_" + email.replace(/[^a-zA-Z0-9]/g, "_");
}

export function guestUidForEmail(email: string): string {
  return "guest_" + email.replace(/[^a-zA-Z0-9]/g, "_");
}

// 管理者はマイグレーション以前から登録済みの行が pending のままでも承認扱いにする
function resolveApprovalStatus(
  email: string,
  rawStatus: string | undefined,
): "pending_approval" | "active" {
  if (isAdminUser(email)) return "active";
  return rawStatus === "active" ? "active" : "pending_approval";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  if (isGuestModeEnabled() && sessionCookie === GUEST_SESSION_COOKIE_VALUE) {
    const email = getGuestEmail();
    try {
      const user = await (await getDbPool()).query<{
        user_id: string;
        display_name: string | null;
        approval_status: string;
      }>("SELECT user_id, display_name, approval_status FROM users WHERE email = $1", [email]);
      const row = user.rows[0];
      return {
        uid: row?.user_id ?? guestUidForEmail(email),
        email,
        displayName: row?.display_name ?? "ゲストユーザー",
        registered: user.rows.length > 0,
        // GUEST_EMAIL が誤って ADMIN_EMAILS に含まれても管理権限は与えない
        approvalStatus: row?.approval_status === "active" ? "active" : "pending_approval",
        isAdmin: false,
      };
    } catch {
      return null;
    }
  }

  if (
    process.env.NODE_ENV !== "production" &&
    isLocalMockAuthEnabled() &&
    sessionCookie.startsWith("mock_session:")
  ) {
    const email = sessionCookie.slice("mock_session:".length).toLowerCase();
    try {
      const user = await (await getDbPool()).query<{
        user_id: string;
        display_name: string | null;
        approval_status: string;
      }>("SELECT user_id, display_name, approval_status FROM users WHERE email = $1", [email]);
      const row = user.rows[0];
      return {
        uid: row?.user_id ?? mockUidForEmail(email),
        email,
        displayName: row?.display_name ?? "Dev Mock User",
        registered: user.rows.length > 0,
        approvalStatus: resolveApprovalStatus(email, row?.approval_status),
        isAdmin: isAdminUser(email),
      };
    } catch {
      return null;
    }
  }

  try {
    const token = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (!token.email) return null;
    const email = token.email.toLowerCase();
    const user = await (await getDbPool()).query<{
      user_id: string;
      display_name: string | null;
      approval_status: string;
    }>("SELECT user_id, display_name, approval_status FROM users WHERE email = $1", [email]);
    const row = user.rows[0];
    return {
      uid: row?.user_id ?? token.uid,
      email,
      displayName:
        row?.display_name ??
        (typeof token.name === "string" ? token.name : null),
      registered: user.rows.length > 0,
      approvalStatus: resolveApprovalStatus(email, row?.approval_status),
      isAdmin: isAdminUser(email),
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

// 未登録ユーザは /register で明示的に登録してから利用する
export async function requireRegisteredUser(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!user.registered) redirect("/register");
  return user;
}

export async function hasPodcastAccess(
  userId: string,
  podcastId: number,
): Promise<boolean> {
  const result = await (await getDbPool()).query(
    `SELECT 1
     FROM podcast_ownerships
     WHERE user_id = $1
       AND podcast_id = $2
       AND role IN ('owner', 'editor')`,
    [userId, podcastId],
  );
  return result.rowCount === 1;
}

export async function requirePodcastAccess(
  userId: string,
  podcastId: number,
): Promise<void> {
  if (!(await hasPodcastAccess(userId, podcastId))) {
    throw new Error("FORBIDDEN");
  }
}

export function requireAdmin(user: SessionUser): void {
  if (!user.isAdmin) {
    throw new Error("FORBIDDEN");
  }
}

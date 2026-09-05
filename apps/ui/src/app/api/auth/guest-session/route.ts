import { NextResponse } from "next/server";
import {
  GUEST_SESSION_COOKIE_VALUE,
  SESSION_COOKIE_NAME,
  guestUidForEmail,
} from "@/server/auth";
import { getDbPool } from "@/server/db";
import { getGuestEmail, isGuestModeEnabled } from "@/server/env";
import { ensureDefaultChannel } from "@/server/podcasts/data-repository";
import {
  SELECTED_PODCAST_COOKIE_NAME,
  selectedPodcastCookieOptions,
} from "@/server/podcasts/selection";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

// ハッカソン審査等のお試し用ゲストログイン。ENABLE_GUEST_MODE を設定した
// 環境（dev のみ）でだけ有効。全ゲストが単一の共有アカウントに入る。
export async function POST() {
  if (!isGuestModeEnabled()) {
    return NextResponse.json(
      { error: "ゲストモードは無効化されています" },
      { status: 403 },
    );
  }

  try {
    const email = getGuestEmail();
    const pool = await getDbPool();

    // ゲストは /register を経由しないため、初回アクセス時にここで登録する。
    // 事前登録・管理者承認のゲートはゲストに限りバイパスする。
    await pool.query(
      `INSERT INTO users (user_id, email, display_name, approval_status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (email) DO NOTHING`,
      [guestUidForEmail(email), email, "ゲストユーザー"],
    );
    const user = await pool.query<{ user_id: string }>(
      "SELECT user_id FROM users WHERE email = $1",
      [email],
    );
    const userId = user.rows[0].user_id;
    const podcastId = await ensureDefaultChannel({
      userId,
      title: "お試しチャンネル",
    });

    const response = NextResponse.json({ ok: true, registered: true });
    response.cookies.set(SESSION_COOKIE_NAME, GUEST_SESSION_COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    response.cookies.set(
      SELECTED_PODCAST_COOKIE_NAME,
      String(podcastId),
      selectedPodcastCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Failed to create guest session", error);
    return NextResponse.json(
      { error: "ゲストログインに失敗しました" },
      { status: 500 },
    );
  }
}

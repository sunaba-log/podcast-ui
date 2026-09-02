import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { getAllowedDevEmails, isLocalMockAuthEnabled } from "@/server/env";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST() {
  if (process.env.NODE_ENV === "production" || !isLocalMockAuthEnabled()) {
    return NextResponse.json(
      { error: "ローカル開発用モック認証は無効化されています" },
      { status: 403 },
    );
  }

  try {
    const email = getAllowedDevEmails()[0] ?? "admin@sunabalog.com";

    // ユーザ登録は /register からの明示的な操作でのみ行う（暗黙の自動登録はしない）
    const existingUser = await (await getDbPool()).query(
      "SELECT 1 FROM users WHERE email = $1",
      [email],
    );
    const registered = (existingUser.rowCount ?? 0) > 0;

    const mockSessionCookie = `mock_session:${email}`;
    const response = NextResponse.json({ ok: true, registered });
    response.cookies.set(SESSION_COOKIE_NAME, mockSessionCookie, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error("Failed to create mock auth session", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `モックログインに失敗しました (${message})` },
      { status: 500 },
    );
  }
}

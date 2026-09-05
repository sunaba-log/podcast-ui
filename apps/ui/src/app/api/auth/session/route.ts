import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { SESSION_COOKIE_NAME } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { isEmailAllowed } from "@/server/env";
import { getAdminAuth } from "@/server/firebase-admin";
import { SELECTED_PODCAST_COOKIE_NAME } from "@/server/podcasts/selection";

const requestSchema = z.object({
  idToken: z.string().min(1),
});
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { idToken } = requestSchema.parse(await request.json());
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase();
    if (!email || !isEmailAllowed(email)) {
      return NextResponse.json(
        { error: "このdev環境へのアクセスは許可されていません" },
        { status: 403 },
      );
    }

    // ユーザ登録は /register からの明示的な操作でのみ行う（暗黙の自動登録はしない）
    const existingUser = await (await getDbPool()).query(
      "SELECT 1 FROM users WHERE email = $1",
      [email],
    );
    const registered = (existingUser.rowCount ?? 0) > 0;

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const response = NextResponse.json({ ok: true, registered });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to create auth session", {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(SELECTED_PODCAST_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

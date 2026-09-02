import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { getContactEmail, isAdminUser } from "@/server/env";
import {
  isRegistrationAllowed,
  PRE_REGISTRATION_REQUIRED_MESSAGE,
} from "@/server/registration-gate";
import { ensureDefaultChannel } from "@/server/podcasts/data-repository";
import {
  SELECTED_PODCAST_COOKIE_NAME,
  selectedPodcastCookieOptions,
} from "@/server/podcasts/selection";

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    if (!(await isRegistrationAllowed(await getDbPool(), user))) {
      return NextResponse.json(
        {
          error: PRE_REGISTRATION_REQUIRED_MESSAGE,
          contactEmail: getContactEmail(),
        },
        { status: 403 },
      );
    }
    const { displayName } = displayNameSchema.parse(await request.json());
    const approvalStatus = isAdminUser(user.email) ? "active" : "pending_approval";
    await (await getDbPool()).query(
      `INSERT INTO users (user_id, email, display_name, approval_status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET display_name = EXCLUDED.display_name`,
      [user.uid, user.email, displayName, approvalStatus],
    );
    // 登録直後から使えるよう、チャンネルが無ければデフォルトを作成し選択する
    const podcastId = await ensureDefaultChannel({
      userId: user.uid,
      title: `${displayName}のチャンネル`,
    });
    const response = NextResponse.json({ ok: true, podcastId }, { status: 201 });
    response.cookies.set(
      SELECTED_PODCAST_COOKIE_NAME,
      String(podcastId),
      selectedPodcastCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to register user", error);
    return NextResponse.json(
      { error: "ユーザ登録に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    if (!user.registered) {
      return NextResponse.json({ error: "ユーザ登録が必要です" }, { status: 403 });
    }
    const { displayName } = displayNameSchema.parse(await request.json());
    await (await getDbPool()).query(
      "UPDATE users SET display_name = $2 WHERE user_id = $1",
      [user.uid, displayName],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to update user", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// 退会。ユーザーの所有権とユーザーレコードを削除し、セッションを破棄する。
// 単独 owner だったチャンネル自体は削除しない（他 owner がいる場合を保護。
// owner が居なくなったチャンネルは一覧に出なくなる）。
export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const client = await (await getDbPool()).connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM podcast_ownerships WHERE user_id = $1",
        [user.uid],
      );
      await client.query("DELETE FROM users WHERE user_id = $1", [user.uid]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const response = NextResponse.json({ ok: true });
    for (const name of [SESSION_COOKIE_NAME, SELECTED_PODCAST_COOKIE_NAME]) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    console.error("Failed to delete user", error);
    return NextResponse.json({ error: "退会に失敗しました" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import {
  deletePodcast,
  isPodcastOwner,
  updatePodcast,
  userHasChannelWithTitle,
} from "@/server/podcasts/data-repository";
import {
  getSelectedPodcastId,
  SELECTED_PODCAST_COOKIE_NAME,
} from "@/server/podcasts/selection";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  rssFeedPath: z.string().trim().max(2000).optional(),
});

function parsePodcastId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const podcastId = parsePodcastId((await context.params).id);
    if (!podcastId) {
      return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
    }
    if (!(await isPodcastOwner(user.uid, podcastId))) {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    const input = updateSchema.parse(await request.json());
    if (await userHasChannelWithTitle(user.uid, input.title, podcastId)) {
      return NextResponse.json(
        { error: "同じ名前のチャンネルが既に存在します" },
        { status: 409 },
      );
    }
    await updatePodcast({
      podcastId,
      title: input.title,
      description: input.description || null,
      rssFeedPath:
        input.rssFeedPath === undefined ? undefined : input.rssFeedPath || null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to update podcast", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const podcastId = parsePodcastId((await context.params).id);
    if (!podcastId) {
      return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
    }
    if (!(await isPodcastOwner(user.uid, podcastId))) {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    await deletePodcast(podcastId);

    const response = NextResponse.json({ ok: true });
    // 選択中チャンネルを削除した場合は選択を解除する
    if ((await getSelectedPodcastId()) === podcastId) {
      response.cookies.set(SELECTED_PODCAST_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    console.error("Failed to delete podcast", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

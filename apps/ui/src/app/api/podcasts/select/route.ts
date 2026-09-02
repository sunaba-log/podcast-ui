import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, requirePodcastAccess } from "@/server/auth";
import {
  SELECTED_PODCAST_COOKIE_NAME,
  selectedPodcastCookieOptions,
} from "@/server/podcasts/selection";

const requestSchema = z.object({
  podcastId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { podcastId } = requestSchema.parse(await request.json());
    await requirePodcastAccess(user.uid, podcastId);
    const response = NextResponse.json({ ok: true });
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
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to select podcast", error);
    return NextResponse.json(
      { error: "チャンネルの切り替えに失敗しました" },
      { status: 500 },
    );
  }
}

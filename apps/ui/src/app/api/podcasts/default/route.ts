import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, hasPodcastAccess } from "@/server/auth";
import { setUserDefaultPodcast } from "@/server/podcasts/data-repository";

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
    if (!(await hasPodcastAccess(user.uid, podcastId))) {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    await setUserDefaultPodcast(user.uid, podcastId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to set default podcast", error);
    return NextResponse.json(
      { error: "デフォルト設定に失敗しました" },
      { status: 500 },
    );
  }
}

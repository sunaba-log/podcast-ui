import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import { requireSelectedPodcastForApi } from "@/server/podcasts/selection";
import {
  findEpisode,
  updateEpisodeGeneratedContent,
} from "@/server/episodes/data-repository";

const updateSchema = z.object({
  minutes: z.string().max(200_000).optional(),
  promotions: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        message: z.string().max(10_000),
      }),
    )
    .optional(),
});

async function authorize() {
  const user = await getSessionUser();
  if (!user) return null;
  const podcastId = await requireSelectedPodcastForApi(user);
  return { user, podcastId };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const episodeId = Number((await context.params).id);
    const episode = await findEpisode(auth.podcastId, episodeId);
    if (!episode) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(episode);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_PODCAST_SELECTED") {
      return NextResponse.json(
        { error: "チャンネルが選択されていません" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to load episode", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const episodeId = Number((await context.params).id);
    if (!Number.isInteger(episodeId) || episodeId <= 0) {
      return NextResponse.json({ error: "episode IDが不正です" }, { status: 400 });
    }
    if (!(await findEpisode(auth.podcastId, episodeId))) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    const input = updateSchema.parse(await request.json());
    await updateEpisodeGeneratedContent({
      podcastId: auth.podcastId,
      episodeId,
      minutes: input.minutes,
      promotions: input.promotions,
      updatedBy: auth.user.uid,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "NO_PODCAST_SELECTED") {
      return NextResponse.json(
        { error: "チャンネルが選択されていません" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to update episode", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

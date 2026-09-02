import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import { requireSelectedPodcastForApi } from "@/server/podcasts/selection";
import { updateTopicProposal } from "@/server/topic-proposals/repository";

const updateSchema = z.object({
  relatedNews: z.array(
    z.object({
      title: z.string().max(500),
      url: z.string().max(2000),
      summary: z.string().max(20_000),
      sourceReason: z.string().max(5000),
    }),
  ),
  suggestedTopics: z.array(
    z.object({
      title: z.string().max(500),
      description: z.string().max(20_000),
      suggestedPoints: z.array(z.string().max(5000)),
      relatedPastEpisodes: z.array(z.number().int().positive()),
    }),
  ),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const podcastId = await requireSelectedPodcastForApi(user);
    const input = updateSchema.parse(await request.json());
    await updateTopicProposal({
      podcastId,
      proposalId: (await context.params).id,
      relatedNews: input.relatedNews,
      suggestedTopics: input.suggestedTopics,
      updatedBy: user.uid,
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
    console.error("Failed to update topic proposal", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { requireSelectedPodcastForApi } from "@/server/podcasts/selection";
import { reindexPodcastKnowledge } from "@/server/chat/reindex";
import { getDbPool } from "@/server/db";
import { checkUsageAllowed, recordUsage } from "@/server/usage-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize() {
  const user = await getSessionUser();
  if (!user) return null;
  const podcastId = await requireSelectedPodcastForApi(user);
  return { user, podcastId };
}

export async function POST() {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const pool = await getDbPool();
    const usageCheck = await checkUsageAllowed(pool, auth.user, "chat");
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.reason }, { status: 429 });
    }

    await recordUsage(pool, auth.user.uid, "chat");

    const result = await reindexPodcastKnowledge(auth.podcastId);
    return NextResponse.json({ ok: true, ...result });
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
    console.error("Failed to reindex minutes", error);
    return NextResponse.json(
      { error: "インデックス作成に失敗しました" },
      { status: 500 },
    );
  }
}

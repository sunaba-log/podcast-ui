import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { requireSelectedPodcastForApi } from "@/server/podcasts/selection";
import {
  listEpisodesAndPromotionsPaginated,
  updateSnsPromotion,
  deleteSnsPromotion,
} from "@/server/episodes/data-repository";
import type { Episode, EpisodePromotion } from "@/types/episode";
import type { SNSPostItem } from "@/components/SNSPostMasterDetail";

export function mapToSNSPostItem(ep: Episode, p: EpisodePromotion): SNSPostItem {
  const schedTime = p.scheduledTime ? new Date(p.scheduledTime) : new Date(p.generatedAt || ep.createdAt);

  const yyyy = String(schedTime.getFullYear());
  const mm = String(schedTime.getMonth() + 1).padStart(2, "0");
  const dd = String(schedTime.getDate()).padStart(2, "0");
  const hh = String(schedTime.getHours()).padStart(2, "0");
  const min = String(schedTime.getMinutes()).padStart(2, "0");

  return {
    id: p.id,
    episodeId: ep.id,
    episodeTitle: ep.title,
    status: p.status === "posted" ? "posted" : "pending",
    scheduledDate: { yyyy, mm, dd, hh, min },
    message: p.message,
    platformUrls: {
      apple: p.platformUrls?.apple ?? "",
      amazon: p.platformUrls?.amazon ?? "",
      spotify: p.platformUrls?.spotify ?? "",
    },
    hashtags: p.hashtags ?? [],
    generatedAt: p.generatedAt ?? ep.createdAt,
    updatedAt: p.updatedAt ?? ep.createdAt,
  };
}

async function authorize() {
  const user = await getSessionUser();
  if (!user) return null;
  const podcastId = await requireSelectedPodcastForApi(user);
  return { user, podcastId };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "5")));
    const offset = Math.max(0, Number(searchParams.get("offset") || "0"));

    const { episodes, hasMore } = await listEpisodesAndPromotionsPaginated(
      auth.podcastId,
      limit,
      offset
    );

    const posts: SNSPostItem[] = episodes.flatMap((ep) =>
      ep.xPosts.map((p) => mapToSNSPostItem(ep, p))
    );

    return NextResponse.json({ posts, hasMore });
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
    console.error("Failed to load sns promotions", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { episodeId, id, message, status, scheduledTime, platformUrls, hashtags } = body;

    if (!episodeId || !id) {
      return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
    }

    await updateSnsPromotion({
      podcastId: auth.podcastId,
      episodeId: Number(episodeId),
      promotionId: id,
      message,
      status,
      scheduledTime,
      platformUrls,
      hashtags,
      updatedBy: auth.user.uid,
    });

    return NextResponse.json({ ok: true });
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
    console.error("Failed to update sns promotion", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorize();
    if (!auth) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get("episodeId");
    const id = searchParams.get("id");

    if (!episodeId || !id) {
      return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
    }

    await deleteSnsPromotion({
      podcastId: auth.podcastId,
      episodeId: Number(episodeId),
      promotionId: id,
    });

    return NextResponse.json({ ok: true });
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
    console.error("Failed to delete sns promotion", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

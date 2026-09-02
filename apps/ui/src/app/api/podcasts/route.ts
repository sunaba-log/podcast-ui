import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import {
  createPodcast,
  listPodcastsForUser,
  userHasChannelWithTitle,
} from "@/server/podcasts/data-repository";
import {
  SELECTED_PODCAST_COOKIE_NAME,
  selectedPodcastCookieOptions,
} from "@/server/podcasts/selection";

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    if (!user.registered) {
      return NextResponse.json({ error: "ユーザ登録が必要です" }, { status: 403 });
    }
    const podcasts = await listPodcastsForUser(user.uid);
    return NextResponse.json({ podcasts });
  } catch (error) {
    console.error("Failed to list podcasts", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    if (!user.registered) {
      return NextResponse.json({ error: "ユーザ登録が必要です" }, { status: 403 });
    }
    const input = createSchema.parse(await request.json());
    if (await userHasChannelWithTitle(user.uid, input.title)) {
      return NextResponse.json(
        { error: "同じ名前のチャンネルが既に存在します" },
        { status: 409 },
      );
    }
    const podcast = await createPodcast({
      title: input.title,
      description: input.description || null,
      ownerUserId: user.uid,
    });
    // 作成したチャンネルをそのまま選択状態にする
    const response = NextResponse.json({ podcast }, { status: 201 });
    response.cookies.set(
      SELECTED_PODCAST_COOKIE_NAME,
      String(podcast.id),
      selectedPodcastCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to create podcast", error);
    return NextResponse.json(
      { error: "チャンネルの作成に失敗しました" },
      { status: 500 },
    );
  }
}

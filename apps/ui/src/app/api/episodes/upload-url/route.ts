import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDbPool } from "@/server/db";
import { createEpisodeUpload } from "@/server/episodes/create-upload";
import { createEpisodeUploadSchema } from "@/server/episodes/upload-contract";
import {
  createEpisodeRecord,
  setEpisodeAudioFilePath,
} from "@/server/episodes/repository";
import { createAudioUploadUrl } from "@/server/storage";
import { getSessionUser, requirePodcastAccess } from "@/server/auth";
import { checkUsageAllowed, recordUsage } from "@/server/usage-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const input = createEpisodeUploadSchema.parse(await request.json());
    await requirePodcastAccess(user.uid, input.podcastId);

    const pool = await getDbPool();
    const usageCheck = await checkUsageAllowed(pool, user, "episode_upload");
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.reason }, { status: 429 });
    }

    await recordUsage(pool, user.uid, "episode_upload");

    const result = await createEpisodeUpload(input, {
      pool,
      signUpload: createAudioUploadUrl,
      createRecord: createEpisodeRecord,
      setAudioPath: setEpisodeAudioFilePath,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "入力内容が不正です", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "JSON形式が不正です" }, { status: 400 });
    }

    console.error("Failed to create episode upload URL", error);
    return NextResponse.json(
      { error: "アップロードの準備に失敗しました" },
      { status: 500 },
    );
  }
}

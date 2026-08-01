import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import { isPodcastOwner } from "@/server/podcasts/data-repository";
import {
  getChannelSecrets,
  saveChannelSecrets,
  deleteChannelSecrets,
  ChannelSecrets,
} from "@/server/podcasts/secrets-repository";

const MASK_VALUE = "********";

const secretsSchema = z.object({
  x_api_key: z.string().trim().optional(),
  x_api_secret: z.string().trim().optional(),
  x_access_token: z.string().trim().optional(),
  x_access_token_secret: z.string().trim().optional(),
  discord_bot_token: z.string().trim().optional(),
});

function parsePodcastId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function GET(
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

    const secrets = await getChannelSecrets(podcastId);
    if (!secrets) {
      return NextResponse.json({
        x_api_key: "",
        x_api_secret: "",
        x_access_token: "",
        x_access_token_secret: "",
        discord_bot_token: "",
      });
    }

    // セキュリティのため、設定されているキーはマスク値、未設定のキーは空文字で返す
    return NextResponse.json({
      x_api_key: secrets.x_api_key ? MASK_VALUE : "",
      x_api_secret: secrets.x_api_secret ? MASK_VALUE : "",
      x_access_token: secrets.x_access_token ? MASK_VALUE : "",
      x_access_token_secret: secrets.x_access_token_secret ? MASK_VALUE : "",
      discord_bot_token: secrets.discord_bot_token ? MASK_VALUE : "",
    });
  } catch (error) {
    console.error("Failed to get channel secrets", error);
    return NextResponse.json({ error: "シークレットの取得に失敗しました" }, { status: 500 });
  }
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

    const input = secretsSchema.parse(await request.json());

    // すべての入力値が空文字、または undefined の場合はシークレット自体の削除とみなす
    const allEmpty =
      (!input.x_api_key || input.x_api_key === "") &&
      (!input.x_api_secret || input.x_api_secret === "") &&
      (!input.x_access_token || input.x_access_token === "") &&
      (!input.x_access_token_secret || input.x_access_token_secret === "") &&
      (!input.discord_bot_token || input.discord_bot_token === "");

    if (allEmpty) {
      await deleteChannelSecrets(podcastId);
      return NextResponse.json({ ok: true });
    }

    // 既存のシークレットを取得してマージする
    const existing = await getChannelSecrets(podcastId);

    const mergedSecrets: ChannelSecrets = {
      x_api_key:
        input.x_api_key === MASK_VALUE
          ? existing?.x_api_key
          : input.x_api_key || undefined,
      x_api_secret:
        input.x_api_secret === MASK_VALUE
          ? existing?.x_api_secret
          : input.x_api_secret || undefined,
      x_access_token:
        input.x_access_token === MASK_VALUE
          ? existing?.x_access_token
          : input.x_access_token || undefined,
      x_access_token_secret:
        input.x_access_token_secret === MASK_VALUE
          ? existing?.x_access_token_secret
          : input.x_access_token_secret || undefined,
      discord_bot_token:
        input.discord_bot_token === MASK_VALUE
          ? existing?.discord_bot_token
          : input.discord_bot_token || undefined,
    };

    await saveChannelSecrets(podcastId, mergedSecrets);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to update channel secrets", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

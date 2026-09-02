import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasPodcastAccess, type SessionUser } from "@/server/auth";
import { getUserDefaultPodcastId } from "@/server/podcasts/data-repository";

export const SELECTED_PODCAST_COOKIE_NAME = "selected_podcast_id";

const SELECTED_PODCAST_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function selectedPodcastCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SELECTED_PODCAST_MAX_AGE_SECONDS,
  };
}

export async function getSelectedPodcastId(): Promise<number | null> {
  const raw = (await cookies()).get(SELECTED_PODCAST_COOKIE_NAME)?.value;
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

// 選択 Cookie が有効ならそれを、無効ならデフォルトチャンネルを、それも無ければ
// null を返す。Server Component からは Cookie を書き換えられないため、
// フォールバック時は Cookie を更新せず既定値を返すだけにする（明示切替は API 経由）。
export async function resolveEffectivePodcastId(
  user: SessionUser,
): Promise<number | null> {
  const selected = await getSelectedPodcastId();
  if (selected && (await hasPodcastAccess(user.uid, selected))) {
    return selected;
  }
  const fallback = await getUserDefaultPodcastId(user.uid);
  if (fallback && (await hasPodcastAccess(user.uid, fallback))) {
    return fallback;
  }
  return null;
}

// ページ用。選択もデフォルトも無ければチャンネル一覧へ誘導する。
export async function requireSelectedPodcast(
  user: SessionUser,
): Promise<number> {
  const podcastId = await resolveEffectivePodcastId(user);
  if (!podcastId) {
    redirect("/");
  }
  return podcastId;
}

// API用。選択もデフォルトも無ければ NO_PODCAST_SELECTED を投げる。
export async function requireSelectedPodcastForApi(
  user: SessionUser,
): Promise<number> {
  const podcastId = await resolveEffectivePodcastId(user);
  if (!podcastId) throw new Error("NO_PODCAST_SELECTED");
  return podcastId;
}

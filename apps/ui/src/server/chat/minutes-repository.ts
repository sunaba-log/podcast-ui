import "server-only";

import type { QueryResultRow } from "pg";
import { getDbPool } from "@/server/db";
import { getAdminFirestore } from "@/server/firebase-admin";

export type EpisodeKnowledge = {
  episodeId: number;
  title: string;
  createdAt: string;
  /** 議事録テキスト（要約優先、無ければ editorial.minutes）。 */
  content: string;
};

type EpisodeRow = QueryResultRow & {
  episode_id: number;
  title: string;
  created_at: Date;
};

type FirestoreEpisodeContent = {
  transcript_summary?: string;
  editorial?: {
    minutes?: string;
  };
};

// 議事録・要約は HTML で保存されている場合があるため素テキストへ正規化する。
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 1 エピソードの知識源を組み立てる。議事録（あれば）＋ 要約 ＋ 逐語トランスクリプトを
 * 束ねることで、要約止まりにせず具体的な発言まで検索・引用できるようにする。
 */
async function loadContent(
  podcastId: number,
  episodeId: number,
): Promise<string> {
  const contentRef = getAdminFirestore()
    .collection("podcasts")
    .doc(String(podcastId))
    .collection("episodes_contents")
    .doc(String(episodeId));
  const [snapshot, transcriptSnapshot] = await Promise.all([
    contentRef.get(),
    contentRef.collection("transcripts").get(),
  ]);

  const data = snapshot.data() as FirestoreEpisodeContent | undefined;
  const parts: string[] = [];

  const minutes = stripHtml(data?.editorial?.minutes ?? "");
  const summary = stripHtml(data?.transcript_summary ?? "");
  if (minutes) parts.push(`【議事録】\n${minutes}`);
  if (summary) parts.push(`【概要】\n${summary}`);

  const transcript = transcriptSnapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => Number(a.start_time ?? 0) - Number(b.start_time ?? 0))
    .map((turn) => {
      const speaker = turn.speaker ? `${String(turn.speaker)}: ` : "";
      return `${speaker}${stripHtml(String(turn.text ?? ""))}`;
    })
    .filter((line) => line.trim().length > 0);
  if (transcript.length > 0) {
    parts.push(`【書き起こし】\n${transcript.join("\n")}`);
  }

  return parts.join("\n\n").trim();
}

/**
 * 配信済み（completed）エピソードの議事録を新しい順に取得する。
 * 議事録が空のエピソードは除外する。
 */
export async function listEpisodeKnowledge(
  podcastId: number,
): Promise<EpisodeKnowledge[]> {
  const result = await (await getDbPool()).query<EpisodeRow>(
    `SELECT episode_id, title, created_at
     FROM episodes
     WHERE podcast_id = $1 AND status = 'completed'
     ORDER BY created_at DESC`,
    [podcastId],
  );

  const items = await Promise.all(
    result.rows.map(async (row) => ({
      episodeId: row.episode_id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      content: await loadContent(podcastId, row.episode_id),
    })),
  );

  return items.filter((item) => item.content.trim().length > 0);
}

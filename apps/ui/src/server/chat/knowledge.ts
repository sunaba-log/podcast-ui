import "server-only";

import type { QueryResultRow } from "pg";
import { getDbPool } from "@/server/db";
import { getAdminFirestore } from "@/server/firebase-admin";
import { listEpisodeKnowledge } from "@/server/chat/minutes-repository";
import { listTopicProposals } from "@/server/topic-proposals/repository";
import type { KnowledgeDoc } from "@/server/chat/knowledge-types";

export type {
  KnowledgeDoc,
  KnowledgeSourceType,
} from "@/server/chat/knowledge-types";

/** 配信済みエピソードの議事録・書き起こしを知識ドキュメントとして取得する。 */
export async function listMinutesKnowledge(
  podcastId: number,
): Promise<KnowledgeDoc[]> {
  const episodes = await listEpisodeKnowledge(podcastId);
  return episodes.map((episode) => ({
    sourceType: "minutes" as const,
    sourceKey: `minutes:${episode.episodeId}`,
    title: episode.title,
    // 編集画面（/episodes/{id}）ではなく、トップの閲覧画面で該当エピソードを開く。
    url: `/?episode=${episode.episodeId}`,
    content: episode.content,
  }));
}

const AGENDA_KNOWLEDGE_LIMIT = 5;

// Google 検索グラウンディングのリダイレクト URL は短期間で失効しリンク切れになるため、
// コンテキストへ載せない（LLM がリンクとして引用してしまう）。
function isEphemeralUrl(url: string): boolean {
  return url.includes("vertexaisearch.cloud.google.com");
}

/**
 * 次回議題の提案（topic_proposals）を知識ドキュメントとして取得する（新しい順に最大5提案）。
 * 1 議題 = 1 ドキュメントにし、リンクから該当議題を直接開けるようにする。
 */
async function listAgendaKnowledge(podcastId: number): Promise<KnowledgeDoc[]> {
  const proposals = await listTopicProposals(podcastId);
  return proposals.slice(0, AGENDA_KNOWLEDGE_LIMIT).flatMap((proposal) => {
    const period =
      proposal.targetPeriod || proposal.generatedAt.slice(0, 10) || proposal.id;
    return proposal.suggestedTopics
      .map((topic, index) => {
        const parts: string[] = [`対象期間: ${period}`];
        if (topic.description) parts.push(topic.description);
        if (topic.suggestedPoints.length > 0) {
          parts.push(`論点: ${topic.suggestedPoints.join(" / ")}`);
        }
        // 関連ニュースは議題とインデックスで対応している（UI と同じ扱い）。
        const news = proposal.relatedNews[index];
        if (news?.title) {
          const url = news.url && !isEphemeralUrl(news.url) ? `（${news.url}）` : "";
          const lines = [`関連ニュース: ${news.title}${url}`];
          if (news.summary) lines.push(news.summary);
          parts.push(lines.join("\n"));
        }
        return {
          sourceType: "agenda" as const,
          sourceKey: `agenda:${proposal.id}:${index}`,
          title: topic.title || `次回議題（${period}）`,
          url: `/agenda?proposal=${encodeURIComponent(proposal.id)}&topic=${index}`,
          content: parts.join("\n\n").trim(),
        };
      })
      .filter((doc) => doc.content.length > 0);
  });
}

type EpisodeTitleRow = QueryResultRow & {
  episode_id: number;
  title: string;
};

/**
 * SNS 投稿（sns_promotions）を知識ドキュメントとして取得する。
 * data-repository の一覧取得は書き起こしまで読み込むため、ここでは
 * エピソードタイトル（PG）＋ sns_promotions サブコレクションだけを軽量に読む。
 */
async function listSnsKnowledge(podcastId: number): Promise<KnowledgeDoc[]> {
  const result = await (await getDbPool()).query<EpisodeTitleRow>(
    `SELECT episode_id, title
     FROM episodes
     WHERE podcast_id = $1
     ORDER BY created_at DESC`,
    [podcastId],
  );

  const firestore = getAdminFirestore();
  const perEpisode = await Promise.all(
    result.rows.map(async (row) => {
      const snapshot = await firestore
        .collection("podcasts")
        .doc(String(podcastId))
        .collection("episodes_contents")
        .doc(String(row.episode_id))
        .collection("sns_promotions")
        .get();

      return snapshot.docs.map((document) => {
        const data = document.data();
        const message = String(data.message ?? "").trim();
        const hashtags = Array.isArray(data.hashtags)
          ? data.hashtags.map(String).filter(Boolean)
          : [];
        const status = String(data.status ?? "pending");
        const scheduledTime = data.scheduled_time
          ? String(data.scheduled_time)
          : "";

        const parts = [`エピソード: ${row.title}`];
        parts.push(
          `ステータス: ${status === "posted" ? "投稿済み" : "未投稿"}${
            scheduledTime ? `（予定: ${scheduledTime}）` : ""
          }`,
        );
        if (message) parts.push(`投稿文:\n${message}`);
        if (hashtags.length > 0) {
          parts.push(`ハッシュタグ: ${hashtags.join(" ")}`);
        }

        return {
          sourceType: "sns" as const,
          sourceKey: `sns:${row.episode_id}:${document.id}`,
          title: `SNS投稿（${row.title}）`,
          url: `/sns?episode=${row.episode_id}&post=${encodeURIComponent(document.id)}`,
          content: message ? parts.join("\n\n") : "",
        };
      });
    }),
  );

  return perEpisode.flat().filter((doc) => doc.content.length > 0);
}

/**
 * 次回議題・SNS 投稿の知識ドキュメントを取得する。
 * 議事録と違いデータ量が小さいため、RAG 検索を介さず常にコンテキストへ全量注入する。
 */
export async function listSupplementalKnowledge(
  podcastId: number,
): Promise<KnowledgeDoc[]> {
  const [agenda, sns] = await Promise.all([
    listAgendaKnowledge(podcastId),
    listSnsKnowledge(podcastId),
  ]);
  return [...agenda, ...sns];
}

/** チャットの知識源（議事録・次回議題・SNS 投稿）をすべて取得する。 */
export async function listAllKnowledge(
  podcastId: number,
): Promise<KnowledgeDoc[]> {
  const [minutes, supplemental] = await Promise.all([
    listMinutesKnowledge(podcastId),
    listSupplementalKnowledge(podcastId),
  ]);
  return [...minutes, ...supplemental];
}

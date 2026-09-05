import "server-only";

import { getAdminFirestore } from "@/server/firebase-admin";
import type { TopicProposal } from "@/types/episode";

type RelatedNewsData = {
  title?: unknown;
  url?: unknown;
  summary?: unknown;
  source_reason?: unknown;
};

type SuggestedTopicData = {
  title?: unknown;
  description?: unknown;
  suggested_points?: unknown;
  related_past_episodes?: unknown;
};

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((item) => Number.isFinite(item))
    : [];
}

export async function listTopicProposals(
  podcastId: number,
): Promise<TopicProposal[]> {
  const snapshot = await getAdminFirestore()
    .collection("podcasts")
    .doc(String(podcastId))
    .collection("topic_proposals")
    .orderBy("generated_at", "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data();
    const editorial =
      typeof data.editorial === "object" && data.editorial
        ? data.editorial
        : {};
    const relatedNews = (editorial.related_news ??
      data.related_news ??
      []) as RelatedNewsData[];
    const suggestedTopics = (editorial.suggested_topics ??
      data.suggested_topics ??
      []) as SuggestedTopicData[];
    return {
      id: document.id,
      podcastId,
      targetPeriod: String(data.target_period_string ?? ""),
      generatedAt: String(data.generated_at ?? ""),
      relatedNews: relatedNews.map((news) => ({
        title: String(news.title ?? ""),
        url: String(news.url ?? ""),
        summary: String(news.summary ?? ""),
        sourceReason: String(news.source_reason ?? ""),
      })),
      suggestedTopics: suggestedTopics.map((topic) => ({
        title: String(topic.title ?? ""),
        description: String(topic.description ?? ""),
        suggestedPoints: asStrings(topic.suggested_points),
        relatedPastEpisodes: asNumbers(topic.related_past_episodes),
      })),
    };
  });
}

export async function updateTopicProposal(input: {
  podcastId: number;
  proposalId: string;
  relatedNews: TopicProposal["relatedNews"];
  suggestedTopics: TopicProposal["suggestedTopics"];
  updatedBy: string;
}): Promise<void> {
  await getAdminFirestore()
    .collection("podcasts")
    .doc(String(input.podcastId))
    .collection("topic_proposals")
    .doc(input.proposalId)
    .set(
      {
        editorial: {
          related_news: input.relatedNews.map((news) => ({
            title: news.title,
            url: news.url,
            summary: news.summary,
            source_reason: news.sourceReason,
          })),
          suggested_topics: input.suggestedTopics.map((topic) => ({
            title: topic.title,
            description: topic.description,
            suggested_points: topic.suggestedPoints,
            related_past_episodes: topic.relatedPastEpisodes,
          })),
          updated_at: new Date().toISOString(),
          updated_by: input.updatedBy,
        },
      },
      { merge: true },
    );
}

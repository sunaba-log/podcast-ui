import { SNSPostMasterDetail } from "@/components/SNSPostMasterDetail";
import { requireRegisteredUser } from "@/server/auth";
import { requireSelectedPodcast } from "@/server/podcasts/selection";
import {
  findEpisode,
  listEpisodesAndPromotionsPaginated,
} from "@/server/episodes/data-repository";
import { mapToSNSPostItem } from "@/app/api/sns/route";

export const dynamic = "force-dynamic";

export default async function SNSPostPage({
  searchParams,
}: {
  searchParams: Promise<{ episode?: string; post?: string }>;
}) {
  const user = await requireRegisteredUser();
  const podcastId = await requireSelectedPodcast(user);
  const { episode, post } = await searchParams;

  // Load the initial 5 episodes and their promotions
  const { episodes, hasMore } = await listEpisodesAndPromotionsPaginated(podcastId, 5, 0);

  // Map to SNSPostItem structure
  let initialPosts = episodes.flatMap((ep) =>
    ep.xPosts.map((p) => mapToSNSPostItem(ep, p))
  );

  // ディープリンク（/sns?episode=...&post=...）対象が先頭ページに無ければ、
  // 該当エピソードの投稿を読み込んでマージする。
  const episodeId = Number(episode);
  if (post && Number.isFinite(episodeId) && !initialPosts.some((p) => p.id === post)) {
    const target = await findEpisode(podcastId, episodeId);
    if (target) {
      const existing = new Set(initialPosts.map((p) => p.id));
      const targetPosts = target.xPosts
        .map((p) => mapToSNSPostItem(target, p))
        .filter((p) => !existing.has(p.id));
      initialPosts = [...initialPosts, ...targetPosts];
    }
  }

  return (
    <SNSPostMasterDetail
      initialPosts={initialPosts}
      initialHasMore={hasMore}
      initialSelectedId={post}
    />
  );
}

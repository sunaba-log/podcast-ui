import { ChannelManager } from "@/components/ChannelManager";
import { requireRegisteredUser } from "@/server/auth";
import {
  getUserDefaultPodcastId,
  listPodcastsForUser,
} from "@/server/podcasts/data-repository";
import { resolveEffectivePodcastId } from "@/server/podcasts/selection";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const user = await requireRegisteredUser();
  const podcasts = await listPodcastsForUser(user.uid);
  const selectedPodcastId = await resolveEffectivePodcastId(user);
  const defaultPodcastId = await getUserDefaultPodcastId(user.uid);

  return (
    <ChannelManager
      podcasts={podcasts}
      selectedPodcastId={selectedPodcastId}
      defaultPodcastId={defaultPodcastId}
    />
  );
}

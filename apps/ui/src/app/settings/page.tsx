import { notFound } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
import { requireRegisteredUser } from "@/server/auth";
import { getPodcast } from "@/server/podcasts/data-repository";
import { requireSelectedPodcast } from "@/server/podcasts/selection";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRegisteredUser();
  const podcastId = await requireSelectedPodcast(user);
  const podcast = await getPodcast(podcastId);
  if (!podcast) notFound();

  return (
    <SettingsForm
      podcastId={podcast.id}
      title={podcast.title}
      description={podcast.description ?? ""}
      rssFeedPath={podcast.rssFeedPath ?? ""}
    />
  );
}

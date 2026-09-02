import { Episode } from "@/types/episode";
import { findEpisode, listEpisodes } from "@/server/episodes/data-repository";

export async function getEpisodes(podcastId: number): Promise<Episode[]> {
  return listEpisodes(podcastId);
}

export async function getEpisodeById(
  podcastId: number,
  id: string,
): Promise<Episode | null> {
  const episodeId = Number(id);
  if (!Number.isInteger(episodeId) || episodeId <= 0) return null;
  return findEpisode(podcastId, episodeId);
}

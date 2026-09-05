export type PodcastRole = "owner" | "editor";

export type PodcastSummary = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  rssFeedPath: string | null;
  role: PodcastRole;
};

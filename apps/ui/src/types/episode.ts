export type EpisodeStatus =
  | "upload_pending"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

export type EpisodePromotion = {
  id: string;
  message: string;
  status: string;
  scheduledTime: string | null;
  platformUrls?: { apple: string; amazon: string; spotify: string };
  hashtags?: string[];
  generatedAt?: string;
  updatedAt?: string;
};

export type Episode = {
  id: string;
  podcastId: number;
  title: string;
  description: string;
  createdAt: string;
  status: EpisodeStatus;
  audioFileName: string;
  audioUrl: string | null;
  artworkUrl: string | null;
  processingError: string | null;
  minutesGenerated: boolean;
  xPostsGenerated: boolean;
  seedsGenerated: boolean;
  minutes: string;
  xPosts: EpisodePromotion[];
  conversationSeeds: string[];
};

export type TopicProposal = {
  id: string;
  podcastId: number;
  targetPeriod: string;
  generatedAt: string;
  relatedNews: Array<{
    title: string;
    url: string;
    summary: string;
    sourceReason: string;
  }>;
  suggestedTopics: Array<{
    title: string;
    description: string;
    suggestedPoints: string[];
    relatedPastEpisodes: number[];
  }>;
};

import { z } from "zod";

export const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;
export const SUPPORTED_AUDIO_EXTENSIONS = ["mp3", "m4a"] as const;
export const SUPPORTED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
] as const;

export type SupportedAudioContentType = (typeof SUPPORTED_AUDIO_CONTENT_TYPES)[number];

export const createEpisodeUploadSchema = z.object({
  podcastId: z.number().int().positive(),
  title: z.string().trim().max(255).optional(),
  description: z.string().trim().max(10_000).optional(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(SUPPORTED_AUDIO_CONTENT_TYPES),
  fileSize: z.number().int().positive().max(MAX_AUDIO_SIZE_BYTES),
});

export type CreateEpisodeUploadInput = z.infer<typeof createEpisodeUploadSchema>;

export type CreateEpisodeUploadResponse = {
  episodeId: number;
  podcastId: number;
  objectPath: string;
  uploadUrl: string;
  expiresAt: string;
};

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? "";
  const extension = getSupportedAudioExtension(baseName);
  if (!extension) {
    throw new Error("MP3またはM4Aファイルを選択してください");
  }

  const sanitizedStem = baseName
    .slice(0, -(extension.length + 1))
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "audio";

  return `${sanitizedStem}.${extension}`;
}

export function getSupportedAudioExtension(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && SUPPORTED_AUDIO_EXTENSIONS.includes(extension as never)
    ? extension
    : null;
}

export function isSupportedAudioContentType(
  contentType: string,
): contentType is SupportedAudioContentType {
  return SUPPORTED_AUDIO_CONTENT_TYPES.includes(contentType as SupportedAudioContentType);
}

export function buildEpisodeSourceObjectPath(
  podcastId: number,
  episodeId: number,
  fileName: string,
): string {
  return `podcasts/${podcastId}/episodes/${episodeId}/source/${sanitizeFileName(fileName)}`;
}

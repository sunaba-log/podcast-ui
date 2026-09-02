export type TextChunk = {
  index: number;
  text: string;
};

export type ChunkOptions = {
  /** 1 チャンクの最大文字数。 */
  maxChars?: number;
  /** 隣接チャンク間で重複させる文字数。 */
  overlap?: number;
};

const DEFAULT_MAX_CHARS = 800;
const DEFAULT_OVERLAP = 100;

/**
 * 議事録テキストを埋め込み用のチャンクへ分割する（純粋関数）。
 * 改行を正規化し、重複付きのスライディングウィンドウで分割する。
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS);
  const overlap = Math.min(
    Math.max(0, options.overlap ?? DEFAULT_OVERLAP),
    maxChars - 1,
  );

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) {
    return [{ index: 0, text: normalized }];
  }

  const step = maxChars - overlap;
  const chunks: TextChunk[] = [];
  for (let start = 0; start < normalized.length; start += step) {
    const slice = normalized.slice(start, start + maxChars).trim();
    if (slice) {
      chunks.push({ index: chunks.length, text: slice });
    }
    if (start + maxChars >= normalized.length) break;
  }
  return chunks;
}

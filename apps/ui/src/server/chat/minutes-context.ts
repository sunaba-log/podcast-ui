import {
  SOURCE_TYPE_LABELS,
  type KnowledgeDoc,
  type KnowledgeSourceType,
} from "@/server/chat/knowledge-types";
import type { RetrievedChunk } from "@/server/chat/vector-index";

export type BuildKnowledgeContextOptions = {
  /** コンテキスト全体の最大文字数。 */
  maxTotalChars?: number;
  /** 1 ソースあたりの最大文字数。 */
  maxPerSourceChars?: number;
};

const DEFAULT_MAX_TOTAL_CHARS = 120_000;
const DEFAULT_MAX_PER_SOURCE_CHARS = 6_000;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…（以下省略）`;
}

// LLM が回答リンクをそのまま転記できるよう、各ブロックに種別・タイトル・URL を明示する。
function blockHeader(
  sourceType: KnowledgeSourceType,
  title: string,
  url: string,
): string {
  return `## 【${SOURCE_TYPE_LABELS[sourceType]}】${title}\nURL: ${url}`;
}

/**
 * ナレッジドキュメント（議事録・次回議題・SNS 投稿）を LLM へ渡す
 * コンテキスト文字列に整形する。全体予算を超えた時点で打ち切る（純粋関数）。
 */
export function buildKnowledgeContext(
  docs: KnowledgeDoc[],
  options: BuildKnowledgeContextOptions = {},
): string {
  const maxTotal = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const maxPerSource = options.maxPerSourceChars ?? DEFAULT_MAX_PER_SOURCE_CHARS;

  const blocks: string[] = [];
  let used = 0;

  for (const doc of docs) {
    const body = truncate(doc.content, maxPerSource);
    if (!body) continue;
    const block = `${blockHeader(doc.sourceType, doc.title, doc.url)}\n${body}`;
    if (used + block.length > maxTotal) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

/**
 * ベクトル検索で取得したチャンクを LLM へ渡すコンテキスト文字列に整形する。
 * 同一ソースのチャンクはまとめ、全体予算を超えた時点で打ち切る（純粋関数）。
 */
export function buildRetrievedContext(
  chunks: RetrievedChunk[],
  options: { maxTotalChars?: number } = {},
): string {
  const maxTotal = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;

  const bySource = new Map<
    string,
    { sourceType: KnowledgeSourceType; title: string; url: string; texts: string[] }
  >();
  for (const chunk of chunks) {
    const text = chunk.text.trim();
    if (!text) continue;
    const entry = bySource.get(chunk.sourceKey);
    if (entry) {
      entry.texts.push(text);
    } else {
      bySource.set(chunk.sourceKey, {
        sourceType: chunk.sourceType,
        title: chunk.title,
        url: chunk.url,
        texts: [text],
      });
    }
  }

  const blocks: string[] = [];
  let used = 0;
  for (const { sourceType, title, url, texts } of bySource.values()) {
    const block = `${blockHeader(sourceType, title, url)}\n${texts.join("\n…\n")}`;
    if (used + block.length > maxTotal) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

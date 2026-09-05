import "server-only";

import { createHash } from "node:crypto";
import { chunkText } from "@/server/chat/chunking";
import { embedTexts } from "@/server/chat/embeddings";
import { listMinutesKnowledge } from "@/server/chat/knowledge";
import {
  deleteSourceChunks,
  getIndexedSourceHash,
  listIndexedSourceKeys,
  replaceSourceChunks,
} from "@/server/chat/vector-index";

export type ReindexResult = {
  sources: number;
  indexedSources: number;
  skippedSources: number;
  removedSources: number;
  indexedChunks: number;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 議事録・書き起こしをチャンク分割・埋め込みし、Firestore ベクトルインデックスへ反映する。
 * 次回議題・SNS 投稿はデータ量が小さく常にコンテキストへ全量注入するため、対象外。
 * 前回から変わっていないソースはスキップし（冪等）、現存しなくなったソース
 * （旧形式の残骸を含む）はインデックスから削除する。
 */
export async function reindexPodcastKnowledge(
  podcastId: number,
): Promise<ReindexResult> {
  const docs = await listMinutesKnowledge(podcastId);
  const result: ReindexResult = {
    sources: docs.length,
    indexedSources: 0,
    skippedSources: 0,
    removedSources: 0,
    indexedChunks: 0,
  };

  for (const doc of docs) {
    const contentHash = hashContent(doc.content);
    const indexedHash = await getIndexedSourceHash(podcastId, doc.sourceKey);
    if (indexedHash === contentHash) {
      result.skippedSources += 1;
      continue;
    }

    const chunks = chunkText(doc.content);
    if (chunks.length === 0) {
      result.skippedSources += 1;
      continue;
    }

    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.text),
      "RETRIEVAL_DOCUMENT",
    );

    await replaceSourceChunks({
      podcastId,
      sourceType: doc.sourceType,
      sourceKey: doc.sourceKey,
      title: doc.title,
      url: doc.url,
      contentHash,
      chunks: chunks.map((chunk) => ({
        chunkIndex: chunk.index,
        text: chunk.text,
      })),
      embeddings,
    });

    result.indexedSources += 1;
    result.indexedChunks += chunks.length;
  }

  // 現存しないソース（削除された議題・SNS 投稿や旧形式の meta）を掃除する。
  const currentKeys = new Set(docs.map((doc) => doc.sourceKey));
  const indexedKeys = await listIndexedSourceKeys(podcastId);
  for (const key of indexedKeys) {
    if (currentKeys.has(key)) continue;
    await deleteSourceChunks(podcastId, key);
    result.removedSources += 1;
  }

  return result;
}

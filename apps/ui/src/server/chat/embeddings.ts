import "server-only";

import { getVertexAiEmbeddingModel } from "@/server/env";
import { getVertexAi } from "@/server/chat/vertex-client";

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const MAX_BATCH = 50;

/**
 * Vertex AI のテキスト埋め込みモデルで複数テキストをベクトル化する。
 * Vertex のリクエスト上限に合わせてバッチ分割する。
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = getVertexAiEmbeddingModel();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += MAX_BATCH) {
    const batch = texts.slice(start, start + MAX_BATCH);
    const response = await getVertexAi().models.embedContent({
      model,
      contents: batch,
      config: { taskType },
    });
    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error("埋め込みの数が入力と一致しません");
    }
    for (const embedding of embeddings) {
      vectors.push(embedding.values ?? []);
    }
  }

  return vectors;
}

/** 検索クエリ用の埋め込みを 1 件生成する。 */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], "RETRIEVAL_QUERY");
  return vector ?? [];
}

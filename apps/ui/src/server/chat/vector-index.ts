import "server-only";

import {
  type CollectionReference,
  FieldValue,
} from "firebase-admin/firestore";
import { getAdminFirestore } from "@/server/firebase-admin";
import type { KnowledgeSourceType } from "@/server/chat/knowledge-types";

const INDEX_COLLECTION = "minutes_index";
const META_COLLECTION = "minutes_index_meta";
const MAX_BATCH_OPS = 450;

export type IndexChunk = {
  chunkIndex: number;
  text: string;
};

export type RetrievedChunk = {
  sourceType: KnowledgeSourceType;
  sourceKey: string;
  title: string;
  url: string;
  text: string;
};

function indexCollection(podcastId: number): CollectionReference {
  return getAdminFirestore()
    .collection("podcasts")
    .doc(String(podcastId))
    .collection(INDEX_COLLECTION);
}

function metaCollection(podcastId: number): CollectionReference {
  return getAdminFirestore()
    .collection("podcasts")
    .doc(String(podcastId))
    .collection(META_COLLECTION);
}

/** 既にインデックス済みソースのコンテンツハッシュ（未登録なら null）。 */
export async function getIndexedSourceHash(
  podcastId: number,
  sourceKey: string,
): Promise<string | null> {
  const snapshot = await metaCollection(podcastId).doc(sourceKey).get();
  const hash = snapshot.data()?.content_hash;
  return typeof hash === "string" ? hash : null;
}

/** インデックス済みの全ソースキー（meta ドキュメント ID）。 */
export async function listIndexedSourceKeys(
  podcastId: number,
): Promise<string[]> {
  const snapshot = await metaCollection(podcastId).get();
  return snapshot.docs.map((doc) => doc.id);
}

async function deleteDocs(
  refs: FirebaseFirestore.DocumentReference[],
): Promise<void> {
  const firestore = getAdminFirestore();
  let batch = firestore.batch();
  let ops = 0;
  for (const ref of refs) {
    batch.delete(ref);
    ops += 1;
    if (ops >= MAX_BATCH_OPS) {
      await batch.commit();
      batch = firestore.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

/**
 * 1 ソース分のチャンクと meta を削除する。
 * 旧形式（source_key を持たず episode_id キーだった頃）のドキュメントも掃除できるよう、
 * ソースキーが数値のみの場合は episode_id での検索も行う。
 */
export async function deleteSourceChunks(
  podcastId: number,
  sourceKey: string,
): Promise<void> {
  const collection = indexCollection(podcastId);
  const bySourceKey = await collection
    .where("source_key", "==", sourceKey)
    .get();
  const refs = bySourceKey.docs.map((doc) => doc.ref);

  if (/^\d+$/.test(sourceKey)) {
    const legacy = await collection
      .where("episode_id", "==", Number(sourceKey))
      .get();
    for (const doc of legacy.docs) {
      if (!refs.some((ref) => ref.path === doc.ref.path)) refs.push(doc.ref);
    }
  }

  refs.push(metaCollection(podcastId).doc(sourceKey));
  await deleteDocs(refs);
}

/**
 * 1 ソース分のチャンクを入れ替える。既存チャンクを削除して新しい埋め込みを書き込み、
 * meta（ハッシュ）を更新する。
 */
export async function replaceSourceChunks(input: {
  podcastId: number;
  sourceType: KnowledgeSourceType;
  sourceKey: string;
  title: string;
  url: string;
  contentHash: string;
  chunks: IndexChunk[];
  embeddings: number[][];
}): Promise<void> {
  const firestore = getAdminFirestore();
  const collection = indexCollection(input.podcastId);
  const existing = await collection
    .where("source_key", "==", input.sourceKey)
    .get();

  let batch = firestore.batch();
  let ops = 0;
  const flushIfNeeded = async () => {
    if (ops >= MAX_BATCH_OPS) {
      await batch.commit();
      batch = firestore.batch();
      ops = 0;
    }
  };

  for (const doc of existing.docs) {
    batch.delete(doc.ref);
    ops += 1;
    await flushIfNeeded();
  }

  const updatedAt = new Date().toISOString();
  input.chunks.forEach((chunk, position) => {
    batch.set(collection.doc(`${input.sourceKey}_${chunk.chunkIndex}`), {
      source_type: input.sourceType,
      source_key: input.sourceKey,
      title: input.title,
      url: input.url,
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      content_hash: input.contentHash,
      embedding: FieldValue.vector(input.embeddings[position]),
      updated_at: updatedAt,
    });
    ops += 1;
  });

  batch.set(metaCollection(input.podcastId).doc(input.sourceKey), {
    source_type: input.sourceType,
    content_hash: input.contentHash,
    chunk_count: input.chunks.length,
    updated_at: updatedAt,
  });
  await batch.commit();
}

/** クエリベクトルに近いナレッジチャンクを横断検索する（要・ベクトルインデックス）。 */
export async function searchSimilarChunks(
  podcastId: number,
  queryVector: number[],
  limit: number,
): Promise<RetrievedChunk[]> {
  if (queryVector.length === 0) return [];
  const snapshot = await indexCollection(podcastId)
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryVector),
      limit,
      distanceMeasure: "COSINE",
    })
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // 旧形式（source_key 導入前）のドキュメントは議事録として扱う。
    if (typeof data.source_key !== "string") {
      const episodeId = Number(data.episode_id);
      return {
        sourceType: "minutes" as const,
        sourceKey: `minutes:${episodeId}`,
        title: String(data.episode_title ?? ""),
        url: `/?episode=${episodeId}`,
        text: String(data.text ?? ""),
      };
    }
    return {
      sourceType: (data.source_type ?? "minutes") as KnowledgeSourceType,
      sourceKey: String(data.source_key),
      title: String(data.title ?? ""),
      url: String(data.url ?? ""),
      text: String(data.text ?? ""),
    };
  });
}

import "server-only";

import type { Content } from "@google/genai";
import { getVertexAiModel } from "@/server/env";
import { getPodcast } from "@/server/podcasts/data-repository";
import type { ChatMessage } from "@/types/chat";
import { embedQuery } from "@/server/chat/embeddings";
import {
  listAllKnowledge,
  listSupplementalKnowledge,
} from "@/server/chat/knowledge";
import {
  buildKnowledgeContext,
  buildRetrievedContext,
} from "@/server/chat/minutes-context";
import { searchSimilarChunks } from "@/server/chat/vector-index";
import { getVertexAi } from "@/server/chat/vertex-client";

const RETRIEVAL_LIMIT = 12;
const CONDENSE_HISTORY_TURNS = 6;

function buildSystemInstruction(
  podcastTitle: string | null,
  context: string,
): string {
  const knowledge = context || "（参照できるナレッジはまだありません）";
  const intro = podcastTitle
    ? `あなたはポッドキャスト「${podcastTitle}」の運営を支援するアシスタントです。日本語で回答してください。`
    : "あなたはポッドキャストの運営を支援するアシスタントです。日本語で回答してください。";
  return [
    intro,
    "以下にナレッジ（配信済みエピソードの議事録・書き起こし／次回議題の提案／SNS 投稿）が与えられます。",
    "ナレッジは『## 【種別】タイトル』の見出しと、その直下の『URL: ...』行を持つブロックに分かれています。",
    "",
    "# 回答の使い分け（重要）",
    "- **ポッドキャストの事実**（過去回で話した内容・次回議題の提案内容・SNS 投稿の内容や予定）に関する質問は、ナレッジ**だけ**を根拠に答える。ナレッジに無い事実は「ナレッジには見当たらない」と伝え、推測や一般知識で補わない。",
    "- **それ以外の質問**（アイデア出し・文章の改善や下書き・一般的な知識・運営相談など）には、通常のアシスタントとして自由に回答してよい。関連するナレッジがあれば踏まえて答える。",
    "- ナレッジを根拠にした部分と、一般知識・提案として答えた部分が混ざる場合は、読み手が区別できるように書く。",
    "",
    "# 回答の中身",
    "- 質問に直接関係することだけを答える。ナレッジの全件列挙や、聞かれていない話題への言及はしない。",
    "- 表面的な要約で終わらせず、質問された範囲は具体的に答える。ナレッジを根拠にする場合は、誰が何を述べたか、挙がった例・論点・結論まで具体を拾う。",
    "- 次回議題について聞かれたら、最新の提案を中心に答える（過去の提案は求められたときだけ）。",
    "",
    "# 回答の長さ（必ず守る）",
    "- 簡潔に。通常は300〜600字程度、複雑な質問でも1000字以内を目安にする。",
    "- 網羅より要点。項目が多い場合は代表的なものに絞り、「他にも◯件あります」とまとめる。",
    "",
    "# リンクの付け方（必ず守る）",
    "- ナレッジを根拠にした箇所は必ず Markdown リンク `[タイトル](URL)` で参照元を示す。",
    "- リンクの URL には、そのブロックの『URL: ...』行に書かれた URL を**一字一句そのまま**使う。`/` で始まる相対パスのまま使い、`https://` やドメインを付け足さない。URL を自分で組み立てたり変更したりしない。",
    "- 正しいリンク記法の例: `[エピソードタイトル](/?episode=2)` / `[議題タイトル](/agenda?proposal=a1b2c3&topic=1)` / `[SNS投稿（タイトル）](/sns?episode=2&post=d4e5f6)`",
    "- リンクにしてよいのは各ブロックの『URL: ...』行の URL だけ。ナレッジ本文中に現れる外部 URL（ニュース記事など）はリンクにしない（必要なら記事名だけ挙げる）。",
    "- リンク文にはそのブロックのタイトルを使う。回答の根拠にしたブロックへのリンクを文中または末尾に必ず含める。",
    "",
    "# 回答スタイル（必ず守る）",
    "- 必ず読みやすい Markdown で構成し、長い一段落のベタ書きにしない。",
    "- 要点は箇条書き（`-`）にし、重要語は **太字** にする。見出し（`##`）は長い回答のときだけ使う。",
    "",
    "# ナレッジ（議事録・次回議題・SNS 投稿）",
    knowledge,
  ].join("\n");
}

function toContents(messages: ChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

/**
 * フォローアップ質問を、会話文脈を補った独立した検索クエリに書き換える。
 * 履歴が無い（初回質問）場合や失敗時は、直近のユーザー発言をそのまま使う。
 */
async function buildSearchQuery(messages: ChatMessage[]): Promise<string> {
  const last = lastUserMessage(messages);
  if (messages.length <= 1) return last;

  const history = messages
    .slice(-CONDENSE_HISTORY_TURNS)
    .map(
      (message) =>
        `${message.role === "user" ? "ユーザー" : "アシスタント"}: ${message.content}`,
    )
    .join("\n");

  try {
    const response = await getVertexAi().models.generateContent({
      model: getVertexAiModel(),
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "次の会話の最後のフォローアップ質問を、ポッドキャストのナレッジ（議事録・次回議題・SNS投稿）検索に使えるよう文脈を補った独立した日本語の質問1文に書き換えてください。",
                "質問文のみを出力してください。",
                "",
                "会話:",
                history,
                "",
                "書き換え後の質問:",
              ].join("\n"),
            },
          ],
        },
      ],
      config: { temperature: 0 },
    });
    const rewritten = (response.text ?? "").trim();
    return rewritten || last;
  } catch (error) {
    console.warn("Query condense failed; using last message", error);
    return last;
  }
}

const SUPPLEMENTAL_MAX_TOTAL_CHARS = 40_000;

/**
 * RAG（ベクトル検索）で関連する議事録チャンクを集め、次回議題・SNS 投稿は
 * データ量が小さいため常に全量を添えて文脈を作る（インデックス未更新でも回答できる）。
 * 検索が使えない / ヒット無しの場合は全ナレッジの全文コンテキストにフォールバックする。
 */
async function buildContext(
  podcastId: number,
  messages: ChatMessage[],
): Promise<string> {
  const query = await buildSearchQuery(messages);
  if (query) {
    try {
      const queryVector = await embedQuery(query);
      const chunks = await searchSimilarChunks(
        podcastId,
        queryVector,
        RETRIEVAL_LIMIT,
      );
      const retrieved = buildRetrievedContext(chunks);
      if (retrieved) {
        const supplemental = buildKnowledgeContext(
          await listSupplementalKnowledge(podcastId),
          { maxTotalChars: SUPPLEMENTAL_MAX_TOTAL_CHARS },
        );
        return supplemental ? `${retrieved}\n\n${supplemental}` : retrieved;
      }
    } catch (error) {
      console.warn(
        "Vector search unavailable; falling back to full knowledge",
        error,
      );
    }
  }
  const docs = await listAllKnowledge(podcastId);
  return buildKnowledgeContext(docs);
}

/**
 * ナレッジ（議事録・次回議題・SNS 投稿）を文脈に、会話への回答をストリーミングで生成する。
 */
export async function* streamChatReply(input: {
  podcastId: number;
  messages: ChatMessage[];
}): AsyncGenerator<string> {
  const [context, podcast] = await Promise.all([
    buildContext(input.podcastId, input.messages),
    getPodcast(input.podcastId),
  ]);

  const stream = await getVertexAi().models.generateContentStream({
    model: getVertexAiModel(),
    contents: toContents(input.messages),
    config: {
      systemInstruction: buildSystemInstruction(podcast?.title ?? null, context),
      temperature: 0.3,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

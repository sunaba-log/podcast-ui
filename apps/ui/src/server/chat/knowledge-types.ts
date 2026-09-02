export type KnowledgeSourceType = "minutes" | "agenda" | "sns";

export type KnowledgeDoc = {
  sourceType: KnowledgeSourceType;
  /** インデックスの入れ替え・冪等判定に使う一意キー（例: `minutes:12`）。 */
  sourceKey: string;
  /** リンク文に使うタイトル。 */
  title: string;
  /** アプリ内リンク先（回答にそのまま載せる）。 */
  url: string;
  content: string;
};

export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  minutes: "議事録",
  agenda: "次回議題",
  sns: "SNS投稿",
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ChatSessionDetail = ChatSessionSummary & {
  messages: ChatMessage[];
};

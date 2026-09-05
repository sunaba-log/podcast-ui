import "server-only";

import { getAdminFirestore } from "@/server/firebase-admin";
import type {
  ChatMessage,
  ChatSessionDetail,
  ChatSessionSummary,
} from "@/types/chat";

const SESSION_LIST_LIMIT = 100;

// ユーザー単位でセッションを保持する: chat_sessions/{userId}/sessions/{sessionId}
function sessionsCollection(userId: string) {
  return getAdminFirestore()
    .collection("chat_sessions")
    .doc(userId)
    .collection("sessions");
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const message = item as { role?: unknown; content?: unknown };
    return {
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content ?? ""),
    };
  });
}

export async function listSessions(
  userId: string,
): Promise<ChatSessionSummary[]> {
  const snapshot = await sessionsCollection(userId)
    .orderBy("updated_at", "desc")
    .limit(SESSION_LIST_LIMIT)
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: String(data.title ?? "無題のチャット"),
      updatedAt: String(data.updated_at ?? ""),
    };
  });
}

export async function getSession(
  userId: string,
  sessionId: string,
): Promise<ChatSessionDetail | null> {
  const doc = await sessionsCollection(userId).doc(sessionId).get();
  if (!doc.exists) return null;
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    title: String(data.title ?? "無題のチャット"),
    updatedAt: String(data.updated_at ?? ""),
    messages: normalizeMessages(data.messages),
  };
}

export async function createSession(
  userId: string,
  input: { title: string; messages: ChatMessage[] },
): Promise<ChatSessionSummary> {
  const now = new Date().toISOString();
  const ref = await sessionsCollection(userId).add({
    title: input.title,
    messages: input.messages,
    created_at: now,
    updated_at: now,
  });
  return { id: ref.id, title: input.title, updatedAt: now };
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: { messages?: ChatMessage[]; title?: string },
): Promise<boolean> {
  const ref = sessionsCollection(userId).doc(sessionId);
  if (!(await ref.get()).exists) return false;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.messages !== undefined) update.messages = input.messages;
  if (input.title !== undefined) update.title = input.title;
  await ref.set(update, { merge: true });
  return true;
}

export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  await sessionsCollection(userId).doc(sessionId).delete();
}

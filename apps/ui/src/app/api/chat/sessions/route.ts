import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import { createSession, listSessions } from "@/server/chat/session-repository";
import type { ChatMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messagesSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(10_000),
    }),
  )
  .min(1)
  .max(200);

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  messages: messagesSchema,
});

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  const base = (firstUser?.content ?? "新しいチャット").trim().replace(/\s+/g, " ");
  return base.length > 30 ? `${base.slice(0, 30)}…` : base;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const sessions = await listSessions(user.uid);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list chat sessions", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const input = createSchema.parse(await request.json());
    const title = input.title ?? deriveTitle(input.messages);
    const session = await createSession(user.uid, {
      title,
      messages: input.messages,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to create chat session", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}

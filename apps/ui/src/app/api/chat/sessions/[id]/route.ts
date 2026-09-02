import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/server/auth";
import {
  deleteSession,
  getSession,
  updateSession,
} from "@/server/chat/session-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(10_000),
        }),
      )
      .min(1)
      .max(200)
      .optional(),
    title: z.string().min(1).max(200).optional(),
  })
  .refine((value) => value.messages !== undefined || value.title !== undefined, {
    message: "messages か title が必要です",
  });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const session = await getSession(user.uid, id);
    if (!session) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to load chat session", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const updated = await updateSession(user.uid, id, input);
    if (!updated) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    console.error("Failed to update chat session", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    await deleteSession(user.uid, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete chat session", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

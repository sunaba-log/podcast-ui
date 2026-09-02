import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, requireAdmin } from "@/server/auth";
import { getDbPool } from "@/server/db";
import {
  addPreRegisteredEmail,
  listPreRegisteredEmails,
} from "@/server/admin/pre-registered-emails-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    const emails = await listPreRegisteredEmails(await getDbPool());
    return NextResponse.json({ emails });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to list pre-registered emails", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    const { email } = postSchema.parse(await request.json());
    await addPreRegisteredEmail(await getDbPool(), email);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to add pre-registered email", error);
    return NextResponse.json({ error: "追加に失敗しました" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, requireAdmin } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { removePreRegisteredEmail } from "@/server/admin/pre-registered-emails-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailSchema = z.string().trim().toLowerCase().email();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ email: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    // パスセグメントの "@" は %エンコードで届くためデコードしてから検証する
    const email = emailSchema.parse(
      decodeURIComponent((await context.params).email),
    );
    await removePreRegisteredEmail(await getDbPool(), email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to remove pre-registered email", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

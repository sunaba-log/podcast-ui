import { NextResponse } from "next/server";
import { getSessionUser, requireAdmin } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { listUsers } from "@/server/admin/users-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    const users = await listUsers(await getDbPool());
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    console.error("Failed to list users", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

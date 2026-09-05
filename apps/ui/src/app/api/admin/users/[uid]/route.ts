import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, requireAdmin } from "@/server/auth";
import { getDbPool } from "@/server/db";
import { isAdminUser } from "@/server/env";
import {
  deleteUser,
  getUserEmail,
  setApprovalStatus,
} from "@/server/admin/users-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  approvalStatus: z.enum(["pending_approval", "active"]),
});

// 管理者メールのユーザーは常に active 扱いのため、変更・削除の対象にしない
async function ensureNotAdminTarget(uid: string): Promise<void> {
  const email = await getUserEmail(await getDbPool(), uid);
  if (email && isAdminUser(email)) {
    throw new Error("ADMIN_TARGET");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    const { uid } = await context.params;
    await ensureNotAdminTarget(uid);
    const { approvalStatus } = patchSchema.parse(await request.json());
    await setApprovalStatus(await getDbPool(), uid, approvalStatus);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "ADMIN_TARGET") {
      return NextResponse.json(
        { error: "管理者ユーザーは変更できません" },
        { status: 400 },
      );
    }
    console.error("Failed to update user approval status", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    requireAdmin(user);

    const { uid } = await context.params;
    await ensureNotAdminTarget(uid);
    await deleteUser(await getDbPool(), uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "操作権限がありません" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "ADMIN_TARGET") {
      return NextResponse.json(
        { error: "管理者ユーザーは削除できません" },
        { status: 400 },
      );
    }
    console.error("Failed to delete user", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}

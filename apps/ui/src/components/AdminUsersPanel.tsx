"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Users } from "lucide-react";
import type { AdminUser } from "@/server/admin/users-repository";

type AdminUserItem = AdminUser & { isAdmin: boolean };


export function AdminUsersPanel({
  users,
  isAdmin,
}: {
  users: AdminUserItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center text-xs text-gray-500 gap-2">
          <span>ホーム</span>
          <span>&gt;</span>
          <span className="font-medium text-gray-800">ユーザー管理</span>
        </div>

        <div className="rounded-xs border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            このページは管理者のみアクセスできます。管理者権限がない場合は、管理者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  async function setApprovalStatus(
    uid: string,
    approvalStatus: AdminUser["approvalStatus"],
  ) {
    try {
      setPendingUid(uid);
      setError("");
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "更新に失敗しました");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新に失敗しました");
    } finally {
      setPendingUid(null);
    }
  }

  async function deleteUser(uid: string) {
    try {
      setPendingUid(uid);
      setError("");
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "削除に失敗しました");
      }
      setConfirmDeleteId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除に失敗しました");
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center text-xs text-gray-500 gap-2">
        <span>ホーム</span>
        <span>&gt;</span>
        <span className="font-medium text-gray-800">ユーザー管理</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-xs border border-brand/30 p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand" />
            ユーザー管理
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            「制限あり」のユーザーは AI チャット・エピソードアップロードがお試し枠（少回数）のみ。制限を解除すると通常枠で利用できます。
          </p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">ユーザーがいません</p>
          </div>
        ) : (
          <ul className="border-t border-gray-100 pt-4 space-y-2">
            {users.map((user) => {
              const busy = pendingUid !== null;
              return (
                <li
                  key={user.uid}
                  className="rounded-xs border border-brand/20 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {user.displayName || user.email}
                        </span>
                        {user.isAdmin && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-subtle text-brand">
                            管理者
                          </span>
                        )}
                        {!user.isAdmin &&
                          user.approvalStatus === "pending_approval" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              制限あり
                            </span>
                          )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{user.email}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        登録日時: {new Date(user.createdAt).toLocaleString("ja-JP")}
                      </p>
                    </div>

                    {!user.isAdmin && (
                      <div className="shrink-0 flex gap-2">
                        {user.approvalStatus === "pending_approval" ? (
                          <button
                            type="button"
                            onClick={() => setApprovalStatus(user.uid, "active")}
                            disabled={busy}
                            className="px-4 py-2 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover disabled:opacity-50"
                          >
                            {pendingUid === user.uid ? "処理中..." : "制限を解除"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setApprovalStatus(user.uid, "pending_approval")
                            }
                            disabled={busy}
                            className="px-4 py-2 text-xs border border-gray-400 text-gray-700 rounded-xs hover:bg-gray-100 disabled:opacity-50"
                          >
                            {pendingUid === user.uid ? "処理中..." : "制限をかける"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(user.uid)}
                          disabled={busy}
                          title="削除"
                          className="p-2 text-gray-500 hover:text-red-600 rounded-xs hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {confirmDeleteId === user.uid && (
                    <div className="mt-3 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-red-700">
                        このユーザーとチャンネル所有権を削除します。取り消せません。
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => deleteUser(user.uid)}
                          disabled={pendingUid !== null}
                          className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          {pendingUid === user.uid ? "削除中..." : "削除する"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-4 py-1.5 text-xs border border-gray-400 text-gray-700 rounded-xs hover:bg-gray-100"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

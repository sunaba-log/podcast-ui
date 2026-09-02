"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, Trash2 } from "lucide-react";
import type { PreRegisteredEmail } from "@/server/admin/pre-registered-emails-repository";

export function AdminPreRegisteredEmailsPanel({
  emails,
}: {
  emails: PreRegisteredEmail[];
}) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(
    null,
  );

  async function addEmail(event: React.FormEvent) {
    event.preventDefault();
    try {
      setPending(true);
      setError("");
      const response = await fetch("/api/admin/pre-registered-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "追加に失敗しました");
      }
      setNewEmail("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "追加に失敗しました");
    } finally {
      setPending(false);
    }
  }

  async function removeEmail(email: string) {
    try {
      setPending(true);
      setError("");
      const response = await fetch(
        `/api/admin/pre-registered-emails/${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "削除に失敗しました");
      }
      setConfirmDeleteEmail(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-xs border border-brand/30 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MailPlus className="w-5 h-5 text-brand" />
            事前登録メール管理
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            このリストにあるメールアドレスのみ新規ユーザ登録できます。管理者メールは事前登録不要です。
          </p>
        </div>

        <form onSubmit={addEmail} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="user@example.com"
            required
            maxLength={255}
            className="flex-1 px-3.5 py-2 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          <button
            type="submit"
            disabled={pending || newEmail.trim().length === 0}
            className="px-4 py-2 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover disabled:opacity-50 shrink-0"
          >
            {pending ? "処理中..." : "追加"}
          </button>
        </form>

        {emails.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">事前登録されたメールはありません</p>
          </div>
        ) : (
          <ul className="border-t border-gray-100 pt-4 space-y-2">
            {emails.map((item) => (
              <li
                key={item.email}
                className="rounded-xs border border-brand/20 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {item.email}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      事前登録日時: {new Date(item.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteEmail(item.email)}
                    disabled={pending}
                    title="削除"
                    className="p-2 text-gray-500 hover:text-red-600 rounded-xs hover:bg-red-50 disabled:opacity-50 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {confirmDeleteEmail === item.email && (
                  <div className="mt-3 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-red-700">
                      このメールアドレスの事前登録を削除します。未登録のユーザは登録できなくなります。
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeEmail(item.email)}
                        disabled={pending}
                        className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-xs hover:bg-red-700 disabled:opacity-50"
                      >
                        {pending ? "削除中..." : "削除する"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEmail(null)}
                        className="px-4 py-1.5 text-xs border border-gray-400 text-gray-700 rounded-xs hover:bg-gray-100"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

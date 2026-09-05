"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { UserCircle, Save, AlertTriangle } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function AccountSettings({
  email,
  displayName: initialDisplayName,
}: {
  email: string;
  displayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveDisplayName(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setSaved(false);
      setError("");
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "更新に失敗しました");
      }
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function unregister() {
    try {
      setDeleting(true);
      setError("");
      const response = await fetch("/api/users", { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "退会に失敗しました");
      }
      try {
        await signOut(getFirebaseAuth());
      } catch {
        // モック認証時のエラーは無視する
      }
      router.push("/login");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "退会に失敗しました");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center text-xs text-gray-500 gap-2">
        <span>ホーム</span>
        <span>&gt;</span>
        <span className="font-medium text-gray-800">アカウント設定</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-xs border border-brand/30 p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-brand" />
            アカウント設定
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            ログイン中のアカウントの表示名を変更できます。
          </p>
        </div>

        <form onSubmit={saveDisplayName} className="space-y-4 border-t border-gray-100 pt-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              メールアドレス
            </label>
            <p className="text-sm text-gray-600">{email}</p>
          </div>
          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              表示名
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
              }}
              required
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-emerald-600 font-semibold">
              {saved ? "表示名を更新しました" : ""}
            </span>
            <button
              type="submit"
              disabled={saving || displayName.trim().length === 0}
              className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xs text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xs border border-red-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            退会
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            アカウントを削除し、すべてのチャンネルへの所属を解除します。この操作は取り消せません。
          </p>
        </div>

        {confirmingDelete ? (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm text-gray-800">本当に退会しますか？</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={unregister}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xs text-sm font-medium disabled:opacity-50"
              >
                {deleting ? "退会処理中..." : "退会する"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-5 py-2 border border-gray-400 text-gray-700 rounded-xs text-sm hover:bg-gray-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="border-t border-gray-100 pt-4 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            退会する
          </button>
        )}
      </div>
    </div>
  );
}

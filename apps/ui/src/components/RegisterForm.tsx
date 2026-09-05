"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm({
  email,
  defaultDisplayName,
}: {
  email: string;
  defaultDisplayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "ユーザ登録に失敗しました");
      }
      // 登録時にデフォルトチャンネルが作成され選択済みのためエピソード画面へ
      router.push("/episodes");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "ユーザ登録に失敗しました",
      );
      setLoading(false);
    }
  }

  return (
    <div className="border border-brand rounded-xs p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900">ユーザ登録</h1>
      <p className="mt-2 text-sm text-gray-500">
        {email} で利用を開始します。表示名を確認して登録してください。
      </p>
      {error && (
        <p className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={register} className="mt-6 space-y-4">
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
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <button
          type="submit"
          disabled={loading || displayName.trim().length === 0}
          className="w-full px-4 py-2 bg-brand text-white text-sm font-medium rounded-xs hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "登録中..." : "登録して開始"}
        </button>
      </form>
    </div>
  );
}

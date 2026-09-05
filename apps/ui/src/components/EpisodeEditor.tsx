"use client";

import { useState } from "react";
import type { Episode } from "@/types/episode";

export function EpisodeEditor({ episode }: { episode: Episode }) {
  const [minutes, setMinutes] = useState(episode.minutes);
  const [posts, setPosts] = useState(episode.xPosts);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function save() {
    try {
      setStatus("saving");
      setError("");
      const response = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes,
          promotions: posts.map((post) => ({
            id: post.id,
            message: post.message,
          })),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "保存に失敗しました");
      setStatus("saved");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "保存に失敗しました");
    }
  }

  return (
    <div className="grid gap-5">
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">議事録</h2>
        <textarea
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value);
            setStatus("idle");
          }}
          rows={18}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed text-gray-800"
          placeholder="まだ議事録が生成されていません"
        />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          X投稿文リコメンド
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-400">
            まだX投稿文が生成されていません
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <label key={post.id} className="block">
                <span className="text-xs text-gray-500">候補 {index + 1}</span>
                <textarea
                  value={post.message}
                  onChange={(event) => {
                    const message = event.target.value;
                    setPosts((current) =>
                      current.map((item) =>
                        item.id === post.id ? { ...item, message } : item,
                      ),
                    );
                    setStatus("idle");
                  }}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800"
                />
                <span className="text-xs text-gray-400">
                  {post.message.length}文字
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "saving" ? "保存中..." : "変更を保存"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-green-700">保存しました</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-700">{error}</span>
        )}
      </div>
    </div>
  );
}

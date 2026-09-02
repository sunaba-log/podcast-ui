"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Radio, Pencil, Trash2, Star } from "lucide-react";
import type { PodcastSummary } from "@/types/podcast";

const ROLE_LABELS: Record<PodcastSummary["role"], string> = {
  owner: "オーナー",
  editor: "編集者",
};

export function ChannelManager({
  podcasts,
  selectedPodcastId,
  defaultPodcastId,
}: {
  podcasts: PodcastSummary[];
  selectedPodcastId: number | null;
  defaultPodcastId: number | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);

  async function selectChannel(podcastId: number) {
    try {
      setPendingId(podcastId);
      setError("");
      const response = await fetch("/api/podcasts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "チャンネルの切り替えに失敗しました");
      }
      // 全画面を切り替えるため完全リロードする
      window.location.assign("/episodes");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "チャンネルの切り替えに失敗しました",
      );
      setPendingId(null);
    }
  }

  async function setDefault(podcastId: number) {
    try {
      setSettingDefaultId(podcastId);
      setError("");
      const response = await fetch("/api/podcasts/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "デフォルト設定に失敗しました");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "デフォルト設定に失敗しました",
      );
    } finally {
      setSettingDefaultId(null);
    }
  }

  function startEdit(podcast: PodcastSummary) {
    setEditingId(podcast.id);
    setEditTitle(podcast.title);
    setEditDescription(podcast.description ?? "");
    setError("");
  }

  async function saveEdit(podcastId: number) {
    try {
      setSavingEdit(true);
      setError("");
      const response = await fetch(`/api/podcasts/${podcastId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "更新に失敗しました");
      }
      setEditingId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteChannel(podcastId: number) {
    try {
      setPendingId(podcastId);
      setError("");
      const response = await fetch(`/api/podcasts/${podcastId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "削除に失敗しました");
      }
      setConfirmingDeleteId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除に失敗しました");
    } finally {
      setPendingId(null);
    }
  }

  async function createChannel(event: React.FormEvent) {
    event.preventDefault();
    try {
      setCreating(true);
      setError("");
      const response = await fetch("/api/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "チャンネルの作成に失敗しました");
      }
      router.push("/episodes");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "チャンネルの作成に失敗しました",
      );
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center text-xs text-gray-500 gap-2">
        <span>ホーム</span>
        <span>&gt;</span>
        <span className="font-medium text-gray-800">チャンネル管理</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-xs border border-brand/30 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-brand" />
              チャンネル管理
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              所属チャンネルの切り替え・編集・削除ができます。⭐️ はチャンネル未選択時に開く「デフォルト」です。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((show) => !show)}
            className="shrink-0 px-4 py-2 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> 新規チャンネル
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={createChannel}
            className="space-y-3 border border-brand/20 rounded-xs p-4 bg-brand-subtle/20"
          >
            <div>
              <label
                htmlFor="channelTitle"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                チャンネル名
              </label>
              <input
                id="channelTitle"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={255}
                className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div>
              <label
                htmlFor="channelDescription"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                概要（任意）
              </label>
              <textarea
                id="channelDescription"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || title.trim().length === 0}
                className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xs text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating ? "作成中..." : "作成する"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-5 py-2 border border-gray-400 text-gray-700 rounded-xs text-sm hover:bg-gray-100"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        <ul className="border-t border-gray-100 pt-4 space-y-2">
          {podcasts.map((podcast) => {
            const isSelected = podcast.id === selectedPodcastId;
            const isDefault = podcast.id === defaultPodcastId;
            const isOwner = podcast.role === "owner";
            const isEditing = editingId === podcast.id;
            const isConfirmingDelete = confirmingDeleteId === podcast.id;
            return (
              <li
                key={podcast.id}
                className={`rounded-xs border p-4 ${
                  isSelected ? "border-brand bg-brand-light/40" : "border-brand/20"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                      maxLength={255}
                      className="w-full px-3 py-2 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="概要（任意）"
                      className="w-full px-3 py-2 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(podcast.id)}
                        disabled={savingEdit || editTitle.trim().length === 0}
                        className="px-4 py-1.5 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover disabled:opacity-50"
                      >
                        {savingEdit ? "保存中..." : "保存"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={savingEdit}
                        className="px-4 py-1.5 text-xs border border-gray-400 text-gray-700 rounded-xs hover:bg-gray-100"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setDefault(podcast.id)}
                      disabled={isDefault || settingDefaultId !== null}
                      title={isDefault ? "デフォルトのチャンネル" : "デフォルトに設定"}
                      className={`shrink-0 p-1 rounded-xs transition-colors ${
                        isDefault
                          ? "text-amber-500"
                          : "text-gray-300 hover:text-amber-500"
                      } disabled:cursor-default`}
                    >
                      <Star
                        className="w-5 h-5"
                        fill={isDefault ? "currentColor" : "none"}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {podcast.title}
                        </span>
                        {podcast.role !== "owner" && (
                          <span className="text-[10px] text-gray-600 border border-gray-300 rounded-full px-2 py-0.5 shrink-0">
                            {ROLE_LABELS[podcast.role]}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-brand border border-brand rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" /> 選択中
                          </span>
                        )}
                        {isDefault && (
                          <span className="text-[10px] font-semibold text-amber-600 border border-amber-300 rounded-full px-2 py-0.5 shrink-0">
                            デフォルト
                          </span>
                        )}
                      </div>
                      {podcast.description && (
                        <p className="mt-1 text-xs text-gray-500 truncate">
                          {podcast.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => selectChannel(podcast.id)}
                          disabled={pendingId !== null}
                          className="px-4 py-2 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover disabled:opacity-50"
                        >
                          {pendingId === podcast.id ? "切り替え中..." : "切り替え"}
                        </button>
                      )}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => router.push("/episodes")}
                          className="px-4 py-2 text-xs font-medium bg-brand text-white rounded-xs hover:bg-brand-hover"
                        >
                          エピソード管理
                        </button>
                      )}
                      {isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(podcast)}
                            title="編集"
                            className="p-2 text-gray-500 hover:text-brand rounded-xs hover:bg-brand-subtle/40"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(podcast.id)}
                            title="削除"
                            className="p-2 text-gray-500 hover:text-red-600 rounded-xs hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {isConfirmingDelete && (
                  <div className="mt-3 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-red-700">
                      このチャンネルとそのエピソードを削除します。取り消せません。
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => deleteChannel(podcast.id)}
                        disabled={pendingId !== null}
                        className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-xs hover:bg-red-700 disabled:opacity-50"
                      >
                        {pendingId === podcast.id ? "削除中..." : "削除する"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
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
      </div>
    </div>
  );
}

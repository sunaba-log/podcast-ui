"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Clock, CheckCircle2, X } from "lucide-react";

export type SNSPostItem = {
  id: string;
  episodeId: string;
  episodeTitle: string;
  status: "pending" | "posted";
  scheduledDate: { yyyy: string; mm: string; dd: string; hh: string; min: string };
  message: string;
  platformUrls: { apple: string; amazon: string; spotify: string };
  hashtags: string[];
  generatedAt: string;
  updatedAt: string;
};

export function SNSPostMasterDetail({
  initialPosts = [],
  initialHasMore = false,
  initialSelectedId,
}: {
  initialPosts?: SNSPostItem[];
  initialHasMore?: boolean;
  /** ディープリンク（/sns?post=...）で初期選択する投稿 ID。 */
  initialSelectedId?: string;
}) {
  const [posts, setPosts] = useState<SNSPostItem[]>(initialPosts);
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (
      initialSelectedId &&
      initialPosts.some((p) => p.id === initialSelectedId)
    ) {
      return initialSelectedId;
    }
    return initialPosts.length > 0 ? initialPosts[0].id : "";
  });

  // クライアント遷移（チャットのリンク等）では再マウントされないため、
  // ディープリンク先の変化に合わせてレンダー中に選択を調整する。
  // 対象の投稿が読み込み済みリストに無い場合はサーバーがマージ済みの
  // initialPosts から補う。
  const [prevInitialSelectedId, setPrevInitialSelectedId] =
    useState(initialSelectedId);
  if (initialSelectedId !== prevInitialSelectedId) {
    setPrevInitialSelectedId(initialSelectedId);
    if (initialSelectedId) {
      setPosts((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        const added = initialPosts.filter((p) => !existing.has(p.id));
        return added.length > 0 ? [...prev, ...added] : prev;
      });
      setSelectedId(initialSelectedId);
    }
  }

  // ディープリンクで選択した投稿を一覧内にスクロール表示する。
  const listItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!initialSelectedId) return;
    listItemRefs.current[initialSelectedId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [initialSelectedId]);

  const selectedPost = posts.find((p) => p.id === selectedId) || posts[0];

  // Inspector form state
  const [scheduledDate, setScheduledDate] = useState(() =>
    selectedPost
      ? selectedPost.scheduledDate
      : { yyyy: "", mm: "", dd: "", hh: "", min: "" }
  );
  const [message, setMessage] = useState(() => (selectedPost ? selectedPost.message : ""));
  const [platformUrls, setPlatformUrls] = useState(() =>
    selectedPost ? selectedPost.platformUrls : { apple: "", amazon: "", spotify: "" }
  );
  const [hashtags, setHashtags] = useState<string[]>(() =>
    selectedPost ? selectedPost.hashtags : []
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isSaving, setIsSaving] = useState(false);

  // Pagination states
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [offset, setOffset] = useState(initialPosts.length > 0 ? 5 : 0);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Synchronize inspector fields when the selected post changes.
  // (React 推奨の「prop 変化に合わせた state 調整」パターン: レンダー中に前回値と比較)
  const [prevSelectedPostId, setPrevSelectedPostId] = useState(selectedPost?.id);
  if (selectedPost && selectedPost.id !== prevSelectedPostId) {
    setPrevSelectedPostId(selectedPost.id);
    setScheduledDate(selectedPost.scheduledDate);
    setMessage(selectedPost.message);
    setPlatformUrls(selectedPost.platformUrls);
    setHashtags(selectedPost.hashtags);
    setSaveStatus("idle");
  }

  // If no post is selected but posts exist, select the first one.
  if (!selectedId && posts.length > 0) {
    setSelectedId(posts[0].id);
  }

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sns?limit=5&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to load posts");
      const data = (await res.json()) as { posts: SNSPostItem[]; hasMore: boolean };
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = data.posts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setHasMore(data.hasMore);
      setOffset((prev) => prev + 5);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, offset]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin: "100px",
      }
    );
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoading, loadMore]);

  const handleSelect = (post: SNSPostItem) => {
    setSelectedId(post.id);
  };

  const handleAddHashtag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTagInput.trim()) {
      e.preventDefault();
      if (!hashtags.includes(newTagInput.trim())) {
        setHashtags([...hashtags, newTagInput.trim()]);
      }
      setNewTagInput("");
    }
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!selectedPost) return;
    setIsSaving(true);
    try {
      const dateStr = `${scheduledDate.yyyy}-${scheduledDate.mm.padStart(2, "0")}-${scheduledDate.dd.padStart(2, "0")}T${scheduledDate.hh.padStart(2, "0")}:${scheduledDate.min.padStart(2, "0")}:00`;
      const dateObj = new Date(dateStr);
      const scheduledTime = isNaN(dateObj.getTime()) ? null : dateObj.toISOString();

      const res = await fetch("/api/sns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: selectedPost.episodeId,
          id: selectedPost.id,
          message,
          scheduledTime,
          platformUrls,
          hashtags,
          status: selectedPost.status,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save post");
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? {
              ...p,
              scheduledDate,
              message,
              platformUrls,
              hashtags,
            }
            : p
        )
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    if (!confirm("この投稿文を削除してもよろしいですか？")) return;

    try {
      const res = await fetch(
        `/api/sns?episodeId=${selectedPost.episodeId}&id=${selectedPost.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete post");
      }

      const updatedPosts = posts.filter((p) => p.id !== selectedPost.id);
      setPosts(updatedPosts);
      if (updatedPosts.length > 0) {
        setSelectedId(updatedPosts[0].id);
      } else {
        setSelectedId("");
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Breadcrumb Header */}
      <div className="flex items-center text-xs text-gray-500 gap-2 shrink-0">
        <span>ホーム</span>
        <span>&gt;</span>
        <span className="font-medium text-gray-800">SNS投稿</span>
      </div>

      {/* Master-Detail Container */}
      <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
        {/* Left Column: Timeline Master List (6 cols) */}
        <div
          ref={containerRef}
          className="col-span-6 flex flex-col space-y-4 overflow-y-auto pr-2 relative"
        >
          {/* Vertical Timeline Line */}
          <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-300 z-0" />

          {posts.map((post) => {
            const isSelected = selectedPost && post.id === selectedPost.id;
            return (
              <div
                key={post.id}
                ref={(el) => {
                  listItemRefs.current[post.id] = el;
                }}
                className="flex items-start gap-4 relative z-10"
              >
                {/* Timeline Icon Node */}
                <div className="mt-1 shrink-0 bg-app-bg p-1 rounded-full">
                  {post.status === "pending" ? (
                    <Clock className="w-5 h-5 text-gray-800 fill-gray-800 text-white" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-gray-400 fill-gray-200" />
                  )}
                </div>

                {/* Date Label Pill */}
                <div className="mt-2 shrink-0 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-gray-200/80 text-gray-700">
                  {post.scheduledDate.yyyy}/{post.scheduledDate.mm}/{post.scheduledDate.dd}
                </div>

                {/* Post Preview Card */}
                <div
                  onClick={() => handleSelect(post)}
                  className={`flex-1 p-4 rounded-xl cursor-pointer transition-all duration-150 border bg-white/40 ${isSelected
                    ? "border-2 border-brand shadow-sm"
                    : "border-gray-200 hover:border-brand/50 shadow-sm"
                    }`}
                >
                  {/* Mock Twitter Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold text-xs">
                        SC
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 leading-none">
                          SparkCast Official
                        </div>
                        <div className="text-[10px] text-gray-400">@sparkcast_jp</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-800 leading-relaxed line-clamp-3 mb-2">
                    {post.message}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                    <span>
                      {post.scheduledDate.hh}:{post.scheduledDate.min}
                    </span>
                    <span>・</span>
                    <span className="text-brand font-medium">
                      #{post.episodeId} {post.episodeTitle}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Infinite Scroll Sentinel */}
          <div ref={sentinelRef} className="h-4 w-full shrink-0" />

          {isLoading && (
            <div className="flex justify-center items-center py-4 shrink-0">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand" />
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="text-center text-xs text-gray-400 py-4 shrink-0">
              すべての過去のエピソードを読み込みました
            </div>
          )}

          {posts.length === 0 && !isLoading && (
            <div className="text-center text-sm text-gray-400 py-8">
              SNS投稿文が見つかりません
            </div>
          )}
        </div>

        {/* Right Column: Inspector Panel (6 cols) */}
        {selectedPost ? (
          <div className="col-span-6 rounded-sm border-l border-brand/30 flex flex-col overflow-hidden">
            {/* Top Action Bar */}
            <div className="px-5 py-1 border-b border-brand flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-xs text-xs font-semibold ${selectedPost.status === "pending" ? "bg-brand text-white" : "bg-emerald-600 text-white"
                  }`}
              >
                {selectedPost.status === "pending" ? "投稿予定" : "投稿済み"}
              </span>

              <button
                onClick={handleDelete}
                className="px-3 py-1 border border-gray-300 rounded-xs text-xs font-medium text-brand flex items-center gap-1 hover:bg-gray-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                削除
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="text-xs text-gray-500">更新日時 : {selectedPost.updatedAt}</div>

              {/* Form: Scheduled Datetime */}
              <div>
                <label className="block text-xs font-semibold mb-1.5">投稿日時</label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={scheduledDate.yyyy}
                    onChange={(e) => setScheduledDate({ ...scheduledDate, yyyy: e.target.value })}
                    className="col-span-3 px-1 py-2 rounded-xs border border-brand text-sm text-center focus:outline-none focus:border-brand"
                    placeholder="YYYY"
                  />
                  <input
                    type="text"
                    value={scheduledDate.mm}
                    onChange={(e) => setScheduledDate({ ...scheduledDate, mm: e.target.value })}
                    className="col-span-2 rounded-xs border border-brand text-sm text-center focus:outline-none focus:border-brand"
                    placeholder="MM"
                  />
                  <input
                    type="text"
                    value={scheduledDate.dd}
                    onChange={(e) => setScheduledDate({ ...scheduledDate, dd: e.target.value })}
                    className="col-span-2 rounded-xs border border-brand text-sm text-center focus:outline-none focus:border-brand"
                    placeholder="DD"
                  />
                  <div className="col-span-1 flex items-center justify-center font-bold">:</div>
                  <input
                    type="text"
                    value={scheduledDate.hh}
                    onChange={(e) => setScheduledDate({ ...scheduledDate, hh: e.target.value })}
                    className="col-span-2 rounded-xs border border-brand text-sm text-center focus:outline-none focus:border-brand"
                    placeholder="HH"
                  />
                  <input
                    type="text"
                    value={scheduledDate.min}
                    onChange={(e) => setScheduledDate({ ...scheduledDate, min: e.target.value })}
                    className="col-span-2 rounded-xs border border-brand text-sm text-center focus:outline-none focus:border-brand"
                    placeholder="mm"
                  />
                </div>
              </div>

              {/* Form: Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message</label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>

              {/* Form: Platform URLs */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">URL</label>
                <input
                  type="text"
                  value={platformUrls.apple}
                  onChange={(e) => setPlatformUrls({ ...platformUrls, apple: e.target.value })}
                  placeholder="Apple Podcast"
                  className="w-full px-3.5 py-2 rounded-xs border border-brand text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-brand"
                />
                <input
                  type="text"
                  value={platformUrls.amazon}
                  onChange={(e) => setPlatformUrls({ ...platformUrls, amazon: e.target.value })}
                  placeholder="Amazon Music"
                  className="w-full px-3.5 py-2 rounded-xs border border-brand text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-brand"
                />
                <input
                  type="text"
                  value={platformUrls.spotify}
                  onChange={(e) => setPlatformUrls({ ...platformUrls, spotify: e.target.value })}
                  placeholder="Spotify"
                  className="w-full px-3.5 py-2 rounded-xs border border-brand text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-brand"
                />
              </div>

              {/* Form: Hashtags */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  ハッシュタグ
                </label>
                <div className="flex flex-wrap items-center gap-2 p-3 border border-brand rounded-xs">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-gray-200 text-gray-800 text-xs font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveHashtag(tag)}
                        className="text-gray-500 hover:text-gray-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddHashtag}
                    placeholder="+ タグを入力してEnter"
                    className="px-2 py-1 text-xs bg-transparent text-gray-700 focus:outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 border-t border-brand/30 flex items-center justify-between shrink-0">
              <div>
                {saveStatus === "saved" && (
                  <span className="text-xs text-emerald-600 font-semibold">変更を保存しました</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDate(selectedPost.scheduledDate);
                    setMessage(selectedPost.message);
                    setPlatformUrls(selectedPost.platformUrls);
                    setHashtags(selectedPost.hashtags);
                  }}
                  className="px-5 py-2 rounded-xs bg-gray-200/80 hover:bg-gray-300/80 text-gray-700 font-medium text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xs bg-brand hover:bg-brand-hover text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "変更"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="col-span-6 rounded-sm border-l border-brand/30 flex items-center justify-center text-sm text-gray-400">
            投稿文を選択してください
          </div>
        )}
      </div>
    </div>
  );
}

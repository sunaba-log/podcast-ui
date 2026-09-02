"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ChatMessage,
  ChatSessionDetail,
  ChatSessionSummary,
} from "@/types/chat";
import { normalizeChatHref } from "@/lib/chat-href";

const GREETING =
  "ポッドキャスト運営を手伝うアシスタントです。過去回の議事録・次回議題・SNS投稿の内容はリンク付きで答えます。アイデア出しや文章の相談など、それ以外の質問もどうぞ。";

const SUGGESTED_QUESTIONS = [
  "最近のエピソードの要点をまとめて",
  "次回の議題候補には何がある？",
  "最新エピソードのSNS投稿は何を予定してる？",
  "次回に向けたトークテーマのアイデアを出して",
];

const SCROLL_THRESHOLD = 80;

// Markdownを明示スタイルで描画する（Tailwindのpreflightで消える見出し/リストの
// 体裁を確実に当て、チャットバブル向けにコンパクトに整える）。
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-bold text-gray-900">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-bold text-gray-900">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-gray-900">{children}</h4>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-gray-300 pl-3 text-gray-600">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-gray-200 px-1 py-0.5 text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-gray-800 p-3 text-xs text-gray-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
  // LLM が崩した href（スラッシュ欠け・余計な ? 等）を正規化してから描画する。
  // 内部リンクはクライアント遷移にして、レイアウト常駐のチャットを開いたまま
  // 画面だけ切り替える。外部リンクは新規タブ + noopener。
  a: ({ href, children }) => {
    const normalized = normalizeChatHref(
      typeof href === "string" ? href : undefined,
    );
    if (normalized.isInternal) {
      return (
        <Link href={normalized.href} className="text-blue-600 underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={normalized.href || undefined}
        className="text-blue-600 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [reindexState, setReindexState] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (nearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, view]);

  async function loadSessions() {
    try {
      const response = await fetch("/api/chat/sessions");
      if (!response.ok) return;
      const data = (await response.json()) as { sessions?: ChatSessionSummary[] };
      setSessions(data.sessions ?? []);
    } catch {
      // 一覧取得の失敗は致命的でないため握りつぶす
    }
  }

  function toggleOpen() {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) void loadSessions();
  }

  function startNewChat() {
    setActiveSessionId(null);
    setTitle("");
    setMessages([]);
    setInput("");
    setError("");
    setRetryAvailable(false);
    nearBottomRef.current = true;
    setView("chat");
  }

  async function openSession(id: string) {
    setError("");
    setRetryAvailable(false);
    try {
      const response = await fetch(`/api/chat/sessions/${id}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as ChatSessionDetail;
      setActiveSessionId(data.id);
      setTitle(data.title);
      setMessages(data.messages);
      nearBottomRef.current = true;
      setView("chat");
    } catch {
      setError("チャットの読み込みに失敗しました");
    }
  }

  async function removeSession(id: string) {
    if (!window.confirm("このチャットを削除しますか？")) return;
    setSessions((current) => current.filter((session) => session.id !== id));
    if (id === activeSessionId) startNewChat();
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    } catch {
      // 削除失敗時は次回の一覧取得で復帰する
    }
  }

  async function renameSession(id: string, currentTitle: string) {
    const next = window.prompt("チャット名を変更", currentTitle);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentTitle) return;
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, title: trimmed } : session,
      ),
    );
    if (id === activeSessionId) setTitle(trimmed);
    try {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      // 失敗時は次回の一覧取得で復帰する
    }
  }

  function bumpSession(id: string) {
    const now = new Date().toISOString();
    setSessions((current) =>
      current
        .map((session) =>
          session.id === id ? { ...session, updatedAt: now } : session,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  async function createRemoteSession(
    initialMessages: ChatMessage[],
  ): Promise<ChatSessionSummary> {
    const response = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: initialMessages }),
    });
    if (!response.ok) throw new Error("チャットの作成に失敗しました");
    return (await response.json()) as ChatSessionSummary;
  }

  async function persistSession(id: string, finalMessages: ChatMessage[]) {
    try {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalMessages }),
      });
    } catch {
      // 保存失敗は表示中の会話には影響しないため握りつぶす
    }
  }

  // base は末尾がユーザー発言の配列。これに対する回答を生成・保存する。
  async function generate(base: ChatMessage[]) {
    setMessages([...base, { role: "assistant", content: "" }]);
    setError("");
    setRetryAvailable(false);
    setIsStreaming(true);
    nearBottomRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    let assistant = "";
    let sessionId = activeSessionId;

    try {
      if (!sessionId) {
        const created = await createRemoteSession(base);
        sessionId = created.id;
        setActiveSessionId(created.id);
        setTitle(created.title);
        setSessions((current) => [created, ...current]);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: base }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "応答の生成に失敗しました");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const updated = [...current];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistant,
          };
          return updated;
        });
      }
      if (!assistant) throw new Error("応答が空でした");

      const finalMessages: ChatMessage[] = [
        ...base,
        { role: "assistant", content: assistant },
      ];
      if (sessionId) {
        await persistSession(sessionId, finalMessages);
        bumpSession(sessionId);
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        // 停止: 生成済みの部分応答は保持する
        if (assistant) {
          const finalMessages: ChatMessage[] = [
            ...base,
            { role: "assistant", content: assistant },
          ];
          setMessages(finalMessages);
          if (sessionId) {
            await persistSession(sessionId, finalMessages);
            bumpSession(sessionId);
          }
        } else {
          setMessages(base);
        }
      } else {
        setMessages(base);
        setError(
          caught instanceof Error ? caught.message : "応答の生成に失敗しました",
        );
        setRetryAvailable(true);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await generate([...messages, { role: "user", content: text }]);
  }

  async function sendSuggestion(text: string) {
    if (isStreaming) return;
    await generate([...messages, { role: "user", content: text }]);
  }

  async function retry() {
    if (isStreaming) return;
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return;
    }
    await generate(messages);
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function reindex() {
    if (reindexState === "running") return;
    setReindexState("running");
    setError("");
    try {
      const response = await fetch("/api/chat/reindex", { method: "POST" });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "インデックス作成に失敗しました");
      }
      setReindexState("done");
    } catch (caught) {
      setReindexState("error");
      setError(
        caught instanceof Error ? caught.message : "インデックス作成に失敗しました",
      );
    }
  }

  return (
    <>
      <div
        className={`fixed top-16 right-6 z-50 flex h-[calc(100vh-6rem)] max-h-[48rem] w-[36rem] max-w-[calc(100vw-3rem)] flex-col rounded-sm border border-brand/60 bg-app-bg transition-all duration-300 ease-out origin-top-right ${isOpen
          ? "opacity-100 translate-x-0 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-x-4 -translate-y-4 scale-95 pointer-events-none"
          }`}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3">
          {view === "chat" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void loadSessions();
                  setView("history");
                }}
                aria-label="履歴を開く"
                title="履歴"
                className="text-gray-500 hover:text-blue-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h2 className="flex-1 truncate text-sm font-semibold text-gray-900">
                {title || "新しいチャット"}
              </h2>
              <button
                type="button"
                onClick={startNewChat}
                disabled={activeSessionId === null && messages.length === 0}
                aria-label="新しいチャット"
                title="新しいチャット"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                新規
              </button>
            </>
          ) : (
            <h2 className="flex-1 text-sm font-semibold text-gray-900">履歴</h2>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="チャットを閉じる"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {view === "history" ? (
          <>
            <div className="flex-1 overflow-y-auto p-2">
              <button
                type="button"
                onClick={startNewChat}
                className="mb-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
              >
                ＋ 新しいチャット
              </button>
              {sessions.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-gray-400">
                  まだ履歴がありません
                </p>
              ) : (
                <ul className="space-y-1">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      className={`flex items-center gap-1 rounded-md px-2 py-2 hover:bg-gray-100 ${session.id === activeSessionId ? "bg-blue-50" : ""
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => void openSession(session.id)}
                        className="flex-1 truncate text-left text-sm text-gray-800"
                      >
                        {session.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => void renameSession(session.id, session.title)}
                        aria-label="名前を変更"
                        title="名前を変更"
                        className="text-gray-300 hover:text-blue-500"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSession(session.id)}
                        aria-label="このチャットを削除"
                        title="削除"
                        className="text-gray-300 hover:text-red-500"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-200 p-2">
              <button
                type="button"
                onClick={() => void reindex()}
                disabled={reindexState === "running"}
                className="w-full rounded-md px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-50"
              >
                {reindexState === "running"
                  ? "ナレッジを更新中…"
                  : reindexState === "done"
                    ? "ナレッジを更新しました"
                    : "ナレッジ（議事録・議題・SNS）を更新"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                nearBottomRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight <
                  SCROLL_THRESHOLD;
              }}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-gray-500">{GREETING}</p>
                  <div className="flex flex-col items-start gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendSuggestion(question)}
                        className="rounded-full border border-gray-300 px-3 py-1.5 text-left text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={
                      message.role === "user" ? "flex justify-end" : "flex justify-start"
                    }
                  >
                    {message.role === "user" ? (
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
                        {message.content}
                      </div>
                    ) : (
                      <div className="max-w-[85%] rounded-lg bg-white/80 border border-brand/30 px-3 py-2 text-sm text-gray-800">
                        {message.content ? (
                          <div className="text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : isStreaming ? (
                          "…"
                        ) : (
                          ""
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              {error && (
                <div className="space-y-1">
                  <p className="text-xs text-red-600">{error}</p>
                  {retryAvailable && (
                    <button
                      type="button"
                      onClick={() => void retry()}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      再試行
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-3">
              <textarea
                id="chat-input"
                name="chat-input"
                aria-label="アシスタントに質問・相談する"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // IME変換確定のEnterでは送信しない（日本語入力対策）。
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="質問や相談を入力…"
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">
                  Enterで送信 / Shift+Enterで改行
                </span>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!input.trim()}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    送信
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={isOpen ? "チャットを閉じる" : "チャットを開く"}
        className={`px-4 py-2 text-xs font-normal rounded-xs flex items-center gap-1.5 transition-colors border ${isOpen
          ? "bg-brand text-white border-brand hover:bg-brand-hover"
          : "text-gray-600 hover:text-gray-900 border-gray-400 hover:bg-gray-200"
          }`}
      >
        {isOpen ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        <span>チャット</span>
      </button>
    </>
  );
}

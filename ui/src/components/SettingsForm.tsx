"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Radio, Rss, Key, RefreshCw, Eye, EyeOff } from "lucide-react";

export function SettingsForm({
  podcastId,
  title: initialTitle,
  description: initialDescription,
  rssFeedPath: initialRssFeedPath,
}: {
  podcastId: number;
  title: string;
  description: string;
  rssFeedPath: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [rssFeedPath, setRssFeedPath] = useState(initialRssFeedPath);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // シークレット用 State
  const [xApiKey, setXApiKey] = useState("");
  const [xApiSecret, setXApiSecret] = useState("");
  const [xAccessToken, setXAccessToken] = useState("");
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState("");
  const [discordBotToken, setDiscordBotToken] = useState("");

  // パスワード表示トグル用 State
  const [showXApiKey, setShowXApiKey] = useState(false);
  const [showXApiSecret, setShowXApiSecret] = useState(false);
  const [showXAccessToken, setShowXAccessToken] = useState(false);
  const [showXAccessTokenSecret, setShowXAccessTokenSecret] = useState(false);
  const [showDiscordBotToken, setShowDiscordBotToken] = useState(false);

  // 通信状態管理 State
  const [loadingSecrets, setLoadingSecrets] = useState(true);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [savedSecrets, setSavedSecrets] = useState(false);
  const [secretsError, setSecretsError] = useState("");

  // 初期ロード処理
  useEffect(() => {
    async function fetchSecrets() {
      try {
        setLoadingSecrets(true);
        const response = await fetch(`/api/podcasts/${podcastId}/secrets`);
        if (response.ok) {
          const data = await response.json();
          setXApiKey(data.x_api_key || "");
          setXApiSecret(data.x_api_secret || "");
          setXAccessToken(data.x_access_token || "");
          setXAccessTokenSecret(data.x_access_token_secret || "");
          setDiscordBotToken(data.discord_bot_token || "");
        } else {
          console.error("Failed to load secrets");
        }
      } catch (err) {
        console.error("Error loading secrets:", err);
      } finally {
        setLoadingSecrets(false);
      }
    }
    fetchSecrets();
  }, [podcastId]);

  // 保存処理
  async function handleSaveSecrets(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSavingSecrets(true);
      setSavedSecrets(false);
      setSecretsError("");
      const response = await fetch(`/api/podcasts/${podcastId}/secrets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x_api_key: xApiKey,
          x_api_secret: xApiSecret,
          x_access_token: xAccessToken,
          x_access_token_secret: xAccessTokenSecret,
          discord_bot_token: discordBotToken,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "シークレットの保存に失敗しました");
      }
      setSavedSecrets(true);
      // 保存完了後に再度読み込んでマスクされた状態に戻す
      const reloadResponse = await fetch(`/api/podcasts/${podcastId}/secrets`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        setXApiKey(data.x_api_key || "");
        setXApiSecret(data.x_api_secret || "");
        setXAccessToken(data.x_access_token || "");
        setXAccessTokenSecret(data.x_access_token_secret || "");
        setDiscordBotToken(data.discord_bot_token || "");
      }
    } catch (caught) {
      setSecretsError(
        caught instanceof Error ? caught.message : "シークレットの保存に失敗しました"
      );
    } finally {
      setSavingSecrets(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setSaved(false);
      setError("");
      const response = await fetch(`/api/podcasts/${podcastId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          rssFeedPath: rssFeedPath.trim(),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "設定の保存に失敗しました");
      }
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center text-xs text-gray-500 gap-2">
        <span>ホーム</span>
        <span>&gt;</span>
        <span className="font-medium text-gray-800">番組設定</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-xs border border-brand/30 p-6 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand" />
            番組基本設定
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            選択中チャンネルのメタデータ設定です。
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5 border-t border-gray-100 pt-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              番組名
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              required
              maxLength={255}
              className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              番組概要
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 rounded-xs border border-brand text-sm text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Rss className="w-3.5 h-3.5 text-orange-500" /> RSS Feed URL
            </label>
            <input
              type="text"
              value={rssFeedPath}
              onChange={(e) => {
                setRssFeedPath(e.target.value);
                setSaved(false);
              }}
              maxLength={2000}
              className="w-full px-3.5 py-2 rounded-xs border border-brand text-xs font-mono text-gray-800 focus:outline-none focus:border-brand"
            />
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-gray-100">
            <span className="text-xs text-emerald-600 font-semibold">
              {saved ? "設定を更新しました" : ""}
            </span>
            <button
              type="submit"
              disabled={saving || title.trim().length === 0}
              className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xs text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "保存中..." : "設定を保存"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xs border border-brand/30 p-6 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-brand" />
            外部連携・シークレット設定
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            SNS自動投稿やDiscord連携に必要な API キーやトークンを設定します。全項目を入力すると機能が有効化され、すべて空の状態で保存するとリセットされます。
          </p>
        </div>

        {secretsError && (
          <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {secretsError}
          </p>
        )}

        {loadingSecrets ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-500 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand" />
            シークレット情報をロード中...
          </div>
        ) : (
          <form onSubmit={handleSaveSecrets} className="space-y-5 border-t border-gray-100 pt-5">
            <div className="space-y-6">
              {/* X (Twitter) 連携 */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-1.5">
                  X (Twitter) 連携設定
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showXApiKey ? "text" : "password"}
                        value={xApiKey}
                        onChange={(e) => {
                          setXApiKey(e.target.value);
                          setSavedSecrets(false);
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setShowXApiKey(!showXApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showXApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      API Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showXApiSecret ? "text" : "password"}
                        value={xApiSecret}
                        onChange={(e) => {
                          setXApiSecret(e.target.value);
                          setSavedSecrets(false);
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setShowXApiSecret(!showXApiSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showXApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Access Token
                    </label>
                    <div className="relative">
                      <input
                        type={showXAccessToken ? "text" : "password"}
                        value={xAccessToken}
                        onChange={(e) => {
                          setXAccessToken(e.target.value);
                          setSavedSecrets(false);
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setShowXAccessToken(!showXAccessToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showXAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Access Token Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showXAccessTokenSecret ? "text" : "password"}
                        value={xAccessTokenSecret}
                        onChange={(e) => {
                          setXAccessTokenSecret(e.target.value);
                          setSavedSecrets(false);
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setShowXAccessTokenSecret(!showXAccessTokenSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showXAccessTokenSecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discord 連携 */}
              <div className="space-y-4 pt-4">
                <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-1.5">
                  Discord 連携設定
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Discord Bot Token
                    </label>
                    <div className="relative">
                      <input
                        type={showDiscordBotToken ? "text" : "password"}
                        value={discordBotToken}
                        onChange={(e) => {
                          setDiscordBotToken(e.target.value);
                          setSavedSecrets(false);
                        }}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xs border border-brand text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDiscordBotToken(!showDiscordBotToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showDiscordBotToken ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-gray-100">
              <span className="text-xs text-emerald-600 font-semibold">
                {savedSecrets ? "シークレット設定を更新しました" : ""}
              </span>
              <button
                type="submit"
                disabled={savingSecrets}
                className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xs text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />{" "}
                {savingSecrets ? "保存中..." : "シークレットを保存"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

type UploadStatus = "idle" | "preparing" | "uploading" | "success" | "error";
type SupportedAudioContentType = "audio/mpeg" | "audio/mp4" | "audio/x-m4a" | "audio/m4a";

type UploadPreparation = {
  episodeId: number;
  podcastId: number;
  objectPath: string;
  uploadUrl: string;
  expiresAt: string;
};

function getSupportedAudioContentType(file: File): SupportedAudioContentType | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  if (lowerName.endsWith(".m4a")) {
    if (file.type === "audio/x-m4a" || file.type === "audio/m4a") return file.type;
    return "audio/mp4";
  }
  return null;
}

export function UploadForm({ podcastId }: { podcastId: number }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedEpisodeId, setUploadedEpisodeId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && !getSupportedAudioContentType(file)) {
      setErrorMessage("MP3またはM4Aファイルを選択してください");
      setStatus("error");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    if (file && !title) {
      setTitle(file.name.replace(/\.(mp3|m4a)$/i, ""));
    }
    setStatus("idle");
    setErrorMessage("");
  }

  async function handleUpload() {
    if (!selectedFile) {
      setErrorMessage("MP3またはM4Aファイルを選択してください");
      setStatus("error");
      return;
    }
    const contentType = getSupportedAudioContentType(selectedFile);
    if (!contentType) {
      setErrorMessage("MP3またはM4Aファイルを選択してください");
      setStatus("error");
      return;
    }

    let preparation: (UploadPreparation & { error?: string }) | null = null;
    try {
      setErrorMessage("");
      setStatus("preparing");
      const response = await fetch("/api/episodes/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          podcastId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          fileName: selectedFile.name,
          contentType,
          fileSize: selectedFile.size,
        }),
      });

      preparation = (await response.json()) as UploadPreparation & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(preparation.error || "アップロードの準備に失敗しました");
      }

      setStatus("uploading");
      const uploadResponse = await fetch(preparation.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: selectedFile,
      });
      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text().catch(() => "");
        const summary = `${uploadResponse.status} ${uploadResponse.statusText}`.trim();
        throw new Error(
          `GCSへのアップロードに失敗しました (${summary})${detail ? `: ${detail.slice(0, 300)}` : ""
          }`,
        );
      }

      await fetch(`/api/episodes/${preparation.episodeId}/upload-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "uploaded" }),
      });
      setUploadedEpisodeId(preparation.episodeId);
      setStatus("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "アップロードに失敗しました";
      if (preparation) {
        await fetch(`/api/episodes/${preparation.episodeId}/upload-result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed", error: message }),
        }).catch(() => undefined);
      }
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setStatus("idle");
    setErrorMessage("");
    setUploadedEpisodeId(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const isBusy = status === "preparing" || status === "uploading";

  return (
    <div className="border border-brand rounded-xs p-8 max-w-xl">
      <div className="space-y-4 mb-6">
        <label className="block">
          <span className="text-sm font-medium text-black">仮タイトル（任意）</span>
          <input
            type="text"
            maxLength={255}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isBusy}
            className="mt-1 w-full rounded-xs border border-gray-300 px-3 py-2 text-sm text-black"
            placeholder="未入力の場合はファイル名を仮タイトルにします"
          />
          <span className="mt-1 block text-xs text-gray-500">
            AI処理完了後、生成されたエピソードタイトルで上書きされます。
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-black">説明（任意）</span>
          <textarea
            maxLength={10_000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isBusy}
            rows={3}
            className="mt-1 w-full rounded-xs border border-gray-300 px-3 py-2 text-sm text-black"
          />
        </label>
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => !isBusy && inputRef.current?.click()}
      >
        <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="mt-3 text-sm text-gray-600">クリックして音声ファイルを選択</p>
        <p className="mt-1 text-xs text-gray-400">MP3 / M4Aファイルに対応</p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a"
          className="hidden"
          disabled={isBusy}
          onChange={handleFileChange}
        />
      </div>

      {selectedFile && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xs">
          <p className="text-sm text-blue-800">
            <span className="font-medium">アップロード予定ファイル：</span>
            {selectedFile.name}
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xs">
          <p className="text-sm text-green-800 font-medium">アップロードが完了しました</p>
          <p className="text-xs text-green-600 mt-0.5">
            エピソードID: {uploadedEpisodeId}。バックグラウンド処理が開始されます。
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xs">
          <p className="text-sm text-red-800 font-medium">{errorMessage}</p>
        </div>
      )}

      {isBusy && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xs">
          <p className="text-sm text-blue-800 font-medium">
            {status === "preparing" ? "エピソードを作成しています..." : "音声ファイルをアップロードしています..."}
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || status === "success" || isBusy}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isBusy ? "処理中..." : "アップロード開始"}
        </button>
        {(selectedFile || status !== "idle") && (
          <button
            onClick={handleReset}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-xs hover:bg-gray-50 transition-colors"
          >
            リセット
          </button>
        )}
      </div>
    </div>
  );
}

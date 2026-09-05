import { notFound } from "next/navigation";
import Link from "next/link";
import { getEpisodeById } from "@/lib/episodes";
import { StatusBadge } from "@/components/StatusBadge";
import { EpisodeEditor } from "@/components/EpisodeEditor";
import { requireRegisteredUser } from "@/server/auth";
import { requireSelectedPodcast } from "@/server/podcasts/selection";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EpisodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRegisteredUser();
  const podcastId = await requireSelectedPodcast(user);
  const { id } = await params;
  const episode = await getEpisodeById(podcastId, id);

  if (!episode) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← エピソード一覧に戻る
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-start gap-3">
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{episode.title}</h1>
          <StatusBadge status={episode.status} />
        </div>
        <div className="mt-2 text-sm text-gray-500 space-y-0.5">
          <p>{formatDate(episode.createdAt)}</p>
          <p className="text-xs text-gray-400">{episode.audioFileName}</p>
          {episode.audioUrl && (
            <p>
              <a
                href={episode.audioUrl}
                className="text-blue-600 hover:underline"
              >
                公開音声を開く
              </a>
            </p>
          )}
        </div>
      </div>

      {episode.processingError && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {episode.processingError}
        </div>
      )}

      <EpisodeEditor episode={episode} />
    </div>
  );
}

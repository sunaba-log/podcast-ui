import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";
import { requireRegisteredUser } from "@/server/auth";
import { requireSelectedPodcast } from "@/server/podcasts/selection";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await requireRegisteredUser();
  const podcastId = await requireSelectedPodcast(user);

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← エピソード一覧に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">エピソードをアップロード</h1>
        <p className="mt-1 text-sm text-gray-500">
          エピソードを作成して音声ファイルをアップロードすると、バックグラウンド処理が開始されます。
        </p>
      </div>

      <UploadForm podcastId={podcastId} />
    </div>
  );
}

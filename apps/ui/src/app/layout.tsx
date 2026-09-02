import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { HeaderActions } from "@/components/HeaderActions";
import { Sidebar } from "@/components/Sidebar";
import { getSessionUser } from "@/server/auth";
import { getPodcast, listPodcastsForUser } from "@/server/podcasts/data-repository";
import { resolveEffectivePodcastId } from "@/server/podcasts/selection";
import type { PodcastSummary } from "@/types/podcast";
import "./globals.css";

export const metadata: Metadata = {
  title: "SparkCast",
  description: "ポッドキャスト自動化管理ツール",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  let channelTitle: string | null = null;
  let podcasts: PodcastSummary[] = [];
  let selectedPodcastId: number | null = null;
  if (user?.registered) {
    podcasts = await listPodcastsForUser(user.uid);
    // Cookie 未設定時もデフォルトチャンネルを「選択中」として表示する
    const podcastId = await resolveEffectivePodcastId(user);
    if (podcastId) {
      selectedPodcastId = podcastId;
      channelTitle = (await getPodcast(podcastId))?.title ?? null;
    }
  }
  return (
    <html lang="ja" className="h-full" suppressHydrationWarning>
      <body className="bg-app-bg text-gray-900 antialiased h-full flex flex-col font-sans">
        <header className="border-b border-brand/30 shrink-0 z-20">
          <div className="w-full px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center hover:opacity-90 transition-opacity shrink-0">
              <Image
                src="/sparkcast_logo.svg"
                alt="SparkCast"
                width={168}
                height={32}
                priority
                unoptimized
                className="hidden sm:block h-6 w-auto"
              />
              <Image
                src="/sparkcast_logo_small.svg"
                alt="SparkCast"
                width={29}
                height={32}
                priority
                unoptimized
                className="block sm:hidden h-6 w-auto"
              />
            </Link>
            {user && <HeaderActions />}
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden min-h-0">
          {user && (
            <Sidebar
              channelTitle={channelTitle}
              podcasts={podcasts}
              selectedPodcastId={selectedPodcastId}
              userDisplayName={user.displayName}
              userRegistered={user.registered}
              userIsAdmin={user.isAdmin}
            />
          )}
          <main className="flex-1 overflow-y-auto bg-app-bg p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Radio, Share2, Lightbulb, Settings, ChevronsLeft, ChevronsRight, Podcast, ChevronDown, Check } from "lucide-react";
import type { PodcastSummary } from "@/types/podcast";
import { AccountMenu } from "./AccountMenu";

export function Sidebar({
  channelTitle,
  podcasts,
  selectedPodcastId,
  userDisplayName,
  userRegistered,
  userIsAdmin,
}: {
  channelTitle: string | null;
  podcasts: PodcastSummary[];
  selectedPodcastId: number | null;
  userDisplayName: string | null;
  userRegistered: boolean;
  userIsAdmin: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isChannelPage = pathname === "/";
  const hasChannel = channelTitle !== null;

  const navItems = (isChannelPage || !hasChannel)
    ? [
      { href: "/", label: "チャンネル", icon: Podcast },
    ]
    : [
      { href: "/episodes", label: "エピソード", icon: Radio },
      { href: "/sns", label: "SNS投稿", icon: Share2 },
      { href: "/agenda", label: "次回議題", icon: Lightbulb },
      { href: "/settings", label: "番組設定", icon: Settings },
    ];

  async function switchChannel(podcastId: number) {
    if (podcastId === selectedPodcastId) {
      setSwitcherOpen(false);
      return;
    }
    try {
      setSwitching(true);
      const response = await fetch("/api/podcasts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId }),
      });
      if (!response.ok) {
        setSwitching(false);
        return;
      }
      // 全画面を選択中チャンネルの内容へ確実に切り替えるため完全リロードする
      window.location.assign("/episodes");
    } catch {
      setSwitching(false);
    }
  }

  return (
    <aside
      className={`bg-app-bg border-r border-brand/20 transition-all duration-300 flex flex-col shrink-0 ${collapsed ? "w-16" : "w-56"
        }`}
    >
      <div className="h-14 px-4 flex items-center justify-between border-b border-brand/20 relative">
        {!collapsed && !isChannelPage && (
          <button
            type="button"
            onClick={() => setSwitcherOpen((open) => !open)}
            title="チャンネルを切り替え"
            className="flex items-center gap-1 min-w-0 font-bold text-gray-900 text-sm tracking-tight hover:text-brand transition-colors"
          >
            <span className="truncate">{channelTitle ?? "チャンネル未選択"}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-brand" />
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-brand hover:bg-brand-subtle/50 transition-colors ml-auto"
          title={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4 text-brand" />
          ) : (
            <ChevronsLeft className="w-4 h-4 text-brand" />
          )}
        </button>

        {!collapsed && switcherOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setSwitcherOpen(false)}
            />
            <div className="absolute left-3 top-14 z-20 w-52 bg-app-bg border border-brand/30 rounded-xs shadow-lg py-1">
              {podcasts.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  チャンネルがありません
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {podcasts.map((podcast) => {
                    const isSelected = podcast.id === selectedPodcastId;
                    return (
                      <li key={podcast.id}>
                        <button
                          type="button"
                          onClick={() => switchChannel(podcast.id)}
                          disabled={switching}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-brand-subtle/40 disabled:opacity-50 ${isSelected ? "text-brand font-semibold" : "text-gray-700"
                            }`}
                        >
                          <Check
                            className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-brand" : "text-transparent"
                              }`}
                          />
                          <span className="truncate">{podcast.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href="/"
                onClick={() => setSwitcherOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-brand border-t border-brand/20 hover:bg-brand-subtle/40"
              >
                <Podcast className="w-3.5 h-3.5" /> チャンネル管理
              </Link>
            </div>
          </>
        )}
      </div>

      <nav className="p-3 space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/episodes"
                ? pathname === "/episodes" || pathname.startsWith("/episodes")
                : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xs text-sm font-medium transition-all duration-150 ${isActive
                ? "text-brand border border-brand font-bold"
                : "text-gray-700 hover:bg-brand-subtle/40 hover:text-gray-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? "text-brand" : "text-gray-500"
                  }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-brand/20 shrink-0">
        <AccountMenu
          displayName={userDisplayName}
          registered={userRegistered}
          isAdmin={userIsAdmin}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";

export function HeaderActions() {
  const pathname = usePathname();

  // チャネル管理画面 (ルートパス "/") では表示しない
  if (pathname === "/") {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {/* 作業系（高頻度）を左に、アカウント系を右端に分けて配置する */}
      <Link
        href="/upload"
        className="px-4 py-2 text-xs font-normal bg-brand text-white rounded-xs hover:bg-brand-hover transition-colors flex items-center gap-1.5 border border-brand"
      >
        <span>+</span> 新規エピソード追加
      </Link>
      <ChatWidget />
    </div>
  );
}

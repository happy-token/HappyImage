"use client";

import { Info, LogOut, Mail, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SUPPORT_EMAIL } from "@/lib/contact";
import type { StoredAuthSession } from "@/store/auth";

export function AccountMenu({
  session,
  onLogout,
  compactOnMobile = false,
}: {
  session: StoredAuthSession;
  onLogout: () => void | Promise<void>;
  compactOnMobile?: boolean;
}) {
  const roleLabel = session.role === "admin" ? "管理员" : "普通用户";
  const displayName = session.name.trim() || roleLabel;
  const triggerLabel = session.role === "admin" ? "管理员" : "我的";

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-stone-200/80 bg-white/80 px-2.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-white hover:text-stone-950 dark:border-white/10 dark:bg-white/8 dark:text-stone-200 dark:hover:bg-white/12 dark:hover:text-white sm:h-9 sm:px-3 sm:text-sm"
        aria-label="打开账户菜单"
      >
        <UserRound className="size-3.5 sm:size-4" />
        <span className={compactOnMobile ? "hidden md:inline" : undefined}>{triggerLabel}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border-stone-200/80 bg-white/96 p-0 text-stone-950 shadow-[0_28px_80px_-36px_rgba(28,25,23,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/96 dark:text-stone-50"
      >
        <div className="border-b border-stone-100 px-4 py-3 dark:border-white/10">
          <div className="truncate text-sm font-semibold">{displayName}</div>
          <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{roleLabel}账户</div>
        </div>

        <div className="grid gap-1 p-2">
          <div className="flex items-center justify-between rounded-md px-2 py-2 text-sm">
            <span className="text-stone-600 dark:text-stone-300">主题</span>
            <ThemeToggle />
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Mail className="size-4 text-stone-400" />
            支持邮箱
            <span className="ml-auto max-w-36 truncate text-xs text-stone-400">{SUPPORT_EMAIL}</span>
          </a>
          <div className="rounded-md px-2 py-2 text-sm text-stone-600 dark:text-stone-300">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-stone-400" />
              关于 HappyImage
            </div>
            <p className="mt-1 pl-6 text-xs leading-5 text-stone-500 dark:text-stone-400">ChatGPT API 代理服务和图片创作工作台。</p>
          </div>
        </div>

        <div className="border-t border-stone-100 p-2 dark:border-white/10">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

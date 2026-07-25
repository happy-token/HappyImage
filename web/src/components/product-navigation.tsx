"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import {
  buildHappyTokenSsoUrl,
  HAPPYTOKEN_HOME_URL,
} from "@/lib/happytoken";
import { useEffectiveLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { type StoredAuthSession } from "@/store/auth";

type ProductNavigationProps = {
  variant: "public" | "workspace";
  session?: StoredAuthSession | null;
  onLogout?: () => void | Promise<void>;
  onSessionUpdate?: (session: StoredAuthSession) => void;
};

const navigationCopy = {
  "zh-CN": {
    console: "控制台",
    home: "首页",
    imageStudio: "Image 创作",
    login: "登录",
    menu: "打开产品导航",
    recharge: "充值",
    workspace: "进入工作台",
  },
  "en-US": {
    console: "Console",
    home: "Home",
    imageStudio: "Image Studio",
    login: "Sign in",
    menu: "Open product navigation",
    recharge: "Recharge",
    workspace: "Open workspace",
  },
} as const;

export function ProductNavigation({
  variant,
  session,
  onLogout,
  onSessionUpdate,
}: ProductNavigationProps) {
  const language = useEffectiveLanguage();
  const copy = navigationCopy[language];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isWorkspace = variant === "workspace";
  const ssoLanguage = language === "en-US" ? "en" : "zh";
  const consoleUrl = buildHappyTokenSsoUrl("/dashboard", ssoLanguage);
  const rechargeUrl = buildHappyTokenSsoUrl("/wallet", ssoLanguage);

  const productLinks = [
    {
      href: HAPPYTOKEN_HOME_URL,
      icon: Home,
      label: copy.home,
    },
    {
      href: consoleUrl,
      icon: LayoutDashboard,
      label: copy.console,
    },
    {
      href: rechargeUrl,
      icon: CreditCard,
      label: copy.recharge,
    },
  ];

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  const accountEntry = session === undefined ? (
    <span
      className={cn(
        "inline-flex items-center justify-center text-stone-400",
        isWorkspace ? "size-8" : "h-9 min-w-24"
      )}
      aria-label={language === "zh-CN" ? "正在检查登录状态" : "Checking sign-in status"}
    >
      <LoaderCircle className="size-4 animate-spin" />
    </span>
  ) : session && isWorkspace && onLogout ? (
    <AccountMenu
      session={session}
      onLogout={onLogout}
      onSessionUpdate={onSessionUpdate}
      iconOnly
    />
  ) : (
    <Button
      asChild
      size="sm"
      className={cn(
        "rounded-full bg-stone-950 text-white shadow-sm hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white",
        !isWorkspace && "h-9 px-4"
      )}
    >
      <Link href={session ? "/image" : "/login?next=%2Fimage"}>
        {session ? <Sparkles className="size-4" /> : <LogIn className="size-4" />}
        <span className={cn(isWorkspace && "hidden lg:inline")}>
          {session ? copy.workspace : copy.login}
        </span>
      </Link>
    </Button>
  );

  return (
    <header
      className={cn(
        "relative z-50 w-full shrink-0",
        isWorkspace
          ? "border-b border-zinc-200/80 bg-zinc-50/92 dark:border-zinc-800 dark:bg-[#171717]/95"
          : "sticky top-0 py-2 backdrop-blur-xl"
      )}
    >
      <nav
        aria-label={language === "zh-CN" ? "HappyToken 产品导航" : "HappyToken product navigation"}
        className={cn(
          "relative mx-auto flex items-center justify-between",
          isWorkspace
            ? "h-11 max-w-none px-3 sm:px-4"
            : "min-h-14 max-w-[1380px] rounded-2xl border border-white/70 bg-white/78 px-3 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-stone-950/72 sm:px-4"
        )}
      >
        <Link
          href="/"
          className={cn(
            "group flex shrink-0 items-center text-stone-950 transition hover:text-stone-600 dark:text-stone-50 dark:hover:text-white",
            isWorkspace ? "gap-2" : "gap-2.5"
          )}
          aria-label={copy.imageStudio}
        >
          <Image
            src="/happy-token-logo.svg"
            alt=""
            width={isWorkspace ? 25 : 30}
            height={isWorkspace ? 25 : 30}
            priority
            className={cn(
              "rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)] transition-transform group-hover:-rotate-3",
              isWorkspace ? "size-[25px]" : "size-[30px]"
            )}
          />
          <span className={cn("font-bold tracking-tight", isWorkspace ? "text-sm" : "text-base")}>
            Happy Token
          </span>
          <span
            className={cn(
              "rounded-full border border-amber-200/80 bg-amber-50 font-medium text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-200",
              isWorkspace ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
            )}
          >
            Image
          </span>
        </Link>

        <div
          className={cn(
            "hidden items-center md:flex",
            isWorkspace
              ? "absolute left-1/2 -translate-x-1/2 gap-1"
              : "gap-1 rounded-full border border-stone-200/70 bg-stone-50/80 p-1 dark:border-white/10 dark:bg-white/5"
          )}
        >
          {productLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white",
                  isWorkspace ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
                )}
              >
                {isWorkspace ? <Icon className="size-3.5" /> : null}
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className={cn(isWorkspace && "hidden sm:block")}>
            <HeaderActions />
          </div>
          <div className="hidden md:block">{accountEntry}</div>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-stone-200/80 bg-white/80 text-stone-700 shadow-sm transition hover:bg-white hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-200 dark:hover:bg-white/12 dark:hover:text-white md:hidden",
              isWorkspace ? "size-8" : "size-9"
            )}
            aria-expanded={isMenuOpen}
            aria-controls={`product-navigation-${variant}`}
            aria-label={isMenuOpen ? (language === "zh-CN" ? "关闭产品导航" : "Close product navigation") : copy.menu}
          >
            {isMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        <div
          id={`product-navigation-${variant}`}
          className={cn(
            "absolute right-0 left-0 top-[calc(100%+0.5rem)] origin-top rounded-2xl border border-stone-200/80 bg-white/96 p-2 shadow-[0_24px_70px_-32px_rgba(28,25,23,0.5)] backdrop-blur-2xl transition dark:border-white/10 dark:bg-stone-950/96 md:hidden",
            isMenuOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
          )}
          aria-hidden={!isMenuOpen}
          inert={!isMenuOpen}
        >
          <div className="grid gap-1">
            {productLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-200 dark:hover:bg-white/8 dark:hover:text-white"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-white/8 dark:text-stone-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight className="size-4 text-stone-400" />
                </a>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-100 px-2 pt-2 dark:border-white/10">
            <HeaderActions />
            {accountEntry}
          </div>
        </div>
      </nav>
    </header>
  );
}

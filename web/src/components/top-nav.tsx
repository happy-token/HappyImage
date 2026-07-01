"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";

import { getValidatedAuthSession, logoutCurrentSession } from "@/lib/auth-session";
import { useEffectiveLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { type StoredAuthSession } from "@/store/auth";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login" || pathname === "/admin-login";
}

const topNavCopy = {
  "zh-CN": {
    docs: "使用文档",
    workspace: "返回工作台",
  },
  "en-US": {
    docs: "Docs",
    workspace: "Workspace",
  },
};

export function TopNav({
  session: providedSession,
  hideAccountMenu = false,
  onSessionUpdate,
}: {
  session?: StoredAuthSession | null;
  hideAccountMenu?: boolean;
  onSessionUpdate?: (session: StoredAuthSession) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const language = useEffectiveLanguage();
  const copy = topNavCopy[language];
  const [session, setSession] = useState<StoredAuthSession | null | undefined>(undefined);

  useEffect(() => {
    if (providedSession !== undefined) {
      return;
    }

    let active = true;

    const load = async () => {
      if (isPublicPath(pathname)) {
        if (!active) {
          return;
        }
        setSession(null);
        return;
      }

      const storedSession = await getValidatedAuthSession();
      if (!active) {
        return;
      }
      setSession(storedSession);
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname, providedSession]);

  const handleLogout = async () => {
    const redirectedToProvider = await logoutCurrentSession();
    if (redirectedToProvider) {
      return;
    }
    router.replace("/");
  };

  const currentSession = providedSession !== undefined ? providedSession : session;
  const handleSessionUpdate = (nextSession: StoredAuthSession) => {
    if (providedSession === undefined) {
      setSession(nextSession);
    }
    onSessionUpdate?.(nextSession);
  };

  if (isPublicPath(pathname) || currentSession === undefined || !currentSession) {
    return null;
  }

  const isImageWorkspace = pathname === "/image" || pathname.startsWith("/image/");
  const showDocsLink = !isImageWorkspace && pathname !== "/docs";

  return (
    <header className="border-b border-stone-100/50 dark:border-white/10">
      <div
        className={cn(
          "flex items-center justify-between px-3 sm:px-6",
          isImageWorkspace ? "h-9" : "h-12",
        )}
      >
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <Link
            href="/image"
            className="flex shrink-0 items-center gap-2 py-1 text-[15px] font-bold tracking-tight text-stone-950 transition hover:text-stone-700 dark:text-stone-50 dark:hover:text-white"
          >
            <Image
              src="/happy-token-logo.svg"
              alt="Happy Token"
              width={isImageWorkspace ? 24 : 28}
              height={isImageWorkspace ? 24 : 28}
              priority
              className={cn(
                "rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)]",
                isImageWorkspace ? "size-6" : "size-7",
              )}
            />
            <span>Happy Token</span>
          </Link>
          {!isImageWorkspace ? (
            <Link
              href="/image"
              title={copy.workspace}
              aria-label={copy.workspace}
              className="inline-flex size-8 items-center justify-center gap-1.5 rounded-full border border-stone-200/80 bg-white/70 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 dark:border-white/10 dark:bg-white/8 dark:text-stone-300 dark:hover:bg-white/12 dark:hover:text-white sm:w-auto sm:px-3"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{copy.workspace}</span>
            </Link>
          ) : null}
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-1 sm:flex">
          {showDocsLink ? (
            <Link
              href="/docs"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition",
                "text-stone-600 hover:bg-white/70 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
              )}
            >
              <BookOpen className="size-4" />
              {copy.docs}
            </Link>
          ) : null}
        </div>
        {isImageWorkspace || hideAccountMenu ? null : (
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <AccountMenu session={currentSession} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} iconOnly />
          </div>
        )}
      </div>
    </header>
  );
}

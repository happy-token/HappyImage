"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AccountMenu } from "@/components/account-menu";

import { getValidatedAuthSession, logoutCurrentSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { type StoredAuthSession } from "@/store/auth";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login" || pathname === "/admin-login";
}

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
    router.replace("/login");
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
        </div>
        <div className="hidden min-w-0 flex-1 sm:block" />
        {isImageWorkspace || hideAccountMenu ? null : (
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <AccountMenu session={currentSession} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} />
          </div>
        )}
      </div>
    </header>
  );
}

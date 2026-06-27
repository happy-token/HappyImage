"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";
import { getAdminNavigationItems } from "@/components/admin-navigation";
import { ImageWorkspaceNav } from "@/components/image-workspace-nav";
import { TopNav } from "@/components/top-nav";
import { getValidatedAuthSession, logoutCurrentSession } from "@/lib/auth-session";
import { useEffectiveLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { type StoredAuthSession } from "@/store/auth";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login" || pathname === "/admin-login";
}

function isImageWorkspacePath(pathname: string) {
  return pathname === "/image" || pathname.startsWith("/image/");
}

function AdminSidebar({ accountFooter }: { accountFooter?: ReactNode }) {
  const pathname = usePathname();
  const language = useEffectiveLanguage();
  const adminNavigationItems = getAdminNavigationItems(language);

  return (
    <aside className="h-full min-h-0 overflow-hidden border-r border-zinc-200/70 pr-2 dark:border-white/10 sm:pr-3">
      <div className="flex h-full min-h-0 flex-col gap-2 py-1 sm:gap-3 sm:py-2">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 sm:space-y-3">
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <Image
              src="/happy-token-logo.svg"
              alt="Happy Token"
              width={28}
              height={28}
              priority
              className="size-7 rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)]"
            />
            <span className="hidden min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:block">
              Happy Token
            </span>
          </div>
          <ImageWorkspaceNav asLinks collapseLabels />

          <nav className="grid gap-1">
            {adminNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition md:justify-between",
                    active
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-700 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <span className="hidden md:inline">{item.label}</span>
                  <Icon className="size-4 shrink-0" />
                </Link>
              );
            })}
          </nav>
        </div>

        {accountFooter ? (
          <div className="shrink-0 border-t border-zinc-200/70 px-1 pt-2 dark:border-white/10">
            {accountFooter}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (isPublicPath(pathname)) {
        if (active) {
          setSession(null);
        }
        return;
      }

      const storedSession = await getValidatedAuthSession();
      if (active) {
        setSession(storedSession);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  const showAdminSidebar = session?.role === "admin" && !isImageWorkspacePath(pathname);

  const handleLogout = async () => {
    const redirectedToProvider = await logoutCurrentSession();
    if (redirectedToProvider) {
      return;
    }
    setSession(null);
    router.replace("/login");
  };

  const adminAccountFooter = session ? (
    <div className="flex items-center justify-center md:justify-start">
      <AccountMenu session={session} onLogout={handleLogout} onSessionUpdate={setSession} compactOnMobile />
    </div>
  ) : null;

  return (
    <>
      {isImageWorkspacePath(pathname) || showAdminSidebar ? null : <TopNav session={session} onSessionUpdate={setSession} hideAccountMenu={showAdminSidebar} />}
      {showAdminSidebar ? (
        <div className="happytoken-workspace relative left-1/2 grid h-screen min-h-0 w-screen -translate-x-1/2 grid-cols-[3.75rem_minmax(0,1fr)] gap-0 overflow-hidden bg-zinc-50 px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] dark:bg-[#171717] sm:-mt-2 sm:grid-cols-[200px_minmax(0,1fr)] sm:pb-0 xl:grid-cols-[240px_minmax(0,1fr)]">
          <AdminSidebar accountFooter={adminAccountFooter} />
          <div className="min-w-0 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">{children}</div>
        </div>
      ) : (
        children
      )}
    </>
  );
}

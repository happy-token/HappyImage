"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { adminNavigationItems } from "@/components/admin-navigation";
import { TopNav } from "@/components/top-nav";
import { getValidatedAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { clearStoredAuthSession, type StoredAuthSession } from "@/store/auth";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login";
}

function isImageWorkspacePath(pathname: string) {
  return pathname === "/image" || pathname.startsWith("/image/");
}

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-[env(safe-area-inset-top)] h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] min-h-0 shrink-0 overflow-hidden border-r border-stone-200/70 pr-2 dark:border-white/10 md:pr-3">
      <div className="flex h-full min-h-0 w-14 flex-col gap-3 py-2 md:w-52">
        <Link href="/image" className="flex h-10 items-center justify-center rounded-lg text-stone-950 transition hover:bg-white/60 hover:text-stone-700 dark:text-stone-50 dark:hover:bg-white/10 dark:hover:text-white md:justify-start md:gap-2 md:px-2">
          <Image
            src="/happyimage-logo.svg"
            alt="HappyImage"
            width={24}
            height={24}
            priority
            className="size-6 rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)]"
          />
          <span className="hidden text-sm font-bold tracking-tight md:inline">HappyImage</span>
        </Link>

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
                    ? "bg-stone-950 text-white dark:bg-white dark:text-stone-950"
                    : "text-stone-700 hover:bg-white/70 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <span className="hidden md:inline">{item.label}</span>
                <Icon className="size-4 shrink-0" />
              </Link>
            );
          })}
        </nav>
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
    try {
      const { logoutSession } = await import("@/lib/api");
      await logoutSession();
    } catch {
      // Clear cookie even if server call fails
    }
    await clearStoredAuthSession();
    router.replace("/login");
  };

  return (
    <>
      {!showAdminSidebar ? <TopNav session={session} /> : null}
      {showAdminSidebar ? (
        <div className="grid min-h-0 flex-1 grid-cols-[3.75rem_minmax(0,1fr)] gap-2 sm:gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <AdminSidebar />
          <div className="flex min-w-0 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-end border-b border-stone-100/50 px-3 dark:border-white/10 sm:px-6">
              <AccountMenu session={session} onLogout={handleLogout} />
            </header>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}

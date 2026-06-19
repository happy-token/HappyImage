"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { adminNavigationItems } from "@/components/admin-navigation";
import { ImageWorkspaceNav } from "@/components/image-workspace-nav";
import { TopNav } from "@/components/top-nav";
import { getValidatedAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { type StoredAuthSession } from "@/store/auth";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login";
}

function isImageWorkspacePath(pathname: string) {
  return pathname === "/image" || pathname.startsWith("/image/");
}

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-full min-h-0 overflow-hidden border-r border-stone-200/70 pr-2 dark:border-white/10 sm:pr-3">
      <div className="flex h-full min-h-0 flex-col gap-2 py-1 sm:gap-3 sm:py-2">
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

  return (
    <>
      <TopNav session={session} />
      {showAdminSidebar ? (
        <div className="mx-auto grid h-[calc(100dvh-3rem)] min-h-0 w-full max-w-[1380px] grid-cols-[3.75rem_minmax(0,1fr)] gap-2 overflow-hidden px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-3 sm:px-3 sm:pb-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <AdminSidebar />
          <div className="min-w-0 overflow-y-auto">{children}</div>
        </div>
      ) : (
        children
      )}
    </>
  );
}

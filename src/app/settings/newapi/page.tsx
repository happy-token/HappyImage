"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getValidatedAuthSession } from "@/lib/auth-session";

const DEFAULT_NEWAPI_URL = "https://gateway.happy-token.cn";
const ALLOWED_NEWAPI_MANAGEMENT_ORIGINS = new Set(["https://gateway.happy-token.cn"]);

function normalizeManagementUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return DEFAULT_NEWAPI_URL;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !ALLOWED_NEWAPI_MANAGEMENT_ORIGINS.has(parsed.origin)) {
      return DEFAULT_NEWAPI_URL;
    }
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_NEWAPI_URL;
  }
}

export default function NewAPISettingsPage() {
  const [managementUrl, setManagementUrl] = useState(DEFAULT_NEWAPI_URL);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getValidatedAuthSession()
      .then((session) => {
        if (cancelled) return;
        setManagementUrl(normalizeManagementUrl(session?.newapiManagementUrl));
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] place-items-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <main className="h-[calc(100vh-1rem)] min-h-[640px] w-full overflow-hidden bg-stone-50 dark:bg-[#171717]">
      <div className="flex h-12 items-center justify-between border-b border-stone-200 bg-white px-4 dark:border-white/10 dark:bg-[#1f1f1f]">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-stone-950 dark:text-stone-50">NewAPI 管理</h1>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <a href={managementUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            新窗口打开
          </a>
        </Button>
      </div>
      <iframe
        title="NewAPI 管理"
        src={managementUrl}
        className="h-[calc(100%-3rem)] w-full border-0 bg-white"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-forms allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
      />
    </main>
  );
}

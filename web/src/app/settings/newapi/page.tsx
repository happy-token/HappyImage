"use client";

import {
  Copy,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  fetchNewAPIManagement,
  type NewAPIManagementResponse,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { cn } from "@/lib/utils";

function formatDateTime(value: number) {
  if (!value || value < 0) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

function statusLabel(status: string) {
  if (status === "configured") return "已绑定";
  if (status === "failed") return "绑定失败";
  return "等待绑定";
}

export default function NewAPISettingsPage() {
  const { isCheckingAuth, session } = useAuthGuard(["user"]);
  const [data, setData] = useState<NewAPIManagementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultToken = useMemo(
    () =>
      data?.tokens.find((token) => token.name === "HappyImage Default") ??
      data?.tokens[0],
    [data?.tokens]
  );

  const loadManagement = async () => {
    setIsLoading(true);
    setError("");
    try {
      const nextData = await fetchNewAPIManagement();
      setData(nextData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "加载 HappyToken 管理信息失败"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.subjectId) return;
    void loadManagement();
  }, [session?.subjectId]);

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  if (isCheckingAuth || !session) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] place-items-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-5 text-stone-950 dark:bg-[#171717] dark:text-stone-50 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ServerCog className="size-4 text-stone-400" />
              HappyToken 管理
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              API Key 和绑定状态由 HappyImage 代管，额度与用量仍由
              HappyToken/NewAPI 负责。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadManagement()}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              刷新
            </Button>
            {data?.management_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={data.management_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  网关后台
                </a>
              </Button>
            ) : null}
          </div>
        </header>

        {isLoading ? (
          <div className="grid min-h-64 place-items-center rounded-lg border border-stone-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  绑定状态
                </div>
                <div
                  className={cn(
                    "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                    data.status === "configured"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                  )}
                >
                  {statusLabel(data.status)}
                </div>
                {data.message ? (
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {data.message}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  NewAPI 用户
                </div>
                <div className="mt-2 font-mono text-sm">
                  {data.newapi_user_id || "-"}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  默认 API Key
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-stone-100 px-2 py-1 text-xs dark:bg-white/10">
                    {defaultToken?.key || "-"}
                  </code>
                  {defaultToken?.key ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        void copyValue(defaultToken.key, "API Key")
                      }
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
                API Keys
              </div>
              <div className="divide-y divide-stone-100 dark:divide-white/10">
                {data.tokens.length > 0 ? (
                  data.tokens.map((token) => (
                    <div
                      key={token.id}
                      className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {token.name || `Token ${token.id}`}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-white/10 dark:text-stone-300">
                            {token.status === 1 ? "启用" : "停用"}
                          </span>
                          {token.unlimited_quota ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-white/10 dark:text-stone-300">
                              不限额度
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex min-w-0 items-center gap-2">
                          <code className="min-w-0 truncate rounded bg-stone-100 px-2 py-1 text-xs dark:bg-white/10">
                            {token.key}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue(token.key, token.name || "API Key")
                            }
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-stone-400">
                          创建 {formatDateTime(token.created_time)} · 最近使用{" "}
                          {formatDateTime(token.accessed_time)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                    暂无 API Key
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, Mail, MessageCircle, TicketPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchRechargeSession, type RechargeSession } from "@/lib/api";
import { SUPPORT_EMAIL, SUPPORT_WECHAT, SUPPORT_WECHAT_QR } from "@/lib/contact";

function formatQuota(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "无限制";
  }
  return `${value} 张`;
}

export default function RechargePage() {
  const [session, setSession] = useState<RechargeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchRechargeSession()
      .then((data) => {
        if (!cancelled) {
          setSession(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "暂时无法加载充值配置");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rechargeUrl = session?.mode === "redirect" ? session.recharge_url : "";

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-4xl flex-col justify-center gap-6 py-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm dark:bg-white/8 dark:text-stone-300">
          <TicketPlus className="size-3.5" />
          图片额度充值
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">充值图片生成额度</h1>
        <p className="max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">
          额度用完或需要继续生成图片时，可以在这里进入充值中心。支付完成后，额度会同步回 HappyImage 账户。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-white/80 bg-white/88 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">当前额度</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
                {isLoading ? <LoaderCircle className="size-5 animate-spin text-stone-400" /> : formatQuota(session?.quota)}
              </div>
              {error ? <p className="mt-2 text-xs leading-5 text-rose-600 dark:text-rose-300">{error}</p> : null}
            </div>

            {rechargeUrl ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">New API 充值中心</div>
                <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
                  将跳转到 New API 完成支付。建议 New API 与 HappyImage 使用同一套 Casdoor 登录，支付回调按用户 ID、OIDC subject 或邮箱同步额度。
                </p>
                <Button asChild className="mt-4 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200">
                  <a href={rechargeUrl} target="_blank" rel="noreferrer">
                    前往充值
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <MessageCircle className="mt-0.5 size-5 text-stone-500 dark:text-stone-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">微信</div>
                    <div className="mt-1 text-sm text-stone-600 dark:text-stone-300">{SUPPORT_WECHAT}</div>
                  </div>
                </div>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 transition hover:bg-stone-100 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                >
                  <Mail className="mt-0.5 size-5 text-stone-500 dark:text-stone-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">邮箱</div>
                    <div className="mt-1 break-all text-sm text-stone-600 dark:text-stone-300">{SUPPORT_EMAIL}</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl border-stone-200 bg-white px-4 text-stone-700 hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200">
              <Link href="/image">
                <ArrowLeft className="size-4" />
                返回创作
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/88 p-4 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">微信二维码</div>
          <img
            src={SUPPORT_WECHAT_QR}
            alt="微信二维码"
            className="mt-3 w-full rounded-2xl border border-stone-200 bg-white object-contain dark:border-white/10"
          />
          <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">在线充值未启用时，可以扫码添加微信并备注 HappyImage 充值。</p>
        </div>
      </div>
    </section>
  );
}

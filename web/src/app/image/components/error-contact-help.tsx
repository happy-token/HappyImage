"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import {
  SUPPORT_WECHAT,
  SUPPORT_WECHAT_QR_CODE,
  buildSupportMessage,
  type SupportContext,
} from "@/lib/contact";

type CopyTarget = "wechat" | "message";

/**
 * 图片生成失败时直接展示的客服微信，省掉"联系支持"这一步跳转。
 */
export function ErrorContactHelp({ error, taskId }: SupportContext) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const message = buildSupportMessage({ error, taskId });

  const copy = async (value: string, target: CopyTarget, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      toast.success(`已复制${label}`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const copyIcon = (target: CopyTarget) =>
    copied === target ? (
      <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <Copy className="size-3" />
    );

  return (
    <div className="mt-1 flex items-center gap-3 border-t border-rose-200/80 pt-2 sm:mt-2 sm:gap-4 sm:pt-4">
      <img
        src={SUPPORT_WECHAT_QR_CODE}
        alt="微信客服二维码"
        className="w-24 shrink-0 rounded-lg bg-white sm:w-28"
      />
      <div className="flex flex-col items-start gap-1.5 text-left">
        <p className="font-medium sm:whitespace-nowrap">扫码加客服微信</p>
        <button
          type="button"
          onClick={() => void copy(SUPPORT_WECHAT, "wechat", "微信号")}
          className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] text-rose-600 transition hover:bg-white sm:text-xs"
          title="复制微信号"
        >
          微信号 {SUPPORT_WECHAT}
          {copyIcon("wechat")}
        </button>
        <button
          type="button"
          onClick={() => void copy(message, "message", "问题描述")}
          className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] text-rose-600 transition hover:bg-white sm:text-xs"
          title="复制错误信息和任务 ID"
        >
          复制问题描述
          {copyIcon("message")}
        </button>
      </div>
    </div>
  );
}

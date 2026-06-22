"use client";

import { LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useSettingsStore } from "../store";

export function ConfigCard() {
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setImageRetentionDays = useSettingsStore((state) => state.setImageRetentionDays);
  const setImagePollTimeoutSecs = useSettingsStore((state) => state.setImagePollTimeoutSecs);
  const setImageSettleEnabled = useSettingsStore((state) => state.setImageSettleEnabled);
  const setImageSettleSecs = useSettingsStore((state) => state.setImageSettleSecs);
  const setGlobalSystemPrompt = useSettingsStore((state) => state.setGlobalSystemPrompt);
  const setSensitiveWordsText = useSettingsStore((state) => state.setSensitiveWordsText);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  if (isLoadingConfig) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="flex items-center justify-center p-10">
          <LoaderCircle className="size-5 animate-spin text-stone-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">图片任务</h2>
            <p className="mt-1 text-sm text-stone-500">保留日常运行中会用到的超时和清理设置。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">图片保留天数</label>
              <Input value={String(config?.image_retention_days || "")} onChange={(event) => setImageRetentionDays(event.target.value)} placeholder="30" className="h-10 rounded-xl border-stone-200 bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">轮询超时秒数</label>
              <Input value={String(config?.image_poll_timeout_secs || "")} onChange={(event) => setImagePollTimeoutSecs(event.target.value)} placeholder="120" className="h-10 rounded-xl border-stone-200 bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">二次确认等待秒数</label>
              <Input value={String(config?.image_settle_secs || "2.0")} onChange={(event) => setImageSettleSecs(event.target.value)} placeholder="2.0" className="h-10 rounded-xl border-stone-200 bg-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!config?.image_settle_enabled} />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
              <Checkbox checked={Boolean(config?.image_settle_enabled !== false)} onCheckedChange={(checked) => setImageSettleEnabled(Boolean(checked))} />
              图片二次确认机制
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">安全约束</h2>
            <p className="mt-1 text-sm text-stone-500">用于统一限制提示词和拒绝命中敏感词的请求。</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">全局附加指令</label>
              <Textarea
                value={String(config?.global_system_prompt || "")}
                onChange={(event) => setGlobalSystemPrompt(event.target.value)}
                placeholder="例如：遇到违法、色情、暴力、仇恨等请求时拒绝。"
                className="min-h-28 rounded-xl border-stone-200 bg-white font-mono text-xs shadow-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">敏感词</label>
              <Textarea
                value={(config?.sensitive_words || []).join("\n")}
                onChange={(event) => setSensitiveWordsText(event.target.value)}
                placeholder="一行一个，命中即拒绝"
                className="min-h-28 rounded-xl border-stone-200 bg-white font-mono text-xs shadow-none"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t border-stone-100 pt-5">
          <Button
            className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
            onClick={() => void saveConfig()}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

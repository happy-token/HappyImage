"use client";

import { CreditCard, KeyRound, LoaderCircle, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function RechargeSettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setRechargeField = useSettingsStore((state) => state.setRechargeField);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  const recharge = config?.recharge;
  const enabled = Boolean(recharge?.enabled);
  const provider = String(recharge?.provider || "contact");
  const webhookSecretConfigured = Boolean(recharge?.webhook_secret_configured);
  const callbackUrl = `${config?.api_base_url || "https://api.example.com"}/api/recharge/newapi/webhook`;

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
              <CreditCard className="size-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">充值与 New API</h2>
              <p className="text-sm text-stone-500">
                将 HappyImage 的充值入口跳转到 New API，并通过回调同步用户图片额度。
              </p>
            </div>
          </div>
          <Badge
            variant={enabled && provider === "newapi" && recharge?.newapi_base_url ? "success" : "secondary"}
            className="w-fit rounded-md px-2.5 py-1"
          >
            {enabled && provider === "newapi" && recharge?.newapi_base_url ? "已启用" : "未启用"}
          </Badge>
        </div>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-10">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-lg border border-stone-200 p-4">
              <Checkbox
                id="recharge-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setRechargeField("enabled", Boolean(checked))}
              />
              <div>
                <label htmlFor="recharge-enabled" className="cursor-pointer text-sm font-medium text-stone-700">
                  启用在线充值
                </label>
                <p className="text-sm text-stone-500">
                  启用后，用户充值页会优先显示 New API 充值入口。
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">充值服务</label>
                <select
                  value={provider}
                  onChange={(event) => setRechargeField("provider", event.target.value)}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400"
                >
                  <option value="contact">人工联系</option>
                  <option value="newapi">New API</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">额度换算</label>
                <Input
                  type="number"
                  min={1}
                  value={String(recharge?.quota_per_unit ?? 1)}
                  onChange={(event) => setRechargeField("quota_per_unit", Math.max(1, parseInt(event.target.value || "1", 10) || 1))}
                  className="h-11 rounded-xl border-stone-200 bg-white"
                />
                <p className="text-sm text-stone-500">New API 回调只传 amount 时，每 1 单位金额兑换的图片张数。</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">New API 地址</label>
              <Input
                value={String(recharge?.newapi_base_url || "")}
                onChange={(event) => setRechargeField("newapi_base_url", event.target.value)}
                placeholder="https://new-api.example.com"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">充值页路径</label>
              <Input
                value={String(recharge?.newapi_console_topup_path || "/console/topup")}
                onChange={(event) => setRechargeField("newapi_console_topup_path", event.target.value)}
                placeholder="/console/topup"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                回调密钥
                {webhookSecretConfigured ? (
                  <span className="ml-2 text-xs text-emerald-600">（已配置）</span>
                ) : (
                  <span className="ml-2 text-xs text-amber-600">（未配置）</span>
                )}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute inset-y-0 left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input
                  type="password"
                  value={String(recharge?.webhook_secret || "")}
                  onChange={(event) => setRechargeField("webhook_secret", event.target.value)}
                  placeholder={webhookSecretConfigured ? "留空保持不变" : "输入回调密钥"}
                  className="h-11 rounded-xl border-stone-200 bg-white pl-10"
                />
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm font-medium text-stone-600">New API 支付成功回调地址</p>
              <code className="mt-1 block break-all text-sm text-stone-500">{callbackUrl}</code>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                回调请求需要带 Header：X-HappyImage-Recharge-Secret，并传入用户 ID、OIDC subject 或邮箱中的任意一种。
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                onClick={() => void saveConfig()}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存配置
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

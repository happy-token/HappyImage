"use client";

import { KeyRound, LoaderCircle, Save, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function OIDCSettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setOIDCField = useSettingsStore((state) => state.setOIDCField);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  const oidc = config?.oidc;
  const enabled = Boolean(oidc?.enabled);
  const clientSecretConfigured = Boolean(oidc?.client_secret_configured);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
              <ShieldCheck className="size-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">OIDC 单点登录</h2>
              <p className="text-sm text-stone-500">
                配置 OpenID Connect 提供方，允许用户通过第三方身份提供方登录 HappyImage。
              </p>
            </div>
          </div>
          <Badge
            variant={enabled && oidc?.issuer ? "success" : "secondary"}
            className="w-fit rounded-md px-2.5 py-1"
          >
            {enabled && oidc?.issuer ? "已启用" : "未启用"}
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
                id="oidc-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setOIDCField("enabled", Boolean(checked))}
              />
              <div>
                <label htmlFor="oidc-enabled" className="text-sm font-medium text-stone-700 cursor-pointer">
                  启用 OIDC 登录
                </label>
                <p className="text-sm text-stone-500">
                  启用后，登录页面将显示 OIDC 单点登录选项
                </p>
              </div>
            </div>

            {enabled ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Issuer URL</label>
                  <Input
                    value={String(oidc?.issuer || "")}
                    onChange={(event) => setOIDCField("issuer", event.target.value)}
                    placeholder="https://accounts.google.com"
                    className="h-11 rounded-xl border-stone-200 bg-white"
                  />
                  <p className="text-sm text-stone-500">
                    OIDC 提供方的 issuer 地址，系统会自动获取 .well-known/openid-configuration
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Client ID</label>
                    <Input
                      value={String(oidc?.client_id || "")}
                      onChange={(event) => setOIDCField("client_id", event.target.value)}
                      placeholder="your-client-id"
                      className="h-11 rounded-xl border-stone-200 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">
                      Client Secret
                      {clientSecretConfigured ? (
                        <span className="ml-2 text-xs text-emerald-600">（已配置）</span>
                      ) : (
                        <span className="ml-2 text-xs text-amber-600">（未配置）</span>
                      )}
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute inset-y-0 left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                      <Input
                        type="password"
                        value={String(oidc?.client_secret || "")}
                        onChange={(event) => setOIDCField("client_secret", event.target.value)}
                        placeholder={clientSecretConfigured ? "留空保持不变" : "输入 client secret"}
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10"
                      />
                    </div>
                    <p className="text-sm text-stone-500">
                      留空则保持现有密钥不变；填写新值将替换旧密钥
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Scopes</label>
                  <Input
                    value={String(oidc?.scopes || "openid profile email")}
                    onChange={(event) => setOIDCField("scopes", event.target.value)}
                    placeholder="openid profile email"
                    className="h-11 rounded-xl border-stone-200 bg-white"
                  />
                  <p className="text-sm text-stone-500">
                    以空格分隔的 scope 列表，默认 openid profile email
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">允许的邮箱域名</label>
                  <Input
                    value={String(oidc?.allowed_email_domains || "")}
                    onChange={(event) => setOIDCField("allowed_email_domains", event.target.value)}
                    placeholder="example.com,company.org"
                    className="h-11 rounded-xl border-stone-200 bg-white"
                  />
                  <p className="text-sm text-stone-500">
                    以逗号分隔的域名列表，留空则不限制邮箱域名
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">默认图片额度</label>
                  <Input
                    type="number"
                    value={String(oidc?.default_image_quota ?? 0)}
                    onChange={(event) => setOIDCField("default_image_quota", Math.max(0, parseInt(event.target.value || "0", 10) || 0))}
                    className="h-11 w-32 rounded-xl border-stone-200 bg-white"
                    min={0}
                  />
                  <p className="text-sm text-stone-500">
                    OIDC 新用户自动获得的图片生成额度，默认为 0
                  </p>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-sm font-medium text-stone-600">回调地址</p>
                  <code className="mt-1 block break-all text-sm text-stone-500">
                    {config?.api_base_url || "https://api.example.com"}/api/auth/oidc/callback
                  </code>
                </div>
              </div>
            ) : null}

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

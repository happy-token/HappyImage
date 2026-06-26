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
  const setImageRetentionDays = useSettingsStore(
    (state) => state.setImageRetentionDays
  );
  const setImagePollTimeoutSecs = useSettingsStore(
    (state) => state.setImagePollTimeoutSecs
  );
  const setImageSettleEnabled = useSettingsStore(
    (state) => state.setImageSettleEnabled
  );
  const setImageSettleSecs = useSettingsStore(
    (state) => state.setImageSettleSecs
  );
  const setGlobalSystemPrompt = useSettingsStore(
    (state) => state.setGlobalSystemPrompt
  );
  const setSensitiveWordsText = useSettingsStore(
    (state) => state.setSensitiveWordsText
  );
  const setConfigField = useSettingsStore((state) => state.setConfigField);
  const setOIDCField = useSettingsStore((state) => state.setOIDCField);
  const setModelGatewayField = useSettingsStore(
    (state) => state.setModelGatewayField
  );
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
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              站点地址
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              普通同源部署只需要填写公开应用地址。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                公开应用地址
              </label>
              <Input
                value={String(config?.public_app_url || "")}
                onChange={(event) =>
                  setConfigField("public_app_url", event.target.value)
                }
                placeholder="https://image.example.com"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                API 公开地址
              </label>
              <Input
                value={String(config?.api_public_url || "")}
                onChange={(event) =>
                  setConfigField("api_public_url", event.target.value)
                }
                placeholder="API 独立域名，可留空"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              登录授权
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              配置 OAuth/OIDC 登录；管理员密钥仍可用于恢复进入设置。
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
            <Checkbox
              checked={Boolean(config?.oidc?.enabled)}
              onCheckedChange={(checked) =>
                setOIDCField("enabled", Boolean(checked))
              }
            />
            启用 OIDC/OAuth 登录
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Issuer
              </label>
              <Input
                value={String(config?.oidc?.issuer || "")}
                onChange={(event) => setOIDCField("issuer", event.target.value)}
                placeholder="https://issuer.example.com"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Client ID
              </label>
              <Input
                value={String(config?.oidc?.client_id || "")}
                onChange={(event) =>
                  setOIDCField("client_id", event.target.value)
                }
                placeholder="Client ID"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Client Secret
              </label>
              <Input
                value={String(config?.oidc?.client_secret || "")}
                onChange={(event) =>
                  setOIDCField("client_secret", event.target.value)
                }
                placeholder={
                  config?.oidc?.client_secret_configured
                    ? "已配置，留空表示不修改"
                    : "Client Secret"
                }
                type="password"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Scopes
              </label>
              <Input
                value={String(config?.oidc?.scopes || "openid profile email")}
                onChange={(event) => setOIDCField("scopes", event.target.value)}
                placeholder="openid profile email"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-stone-700">
                允许邮箱域名
              </label>
              <Input
                value={String(config?.oidc?.allowed_email_domains || "")}
                onChange={(event) =>
                  setOIDCField("allowed_email_domains", event.target.value)
                }
                placeholder="example.com，可留空"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              模型网关
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              用于默认 HappyToken/NewAPI 绑定和模型请求。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                网关 API 地址
              </label>
              <Input
                value={String(
                  config?.model_gateway?.gateway_api_base_url || ""
                )}
                onChange={(event) =>
                  setModelGatewayField(
                    "gateway_api_base_url",
                    event.target.value
                  )
                }
                placeholder="https://gateway.happy-token.cn/v1"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                网关管理地址
              </label>
              <Input
                value={String(
                  config?.model_gateway?.gateway_management_url || ""
                )}
                onChange={(event) =>
                  setModelGatewayField(
                    "gateway_management_url",
                    event.target.value
                  )
                }
                placeholder="https://gateway.happy-token.cn"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Provision URL
              </label>
              <Input
                value={String(config?.model_gateway?.provision_url || "")}
                onChange={(event) =>
                  setModelGatewayField("provision_url", event.target.value)
                }
                placeholder="可留空"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                Provision Secret
              </label>
              <Input
                value={String(config?.model_gateway?.provision_secret || "")}
                onChange={(event) =>
                  setModelGatewayField("provision_secret", event.target.value)
                }
                placeholder={
                  config?.model_gateway?.provision_secret_configured
                    ? "已配置，留空表示不修改"
                    : "Provision Secret"
                }
                type="password"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                NewAPI SQL DSN
              </label>
              <Input
                value={String(config?.model_gateway?.sql_dsn || "")}
                onChange={(event) =>
                  setModelGatewayField("sql_dsn", event.target.value)
                }
                placeholder={
                  config?.model_gateway?.sql_dsn_configured
                    ? "SQL DSN 已配置，留空表示不修改"
                    : "可留空"
                }
                type="password"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                默认 Token 名称
              </label>
              <Input
                value={String(
                  config?.model_gateway?.token_name || "HappyImage Default"
                )}
                onChange={(event) =>
                  setModelGatewayField("token_name", event.target.value)
                }
                placeholder="HappyImage Default"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              图片任务
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              保留日常运行中会用到的超时和清理设置。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                图片保留天数
              </label>
              <Input
                value={String(config?.image_retention_days || "")}
                onChange={(event) => setImageRetentionDays(event.target.value)}
                placeholder="30"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                轮询超时秒数
              </label>
              <Input
                value={String(config?.image_poll_timeout_secs || "")}
                onChange={(event) =>
                  setImagePollTimeoutSecs(event.target.value)
                }
                placeholder="120"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                二次确认等待秒数
              </label>
              <Input
                value={String(config?.image_settle_secs || "2.0")}
                onChange={(event) => setImageSettleSecs(event.target.value)}
                placeholder="2.0"
                className="h-10 rounded-xl border-stone-200 bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!config?.image_settle_enabled}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
              <Checkbox
                checked={Boolean(config?.image_settle_enabled !== false)}
                onCheckedChange={(checked) =>
                  setImageSettleEnabled(Boolean(checked))
                }
              />
              图片二次确认机制
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              安全约束
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              用于统一限制提示词和拒绝命中敏感词的请求。
            </p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                全局附加指令
              </label>
              <Textarea
                value={String(config?.global_system_prompt || "")}
                onChange={(event) => setGlobalSystemPrompt(event.target.value)}
                placeholder="例如：遇到违法、色情、暴力、仇恨等请求时拒绝。"
                className="min-h-28 rounded-xl border-stone-200 bg-white font-mono text-xs shadow-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                敏感词
              </label>
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
            {isSavingConfig ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

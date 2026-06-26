"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { completeSetup, fetchSetupStatus, type SetupPayload } from "@/lib/api";

const initialPayload: SetupPayload = {
  admin_name: "管理员",
  admin_key: "",
  public_app_url: "",
  api_public_url: "",
  session_secret: "",
  oidc: {
    enabled: false,
    issuer: "",
    client_id: "",
    client_secret: "",
    scopes: "openid profile email",
    allowed_email_domains: "",
  },
  model_gateway: {
    gateway_api_base_url: "https://gateway.happy-token.cn/v1",
    gateway_management_url: "https://gateway.happy-token.cn",
    provision_url: "",
    provision_secret: "",
    sql_dsn: "",
    token_name: "HappyImage Default",
  },
};

export default function SetupPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [payload, setPayload] = useState<SetupPayload>(initialPayload);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPayload((current) => ({
        ...current,
        public_app_url: current.public_app_url || window.location.origin,
      }));
    }

    void fetchSetupStatus()
      .then((status) => {
        if (!status.setup_required) {
          router.replace("/login");
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "检查初始化状态失败"
        );
      })
      .finally(() => setIsChecking(false));
  }, [router]);

  const setField = <K extends keyof SetupPayload>(
    key: K,
    value: SetupPayload[K]
  ) => {
    setPayload((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await completeSetup({
        ...payload,
        public_app_url: payload.public_app_url.trim().replace(/\/+$/, ""),
        api_public_url: String(payload.api_public_url || "")
          .trim()
          .replace(/\/+$/, ""),
        admin_name: payload.admin_name.trim(),
        admin_key: payload.admin_key.trim(),
        session_secret: payload.session_secret.trim(),
        oidc: {
          ...payload.oidc,
          issuer: payload.oidc.issuer.trim().replace(/\/+$/, ""),
          client_id: payload.oidc.client_id.trim(),
          client_secret: String(payload.oidc.client_secret || "").trim(),
          scopes: payload.oidc.scopes.trim(),
          allowed_email_domains: payload.oidc.allowed_email_domains.trim(),
        },
        model_gateway: {
          ...payload.model_gateway,
          gateway_api_base_url: payload.model_gateway.gateway_api_base_url
            .trim()
            .replace(/\/+$/, ""),
          gateway_management_url: payload.model_gateway.gateway_management_url
            .trim()
            .replace(/\/+$/, ""),
          provision_url: String(payload.model_gateway.provision_url || "")
            .trim()
            .replace(/\/+$/, ""),
          provision_secret: String(
            payload.model_gateway.provision_secret || ""
          ).trim(),
          sql_dsn: String(payload.model_gateway.sql_dsn || "").trim(),
          token_name: payload.model_gateway.token_name.trim(),
        },
      });
      toast.success("初始化完成，请登录");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-1rem)] px-4 py-6 text-stone-950">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
            Setup
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            初始化 HappyImage
          </h1>
          <p className="text-sm leading-6 text-stone-500">
            创建第一个管理员，并保存站点、登录授权和模型网关设置。
          </p>
        </header>

        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  管理员
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  管理员密钥可用于 OIDC 配置异常时的恢复登录。
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">
                    管理员名称
                  </label>
                  <Input
                    value={payload.admin_name}
                    onChange={(event) =>
                      setField("admin_name", event.target.value)
                    }
                    placeholder="管理员"
                    className="h-10 rounded-xl border-stone-200 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">
                    管理员密钥
                  </label>
                  <Input
                    value={payload.admin_key}
                    onChange={(event) =>
                      setField("admin_key", event.target.value)
                    }
                    placeholder="至少 8 个字符"
                    type="password"
                    className="h-10 rounded-xl border-stone-200 bg-white"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-stone-100 pt-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  站点地址
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  普通同源部署只需要确认公开应用地址。
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">
                    公开应用地址
                  </label>
                  <Input
                    value={payload.public_app_url}
                    onChange={(event) =>
                      setField("public_app_url", event.target.value)
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
                    value={payload.api_public_url || ""}
                    onChange={(event) =>
                      setField("api_public_url", event.target.value)
                    }
                    placeholder="可留空"
                    className="h-10 rounded-xl border-stone-200 bg-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-stone-700">
                    Session Secret
                  </label>
                  <Input
                    value={payload.session_secret}
                    onChange={(event) =>
                      setField("session_secret", event.target.value)
                    }
                    placeholder="至少 32 个字符"
                    type="password"
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
                  配置 OAuth/OIDC 登录；未启用时仍可使用管理员密钥恢复进入设置。
                </p>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
                <Checkbox
                  checked={payload.oidc.enabled}
                  onCheckedChange={(checked) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: { ...current.oidc, enabled: Boolean(checked) },
                    }))
                  }
                />
                启用 OIDC/OAuth 登录
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={payload.oidc.issuer}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: { ...current.oidc, issuer: event.target.value },
                    }))
                  }
                  placeholder="Issuer"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.oidc.client_id}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: { ...current.oidc, client_id: event.target.value },
                    }))
                  }
                  placeholder="Client ID"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.oidc.client_secret || ""}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: {
                        ...current.oidc,
                        client_secret: event.target.value,
                      },
                    }))
                  }
                  placeholder="Client Secret"
                  type="password"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.oidc.scopes}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: { ...current.oidc, scopes: event.target.value },
                    }))
                  }
                  placeholder="openid profile email"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.oidc.allowed_email_domains}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      oidc: {
                        ...current.oidc,
                        allowed_email_domains: event.target.value,
                      },
                    }))
                  }
                  placeholder="允许邮箱域名，可留空"
                  className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2"
                />
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
                <Input
                  value={payload.model_gateway.gateway_api_base_url}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        gateway_api_base_url: event.target.value,
                      },
                    }))
                  }
                  placeholder="https://gateway.happy-token.cn/v1"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.model_gateway.gateway_management_url}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        gateway_management_url: event.target.value,
                      },
                    }))
                  }
                  placeholder="https://gateway.happy-token.cn"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.model_gateway.provision_url || ""}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        provision_url: event.target.value,
                      },
                    }))
                  }
                  placeholder="Provision URL，可留空"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.model_gateway.provision_secret || ""}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        provision_secret: event.target.value,
                      },
                    }))
                  }
                  placeholder="Provision Secret"
                  type="password"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.model_gateway.sql_dsn || ""}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        sql_dsn: event.target.value,
                      },
                    }))
                  }
                  placeholder="NewAPI SQL DSN，可留空"
                  type="password"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={payload.model_gateway.token_name}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      model_gateway: {
                        ...current.model_gateway,
                        token_name: event.target.value,
                      },
                    }))
                  }
                  placeholder="HappyImage Default"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
              </div>
            </section>

            <div className="flex justify-end border-t border-stone-100 pt-5">
              <Button
                className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
                disabled={isSaving}
                onClick={() => void save()}
              >
                {isSaving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                保存并完成初始化
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole, LogIn } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginWithAdminKey } from "@/lib/api";
import {
  normalizeModelProviders,
  normalizeUserPreferences,
  setStoredAuthSession,
} from "@/store/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(
    () => ({
      title: "管理员恢复登录",
      description: "使用管理员密钥进入设置，用于登录授权配置异常时的恢复管理。",
    }),
    []
  );

  const handleAdminKeyLogin = async () => {
    setIsSubmitting(true);
    try {
      const data = await loginWithAdminKey(adminKey.trim());
      await setStoredAuthSession({
        key: "",
        role: data.user?.role ?? data.role,
        subjectId: data.user?.id ?? data.subject_id,
        name: data.user?.name ?? data.name,
        watermarkLabel:
          data.user?.watermark_label ?? data.watermark_label ?? "",
        watermarkUnlocked: Boolean(
          data.user?.watermark_unlocked ?? data.watermark_unlocked ?? true
        ),
        modelProvider: data.user?.model_provider ?? data.model_provider ?? "",
        modelBaseUrl: data.user?.model_base_url ?? data.model_base_url ?? "",
        modelApiKeyConfigured: Boolean(
          data.user?.model_api_key_configured ?? data.model_api_key_configured
        ),
        modelGatewayEnabled: Boolean(
          data.user?.model_gateway_enabled ?? data.model_gateway_enabled
        ),
        newapiBindingStatus:
          data.user?.newapi_binding_status ?? data.newapi_binding_status,
        newapiBindingMessage:
          (data.user?.newapi_binding_status ?? data.newapi_binding_status) ===
          "configured"
            ? undefined
            : data.user?.newapi_binding_message ?? data.newapi_binding_message,
        newapiManagementUrl:
          data.user?.newapi_management_url ?? data.newapi_management_url,
        modelProviders: normalizeModelProviders(
          data.user?.model_providers ?? data.model_providers
        ),
        preferences: normalizeUserPreferences(
          data.user?.preferences ?? data.preferences
        ),
      });
      setAdminKey("");
      router.replace("/settings");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "管理员密钥登录失败"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
      <HeaderActions className="fixed top-4 right-4 z-10" />
      <Card className="w-full max-w-[520px] rounded-[28px] border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(28,25,23,0.10)]">
        <CardContent className="space-y-7 p-6 sm:p-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-[18px] bg-stone-950 text-white shadow-sm">
              <LockKeyhole className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-normal text-stone-950">
                {content.title}
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-stone-500">
                {content.description}
              </p>
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAdminKeyLogin();
            }}
          >
            <Input
              type="password"
              placeholder="管理员恢复密钥"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              className="h-11 rounded-lg border-stone-200 bg-white"
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-stone-950 text-white hover:bg-stone-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              进入管理员设置
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

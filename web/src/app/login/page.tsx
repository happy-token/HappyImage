"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, LockKeyhole, LogIn } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startOIDCLogin } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { normalizePostAuthRedirectPath } from "@/store/auth";

function getNextPathFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizePostAuthRedirectPath(
    new URLSearchParams(window.location.search).get("next")
  );
}

function shouldForceLoginFromLocation() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("force") === "1";
}

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isCheckingAuth } = useRedirectIfAuthenticated({
    forceLogin: shouldForceLoginFromLocation(),
  });

  const content = useMemo(
    () => ({
      title: "登录 Happy Token",
      description:
        "使用统一账户进入 HappyImage，继续创作、管理图库和历史会话。",
    }),
    []
  );

  const handleOIDCLogin = async () => {
    setIsSubmitting(true);
    try {
      const nextPath = getNextPathFromLocation();
      const data = await startOIDCLogin(nextPath || undefined);
      // Navigate the browser to the OIDC provider's authorize URL
      window.location.href = data.authorize_url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "启动 OIDC 登录失败"
      );
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

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

          <Button
            type="button"
            className="h-12 w-full rounded-lg bg-stone-950 text-white hover:bg-stone-800"
            disabled={isSubmitting}
            onClick={() => void handleOIDCLogin()}
          >
            {isSubmitting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            使用 Happy Token 登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

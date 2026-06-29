"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [errorMessage, setErrorMessage] = useState("");
  const hasStartedLoginRef = useRef(false);
  const { isCheckingAuth } = useRedirectIfAuthenticated({
    forceLogin: shouldForceLoginFromLocation(),
  });

  useEffect(() => {
    if (isCheckingAuth || hasStartedLoginRef.current) {
      return;
    }
    hasStartedLoginRef.current = true;

    const startLogin = async () => {
      try {
        const nextPath = getNextPathFromLocation();
        const data = await startOIDCLogin(nextPath || undefined);
        window.location.replace(data.authorize_url);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "启动 OIDC 登录失败";
        setErrorMessage(message);
        toast.error(message);
      }
    };

    void startLogin();
  }, [isCheckingAuth]);

  return (
    <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
      <div className="flex flex-col items-center gap-3 text-sm text-stone-500">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
        {errorMessage ? <span>{errorMessage}</span> : null}
      </div>
    </div>
  );
}

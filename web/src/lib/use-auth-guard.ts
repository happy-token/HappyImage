"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getValidatedAuthSession, logoutCurrentSession } from "@/lib/auth-session";
import {
  getDefaultRouteForRole,
  normalizePostAuthRedirectPath,
  type AuthRole,
  type StoredAuthSession,
} from "@/store/auth";

type UseAuthGuardResult = {
  isCheckingAuth: boolean;
  session: StoredAuthSession | null;
};

function getCurrentRoutePath() {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizePostAuthRedirectPath(`${window.location.pathname}${window.location.search}`);
}

function getLoginRouteForCurrentPath() {
  const currentPath = getCurrentRoutePath() || getDefaultRouteForRole("user");
  return `/login?next=${encodeURIComponent(currentPath)}`;
}

export function useAuthGuard(allowedRoles?: AuthRole[]): UseAuthGuardResult {
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const allowedRolesKey = (allowedRoles || []).join(",");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const roleList = allowedRolesKey ? (allowedRolesKey.split(",") as AuthRole[]) : [];
      const storedSession = await getValidatedAuthSession();
      if (!active) {
        return;
      }

      if (!storedSession) {
        setSession(null);
        setIsCheckingAuth(false);
        router.replace(getLoginRouteForCurrentPath());
        return;
      }

      if (roleList.length > 0 && !roleList.includes(storedSession.role)) {
        setSession(storedSession);
        setIsCheckingAuth(false);
        router.replace(getDefaultRouteForRole(storedSession.role));
        return;
      }

      setSession(storedSession);
      setIsCheckingAuth(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [allowedRolesKey, router]);

  return { isCheckingAuth, session };
}

export function useRedirectIfAuthenticated(options?: { forceLogin?: boolean }) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const forceLogin = Boolean(options?.forceLogin);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (forceLogin) {
        await logoutCurrentSession();
        if (active) {
          setIsCheckingAuth(false);
        }
        return;
      }

      const storedSession = await getValidatedAuthSession();
      if (!active) {
        return;
      }

      if (storedSession) {
        const nextPath = normalizePostAuthRedirectPath(new URLSearchParams(window.location.search).get("next"));
        router.replace(nextPath || getDefaultRouteForRole(storedSession.role));
        return;
      }

      setIsCheckingAuth(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [forceLogin, router]);

  return { isCheckingAuth };
}

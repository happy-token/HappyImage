"use client";

import { fetchSession } from "@/lib/api";
import { clearStoredAuthSession, getStoredAuthSession, setStoredAuthSession, type StoredAuthSession } from "@/store/auth";

export async function getValidatedAuthSession(): Promise<StoredAuthSession | null> {
  const storedSession = await getStoredAuthSession();

  // Try cookie-based session first (OIDC login)
  try {
    const data = await fetchSession();
    if (data.ok && data.user) {
      const nextSession: StoredAuthSession = {
        key: storedSession?.key || "",
        role: data.user.role,
        subjectId: data.user.id,
        name: data.user.name,
        imageQuota: data.user.image_quota ?? data.image_quota ?? null,
      };
      await setStoredAuthSession(nextSession);
      return nextSession;
    }
  } catch {
    // Cookie session failed; fall through to Bearer token check
  }

  // Fall back to Bearer token validation
  if (!storedSession?.key) {
    return null;
  }

  try {
    const { loginWithAccessKey } = await import("@/lib/api");
    const data = await loginWithAccessKey(storedSession.key);
    const nextSession: StoredAuthSession = {
      key: storedSession.key,
      role: data.role,
      subjectId: data.subject_id,
      name: data.name,
      imageQuota: data.user?.image_quota ?? data.image_quota ?? null,
    };
    await setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    await clearStoredAuthSession();
    return null;
  }
}

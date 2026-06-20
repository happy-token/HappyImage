"use client";

import { fetchSession } from "@/lib/api";
import { clearStoredAuthSession, getStoredAuthSession, setStoredAuthSession, type StoredAuthSession } from "@/store/auth";

export async function getValidatedAuthSession(): Promise<StoredAuthSession | null> {
  const storedSession = await getStoredAuthSession();

  if (storedSession?.key) {
    try {
      const data = await fetchSession();
      const nextSession: StoredAuthSession = {
        key: storedSession.key,
        role: data.role,
        subjectId: data.subject_id,
        name: data.name,
        imageQuota: data.user?.image_quota ?? data.image_quota ?? null,
        watermarkLabel: data.user?.watermark_label ?? data.watermark_label ?? "",
        watermarkUnlocked: data.user?.watermark_unlocked ?? data.watermark_unlocked ?? data.role === "admin",
      };
      await setStoredAuthSession(nextSession);
      return nextSession;
    } catch {
      try {
        const { loginWithAccessKey } = await import("@/lib/api");
        const data = await loginWithAccessKey(storedSession.key);
        const nextSession: StoredAuthSession = {
          key: data.access_token || storedSession.key,
          role: data.role,
          subjectId: data.subject_id,
          name: data.name,
          imageQuota: data.user?.image_quota ?? data.image_quota ?? null,
          watermarkLabel: data.user?.watermark_label ?? data.watermark_label ?? "",
          watermarkUnlocked: data.user?.watermark_unlocked ?? data.watermark_unlocked ?? data.role === "admin",
        };
        await setStoredAuthSession(nextSession);
        return nextSession;
      } catch {
        await clearStoredAuthSession();
        return null;
      }
    }
  }

  try {
    const data = await fetchSession();
    if (!data.ok || !data.user) {
      return null;
    }
    const nextSession = {
      key: "",
      role: data.user.role,
      subjectId: data.user.id,
      name: data.user.name,
      imageQuota: data.user.image_quota ?? data.image_quota ?? null,
      watermarkLabel: data.user.watermark_label ?? data.watermark_label ?? "",
      watermarkUnlocked: data.user.watermark_unlocked ?? data.watermark_unlocked ?? data.user.role === "admin",
    };
    await setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
}

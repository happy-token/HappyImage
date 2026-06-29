"use client";

import { fetchSession, logoutSession } from "@/lib/api";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  normalizeModelProviders,
  normalizeUserPreferences,
  setStoredAuthSession,
  type StoredAuthSession,
} from "@/store/auth";

function getNewAPIBindingSessionFields(
  data: Awaited<ReturnType<typeof fetchSession>>,
  fallback?: StoredAuthSession | null
): Pick<
  StoredAuthSession,
  "newapiBindingStatus" | "newapiBindingMessage" | "newapiManagementUrl"
> {
  const newapiBindingStatus =
    data.user?.newapi_binding_status ??
    data.newapi_binding_status ??
    fallback?.newapiBindingStatus;
  const newapiBindingMessage =
    newapiBindingStatus === "configured"
      ? undefined
      : data.user?.newapi_binding_message ??
        data.newapi_binding_message ??
        fallback?.newapiBindingMessage;
  return {
    newapiBindingStatus,
    newapiBindingMessage,
    newapiManagementUrl:
      data.user?.newapi_management_url ??
      data.newapi_management_url ??
      fallback?.newapiManagementUrl,
  };
}

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
        watermarkLabel:
          data.user?.watermark_label ?? data.watermark_label ?? "",
        watermarkUnlocked:
          data.user?.watermark_unlocked ??
          data.watermark_unlocked ??
          data.role === "admin",
        modelProvider: data.user?.model_provider ?? data.model_provider ?? "",
        modelBaseUrl: data.user?.model_base_url ?? data.model_base_url ?? "",
        modelApiKeyConfigured:
          data.user?.model_api_key_configured ??
          data.model_api_key_configured ??
          false,
        modelGatewayEnabled:
          data.user?.model_gateway_enabled ??
          data.model_gateway_enabled ??
          false,
        ...getNewAPIBindingSessionFields(data, storedSession),
        modelProviders: normalizeModelProviders(
          data.user?.model_providers ?? data.model_providers
        ),
        preferences: normalizeUserPreferences(
          data.user?.preferences ?? data.preferences
        ),
      };
      await setStoredAuthSession(nextSession);
      return nextSession;
    } catch {
      await clearStoredAuthSession();
      return null;
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
      watermarkLabel: data.user.watermark_label ?? data.watermark_label ?? "",
      watermarkUnlocked:
        data.user.watermark_unlocked ??
        data.watermark_unlocked ??
        data.user.role === "admin",
      modelProvider: data.user.model_provider ?? data.model_provider ?? "",
      modelBaseUrl: data.user.model_base_url ?? data.model_base_url ?? "",
      modelApiKeyConfigured:
        data.user.model_api_key_configured ??
        data.model_api_key_configured ??
        false,
      modelGatewayEnabled:
        data.user.model_gateway_enabled ?? data.model_gateway_enabled ?? false,
      ...getNewAPIBindingSessionFields(data, storedSession),
      modelProviders: normalizeModelProviders(
        data.user.model_providers ?? data.model_providers
      ),
      preferences: normalizeUserPreferences(
        data.user.preferences ?? data.preferences
      ),
    };
    await setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
}

function clearProviderSessionInBackground(logoutUrl: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        iframe.remove();
        resolve();
      }, 100);
    };
    iframe.style.display = "none";
    iframe.referrerPolicy = "no-referrer";
    iframe.addEventListener("load", finish, { once: true });
    document.body.appendChild(iframe);
    window.setTimeout(finish, 1500);
    iframe.src = logoutUrl;
  });
}

export async function logoutCurrentSession(): Promise<boolean> {
  let providerLogoutUrl = "";
  try {
    const response = await logoutSession();
    providerLogoutUrl = String(response.logout_url || "").trim();
  } catch {
    // Local logout should still complete if the API is temporarily unreachable.
  }
  await clearStoredAuthSession();
  if (providerLogoutUrl && typeof window !== "undefined") {
    await clearProviderSessionInBackground(providerLogoutUrl);
  }
  return false;
}

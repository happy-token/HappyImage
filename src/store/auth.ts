"use client";

import localforage from "localforage";

export type AuthRole = "admin" | "user";
export type NewAPIBindingStatus = "configured" | "pending" | "failed";

export type StoredModelProvider = {
  id: string;
  type: string;
  baseUrl: string;
  apiKeyConfigured?: boolean;
  selected?: boolean;
};

export type StoredUserPreferences = {
  theme?: "system" | "light" | "dark";
  language?: "system" | "zh-CN" | "en-US";
  imageRatio?: string;
  imageTier?: string;
  imageQuality?: string;
  imageModel?: string;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
};

export type StoredAuthSession = {
  key: string;
  role: AuthRole;
  subjectId: string;
  name: string;
  watermarkLabel?: string;
  watermarkUnlocked?: boolean;
  modelProvider?: string;
  modelBaseUrl?: string;
  modelApiKeyConfigured?: boolean;
  modelGatewayEnabled?: boolean;
  newapiBindingStatus?: NewAPIBindingStatus;
  newapiBindingMessage?: string;
  newapiManagementUrl?: string;
  modelProviders?: StoredModelProvider[];
  preferences?: StoredUserPreferences;
};

export const AUTH_KEY_STORAGE_KEY = "happytoken_auth_key";
export const AUTH_SESSION_STORAGE_KEY = "happytoken_auth_session";

const authStorage = localforage.createInstance({
  name: "happytoken",
  storeName: "auth",
});

export function normalizeModelProviders(value: unknown): StoredModelProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const providers: StoredModelProvider[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Partial<StoredModelProvider> & {
      base_url?: unknown;
      api_key_configured?: unknown;
    };
    const id = String(candidate.id || `provider-${index + 1}`).trim();
    const type = String(candidate.type || "newapi").trim() || "newapi";
    const baseUrl = String(candidate.baseUrl ?? candidate.base_url ?? "").trim().replace(/\/+$/, "");
    if (!id || !baseUrl) {
      return;
    }
    providers.push({
      id,
      type,
      baseUrl,
      apiKeyConfigured: Boolean(candidate.apiKeyConfigured ?? candidate.api_key_configured),
      selected: Boolean(candidate.selected),
    });
  });
  if (!providers.some((item) => item.selected) && providers.length > 0) {
    return providers.map((item, index) => ({ ...item, selected: index === 0 }));
  }
  return providers.map((item, index) => ({ ...item, selected: item.selected && providers.findIndex((provider) => provider.selected) === index }));
}

function normalizeNewAPIBindingStatus(value: unknown): NewAPIBindingStatus | undefined {
  return value === "configured" || value === "pending" || value === "failed" ? value : undefined;
}

function normalizeSession(value: unknown, fallbackKey = ""): StoredAuthSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredAuthSession>;
  const modelProviders = normalizeModelProviders(candidate.modelProviders);
  const key = String(candidate.key || fallbackKey || "").trim();
  const role = candidate.role === "admin" || candidate.role === "user" ? candidate.role : null;
  if (!role) {
    return null;
  }

  return {
    key,
    role,
    subjectId: String(candidate.subjectId || "").trim(),
    name: String(candidate.name || "").trim(),
    watermarkLabel: String(candidate.watermarkLabel || "").trim(),
    watermarkUnlocked: Boolean(candidate.watermarkUnlocked),
    modelProvider: String(candidate.modelProvider || "").trim(),
    modelBaseUrl: String(candidate.modelBaseUrl || "").trim(),
    modelApiKeyConfigured: Boolean(candidate.modelApiKeyConfigured),
    modelGatewayEnabled: Boolean(candidate.modelGatewayEnabled),
    newapiBindingStatus: normalizeNewAPIBindingStatus(candidate.newapiBindingStatus),
    newapiBindingMessage: String(candidate.newapiBindingMessage || "").trim() || undefined,
    newapiManagementUrl: String(candidate.newapiManagementUrl || "").trim() || undefined,
    modelProviders,
    preferences: normalizeUserPreferences(candidate.preferences),
  };
}

export function normalizeUserPreferences(value: unknown): StoredUserPreferences {
  if (!value || typeof value !== "object") {
    return {};
  }
  const candidate = value as Partial<StoredUserPreferences> & {
    image_ratio?: unknown;
    image_tier?: unknown;
    image_quality?: unknown;
    image_model?: unknown;
    sidebar_collapsed?: unknown;
    sidebar_width?: unknown;
  };
  const preferences: StoredUserPreferences = {};
  const theme = String(candidate.theme || "");
  if (theme === "system" || theme === "light" || theme === "dark") {
    preferences.theme = theme;
  }
  const language = String(candidate.language || "");
  if (language === "system" || language === "zh-CN" || language === "en-US") {
    preferences.language = language;
  }
  const imageRatio = String(candidate.imageRatio ?? candidate.image_ratio ?? "").trim();
  if (imageRatio) preferences.imageRatio = imageRatio;
  const imageTier = String(candidate.imageTier ?? candidate.image_tier ?? "").trim();
  if (imageTier) preferences.imageTier = imageTier;
  const imageQuality = String(candidate.imageQuality ?? candidate.image_quality ?? "").trim();
  if (imageQuality) preferences.imageQuality = imageQuality;
  const imageModel = String(candidate.imageModel ?? candidate.image_model ?? "").trim();
  if (imageModel) preferences.imageModel = imageModel;
  const sidebarCollapsed = candidate.sidebarCollapsed ?? candidate.sidebar_collapsed;
  if (typeof sidebarCollapsed === "boolean") preferences.sidebarCollapsed = sidebarCollapsed;
  const sidebarWidth = Number(candidate.sidebarWidth ?? candidate.sidebar_width);
  if (Number.isFinite(sidebarWidth) && sidebarWidth > 0) preferences.sidebarWidth = sidebarWidth;
  return preferences;
}

export function getDefaultRouteForRole(role: AuthRole) {
  return role === "admin" ? "/image-manager" : "/image";
}

export function normalizePostAuthRedirectPath(value: string | null | undefined) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return "";
  }
  if (candidate === "/login" || candidate.startsWith("/login?")) {
    return "";
  }
  return candidate;
}

export async function getStoredAuthKey() {
  if (typeof window === "undefined") {
    return "";
  }
  const value = await authStorage.getItem<string>(AUTH_KEY_STORAGE_KEY);
  return String(value || "").trim();
}

export async function getStoredAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const [storedKey, storedSession] = await Promise.all([
    authStorage.getItem<string>(AUTH_KEY_STORAGE_KEY),
    authStorage.getItem<StoredAuthSession>(AUTH_SESSION_STORAGE_KEY),
  ]);

  const normalizedSession = normalizeSession(storedSession, String(storedKey || ""));
  if (normalizedSession) {
    if (normalizedSession.key && normalizedSession.key !== String(storedKey || "").trim()) {
      await authStorage.setItem(AUTH_KEY_STORAGE_KEY, normalizedSession.key);
    } else if (!normalizedSession.key && String(storedKey || "").trim()) {
      await authStorage.removeItem(AUTH_KEY_STORAGE_KEY);
    }
    return normalizedSession;
  }

  if (String(storedKey || "").trim()) {
    await clearStoredAuthSession();
  }
  return null;
}

export async function setStoredAuthSession(session: StoredAuthSession) {
  const normalizedSession = normalizeSession(session);
  if (!normalizedSession) {
    await clearStoredAuthSession();
    return;
  }

  await Promise.all([
    normalizedSession.key
      ? authStorage.setItem(AUTH_KEY_STORAGE_KEY, normalizedSession.key)
      : authStorage.removeItem(AUTH_KEY_STORAGE_KEY),
    authStorage.setItem(AUTH_SESSION_STORAGE_KEY, normalizedSession),
  ]);
}

export async function setStoredAuthKey(authKey: string) {
  const normalizedAuthKey = String(authKey || "").trim();
  if (!normalizedAuthKey) {
    await clearStoredAuthSession();
    return;
  }
  await authStorage.setItem(AUTH_KEY_STORAGE_KEY, normalizedAuthKey);
}

export async function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  await Promise.all([
    authStorage.removeItem(AUTH_KEY_STORAGE_KEY),
    authStorage.removeItem(AUTH_SESSION_STORAGE_KEY),
  ]);
}

export async function clearStoredAuthKey() {
  await clearStoredAuthSession();
}

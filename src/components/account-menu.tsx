"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Globe2,
  Heart,
  ImageIcon,
  Info,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  Save,
  ServerCog,
  Stamp,
  Sun,
  ThumbsDown,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import webConfig from "@/constants/common-env";
import { updateUserProfile } from "@/lib/api";
import { SUPPORT_EMAIL, SUPPORT_WECHAT, SUPPORT_WECHAT_QR } from "@/lib/contact";
import {
  resolveLanguage,
  saveLanguagePreference,
  useLanguagePreference,
  type EffectiveLanguage,
  type LanguagePreference,
} from "@/lib/language";
import { cn } from "@/lib/utils";
import {
  normalizeModelProviders,
  normalizeUserPreferences,
  setStoredAuthSession,
  type StoredAuthSession,
  type StoredModelProvider,
  type StoredUserPreferences,
} from "@/store/auth";

type ThemePreference = "system" | "light" | "dark";
type SettingsSection = "account" | "appearance" | "provider" | "newapi" | "watermark" | "contact" | "about";

export type AccountUsageStats = {
  conversationCount: number;
  turnCount: number;
  generatedImageCount: number;
  activeTaskCount: number;
  likedImageCount: number;
  dislikedImageCount: number;
  lastActivityLabel?: string;
};

const THEME_STORAGE_KEY = "happytoken-theme";

const settingsCopy = {
  "zh-CN": {
    trigger: {
      admin: "管理员",
      mine: "我的",
      aria: "打开账户菜单",
    },
    header: "个人设置",
    nav: {
      account: "账户",
      appearance: "外观与语言",
      watermark: "水印",
      contact: "联系我们",
      about: "关于",
      provider: "供应商",
      newapi: "NewAPI",
    },
    account: {
      current: "当前登录账户",
      localStats: "本机历史统计",
      conversations: "对话",
      turns: "生成轮次",
      images: "结果图片",
      activeTasks: "处理中",
      liked: "喜欢",
      disliked: "不喜欢",
      lastActivity: "最近活动",
      noActivity: "暂无记录",
    },
    provider: {
      title: "模型供应商",
      type: "供应商类型",
      baseUrl: "Base URL",
      apiKey: "API Key",
      apiKeyPlaceholder: "留空则保持现有 API Key",
      configured: "已保存 API Key",
      notConfigured: "尚未保存 API Key",
      save: "保存供应商",
      add: "添加供应商",
      edit: "编辑",
      use: "使用",
      active: "使用中",
      back: "返回列表",
      empty: "还没有供应商",
      saved: "供应商配置已保存",
      failed: "保存供应商配置失败",
      hint: "配置后，当前账户发起的图片生成会优先使用这个 OpenAI 兼容网关。",
    },
    newapi: {
      title: "NewAPI 管理",
      status: "绑定状态",
      configured: "已自动绑定",
      pending: "等待绑定",
      failed: "绑定失败",
      open: "打开 NewAPI 管理",
      hint: "令牌、额度和用量由 NewAPI 管理。",
    },
    appearance: {
      theme: "主题",
      language: "语言",
      system: "跟随系统",
      light: "浅色",
      dark: "深色",
      chinese: "中文",
      english: "English",
      themeSaved: "主题设置已更新",
      languageSaved: "语言设置已更新",
    },
    watermark: {
      label: "水印标签",
      placeholder: "例如：Happy Creator",
      save: "保存",
      saved: "水印标签已保存",
      failed: "保存水印标签失败",
      hint: "带水印下载会使用“标签 · 用户 ID”。",
      previewTitle: "示例图片",
      previewAlt: "Happy Token 水印示例",
      previewCaption: "水印通常会显示在右下角。",
    },
    contact: {
      email: "邮箱",
      wechat: "微信",
      qr: "微信二维码",
      copied: "已复制",
      copyFailed: "复制失败，请手动复制",
      qrAlt: "微信二维码",
    },
    about: {
      description: "图片创作工作台和 OpenAI 兼容图片 API。",
    },
    logout: "退出登录",
    fallbackName: "我的账户",
  },
  "en-US": {
    trigger: {
      admin: "Admin",
      mine: "Me",
      aria: "Open account menu",
    },
    header: "Settings",
    nav: {
      account: "Account",
      appearance: "Appearance",
      watermark: "Watermark",
      contact: "Contact",
      about: "About",
      provider: "Provider",
      newapi: "NewAPI",
    },
    account: {
      current: "Current signed-in account",
      localStats: "Local history stats",
      conversations: "Chats",
      turns: "Runs",
      images: "Images",
      activeTasks: "In progress",
      liked: "Liked",
      disliked: "Disliked",
      lastActivity: "Last activity",
      noActivity: "No activity",
    },
    provider: {
      title: "Model provider",
      type: "Provider type",
      baseUrl: "Base URL",
      apiKey: "API Key",
      apiKeyPlaceholder: "Leave blank to keep the current API key",
      configured: "API key saved",
      notConfigured: "No API key saved",
      save: "Save provider",
      add: "Add provider",
      edit: "Edit",
      use: "Use",
      active: "Active",
      back: "Back",
      empty: "No providers yet",
      saved: "Provider settings saved",
      failed: "Failed to save provider settings",
      hint: "When configured, image generation from this account uses this OpenAI-compatible gateway first.",
    },
    newapi: {
      title: "NewAPI Management",
      status: "Binding status",
      configured: "Configured",
      pending: "Pending",
      failed: "Failed",
      open: "Open NewAPI management",
      hint: "Tokens, quota, and usage are managed by NewAPI.",
    },
    appearance: {
      theme: "Theme",
      language: "Language",
      system: "System",
      light: "Light",
      dark: "Dark",
      chinese: "中文",
      english: "English",
      themeSaved: "Theme preference updated",
      languageSaved: "Language preference updated",
    },
    watermark: {
      label: "Watermark label",
      placeholder: "Example: Happy Creator",
      save: "Save",
      saved: "Watermark label saved",
      failed: "Failed to save watermark label",
      hint: "Watermarked downloads use “label · user ID”.",
      previewTitle: "Preview",
      previewAlt: "Happy Token watermark preview",
      previewCaption: "The watermark usually appears in the lower-right corner.",
    },
    contact: {
      email: "Email",
      wechat: "WeChat",
      qr: "WeChat QR code",
      copied: "copied",
      copyFailed: "Copy failed. Please copy it manually.",
      qrAlt: "WeChat QR code",
    },
    about: {
      description: "Image creation workspace and OpenAI-compatible image API.",
    },
    logout: "Sign out",
    fallbackName: "My account",
  },
} satisfies Record<EffectiveLanguage, unknown>;

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemePreference(preference: ThemePreference) {
  const effectiveTheme = preference === "system" ? getSystemTheme() : preference;
  document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  document.documentElement.style.colorScheme = effectiveTheme;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

function getSessionModelProviders(session: StoredAuthSession): StoredModelProvider[] {
  const normalizedProviders = normalizeModelProviders(session.modelProviders);
  if (normalizedProviders.length > 0) {
    return normalizedProviders;
  }
  const baseUrl = String(session.modelBaseUrl || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return [];
  }
  return [
    {
      id: "default",
      type: String(session.modelProvider || "newapi").trim() || "newapi",
      baseUrl,
      apiKeyConfigured: Boolean(session.modelApiKeyConfigured),
      selected: true,
    },
  ];
}

function createProviderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSessionFromProfileResponse(
  session: StoredAuthSession,
  data: Awaited<ReturnType<typeof updateUserProfile>>,
  fallbackProviders: StoredModelProvider[],
): StoredAuthSession {
  const modelProviders = normalizeModelProviders(data.user?.model_providers ?? data.model_providers ?? fallbackProviders);
  return {
    ...session,
    name: data.user?.name || data.name || session.name,
    watermarkLabel: data.user?.watermark_label ?? data.watermark_label ?? session.watermarkLabel ?? "",
    watermarkUnlocked: data.user?.watermark_unlocked ?? data.watermark_unlocked ?? session.watermarkUnlocked,
    modelProvider: data.user?.model_provider ?? data.model_provider ?? session.modelProvider ?? "",
    modelBaseUrl: data.user?.model_base_url ?? data.model_base_url ?? session.modelBaseUrl ?? "",
    modelApiKeyConfigured: data.user?.model_api_key_configured ?? data.model_api_key_configured ?? session.modelApiKeyConfigured ?? false,
    modelGatewayEnabled: data.user?.model_gateway_enabled ?? data.model_gateway_enabled ?? session.modelGatewayEnabled ?? false,
    newapiBindingStatus: data.user?.newapi_binding_status ?? data.newapi_binding_status ?? session.newapiBindingStatus,
    newapiBindingMessage: data.user?.newapi_binding_message ?? data.newapi_binding_message ?? session.newapiBindingMessage,
    newapiManagementUrl: data.user?.newapi_management_url ?? data.newapi_management_url ?? session.newapiManagementUrl,
    modelProviders,
    preferences: normalizeUserPreferences(data.user?.preferences ?? data.preferences ?? session.preferences),
  };
}

function toPreferencePayload(preferences: StoredUserPreferences) {
  return {
    theme: preferences.theme,
    language: preferences.language,
    image_ratio: preferences.imageRatio,
    image_tier: preferences.imageTier,
    image_quality: preferences.imageQuality,
    image_model: preferences.imageModel,
    sidebar_collapsed: preferences.sidebarCollapsed,
    sidebar_width: preferences.sidebarWidth,
  };
}

export function AccountMenu({
  session,
  onLogout,
  compactOnMobile = false,
  iconOnly = false,
  watermarkLabel,
  onSaveWatermarkLabel,
  onSessionUpdate,
  usageStats,
}: {
  session: StoredAuthSession;
  onLogout: () => void | Promise<void>;
  compactOnMobile?: boolean;
  iconOnly?: boolean;
  watermarkLabel?: string;
  onSaveWatermarkLabel?: (value: string) => void | Promise<void>;
  onSessionUpdate?: (session: StoredAuthSession) => void;
  usageStats?: AccountUsageStats;
}) {
  const [draftWatermarkLabel, setDraftWatermarkLabel] = useState(watermarkLabel ?? session.watermarkLabel ?? "");
  const [draftModelProviders, setDraftModelProviders] = useState<StoredModelProvider[]>(() => getSessionModelProviders(session));
  const [providerView, setProviderView] = useState<"list" | "form">("list");
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [draftModelProvider, setDraftModelProvider] = useState("newapi");
  const [draftModelBaseUrl, setDraftModelBaseUrl] = useState("");
  const [draftModelApiKey, setDraftModelApiKey] = useState("");
  const [isSavingWatermarkLabel, setIsSavingWatermarkLabel] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const language = useLanguagePreference();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const effectiveLanguage = resolveLanguage(language);
  const copy = settingsCopy[effectiveLanguage];
  const displayName = session.name.trim() || copy.fallbackName;
  const triggerLabel = session.role === "admin" ? copy.trigger.admin : copy.trigger.mine;
  useEffect(() => {
    const accountTheme = session.preferences?.theme;
    const storedTheme = accountTheme || window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "system" || storedTheme === "light" || storedTheme === "dark") {
      setThemePreference(storedTheme);
      applyThemePreference(storedTheme);
    }
    if (session.preferences?.language) {
      saveLanguagePreference(session.preferences.language);
    }
  }, [session.preferences?.language, session.preferences?.theme]);

  useEffect(() => {
    if (themePreference !== "system") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemePreference("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themePreference]);

  useEffect(() => {
    setDraftWatermarkLabel(watermarkLabel ?? session.watermarkLabel ?? "");
  }, [session.watermarkLabel, watermarkLabel]);

  useEffect(() => {
    const nextProviders = getSessionModelProviders(session);
    setDraftModelProviders(nextProviders);
    if (providerView === "list") {
      const selectedProvider = nextProviders.find((provider) => provider.selected) ?? nextProviders[0];
      setDraftModelProvider(selectedProvider?.type || "newapi");
      setDraftModelBaseUrl(selectedProvider?.baseUrl || "");
    }
    setDraftModelApiKey("");
  }, [providerView, session.modelBaseUrl, session.modelProvider, session.modelProviders]);

  const handleSaveWatermarkLabel = async () => {
    if (!onSaveWatermarkLabel) {
      return;
    }
    const nextLabel = draftWatermarkLabel.trim();
    setIsSavingWatermarkLabel(true);
    try {
      await onSaveWatermarkLabel(nextLabel);
      toast.success(copy.watermark.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.watermark.failed);
    } finally {
      setIsSavingWatermarkLabel(false);
    }
  };

  const toProviderPayload = (providers: StoredModelProvider[], apiKeyById: Record<string, string> = {}) =>
    providers.map((provider) => ({
      id: provider.id,
      type: provider.type,
      base_url: provider.baseUrl,
      api_key_configured: Boolean(provider.apiKeyConfigured),
      selected: Boolean(provider.selected),
      ...(apiKeyById[provider.id]?.trim() ? { api_key: apiKeyById[provider.id].trim() } : {}),
    }));

  const openProviderForm = (provider?: StoredModelProvider) => {
    setEditingProviderId(provider?.id ?? null);
    setDraftModelProvider(provider?.type || "newapi");
    setDraftModelBaseUrl(provider?.baseUrl || "");
    setDraftModelApiKey("");
    setProviderView("form");
  };

  const syncProviderSession = async (providers: StoredModelProvider[], apiKeyById: Record<string, string> = {}) => {
    const data = await updateUserProfile({
      model_providers: toProviderPayload(providers, apiKeyById),
    });
    const nextSession = buildSessionFromProfileResponse(session, data, providers);
    await setStoredAuthSession(nextSession);
    onSessionUpdate?.(nextSession);
    const nextProviders = getSessionModelProviders(nextSession);
    setDraftModelProviders(nextProviders);
    return nextSession;
  };

  const handleSaveProvider = async () => {
    const nextProvider = draftModelProvider.trim() || "newapi";
    const nextBaseUrl = draftModelBaseUrl.trim().replace(/\/+$/, "");
    if (!nextBaseUrl) {
      toast.error(`${copy.provider.baseUrl} 不能为空`);
      return;
    }
    if (!nextBaseUrl.startsWith("http://") && !nextBaseUrl.startsWith("https://")) {
      toast.error(`${copy.provider.baseUrl} 必须以 http:// 或 https:// 开头`);
      return;
    }
    const providerId = editingProviderId || createProviderId();
    const existingProvider = draftModelProviders.find((provider) => provider.id === providerId);
    const nextProviders = [
      ...draftModelProviders.filter((provider) => provider.id !== providerId).map((provider) => ({
        ...provider,
        selected: false,
      })),
      {
        id: providerId,
        type: nextProvider,
        baseUrl: nextBaseUrl,
        apiKeyConfigured: Boolean(draftModelApiKey.trim() || existingProvider?.apiKeyConfigured),
        selected: true,
      },
    ];
    setIsSavingProvider(true);
    try {
      await syncProviderSession(nextProviders, draftModelApiKey.trim() ? { [providerId]: draftModelApiKey.trim() } : {});
      setProviderView("list");
      setEditingProviderId(null);
      setDraftModelApiKey("");
      toast.success(copy.provider.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.provider.failed);
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    const nextProviders = draftModelProviders.map((provider) => ({
      ...provider,
      selected: provider.id === providerId,
    }));
    setIsSavingProvider(true);
    try {
      await syncProviderSession(nextProviders);
      toast.success(copy.provider.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.provider.failed);
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}${effectiveLanguage === "zh-CN" ? copy.contact.copied : ` ${copy.contact.copied}`}`);
    } catch {
      toast.error(copy.contact.copyFailed);
    }
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    saveLanguagePreference(value);
    const nextPreferences = { ...(session.preferences ?? {}), language: value };
    void updateUserProfile({ preferences: toPreferencePayload(nextPreferences) })
      .then(async (data) => {
        const nextSession = buildSessionFromProfileResponse(session, data, getSessionModelProviders(session));
        await setStoredAuthSession(nextSession);
        onSessionUpdate?.(nextSession);
      })
      .catch(() => undefined);
    toast.success(settingsCopy[resolveLanguage(value)].appearance.languageSaved);
  };

  const handleThemeChange = (value: ThemePreference) => {
    setThemePreference(value);
    applyThemePreference(value);
    const nextPreferences = { ...(session.preferences ?? {}), theme: value };
    void updateUserProfile({ preferences: toPreferencePayload(nextPreferences) })
      .then(async (data) => {
        const nextSession = buildSessionFromProfileResponse(session, data, getSessionModelProviders(session));
        await setStoredAuthSession(nextSession);
        onSessionUpdate?.(nextSession);
      })
      .catch(() => undefined);
    toast.success(copy.appearance.themeSaved);
  };

  const settingRowClass = "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm";
  const sectionTitleClass = "px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500";
  const sections = [
    { id: "account", label: copy.nav.account, icon: UserRound },
    { id: "appearance", label: copy.nav.appearance, icon: Palette },
    ...(session.role === "user" ? [{ id: "provider" as const, label: copy.nav.provider, icon: ServerCog }] : []),
    ...(session.role === "user" ? [{ id: "newapi" as const, label: copy.nav.newapi, icon: KeyRound }] : []),
    ...(onSaveWatermarkLabel ? [{ id: "watermark" as const, label: copy.nav.watermark, icon: Stamp }] : []),
    { id: "contact", label: copy.nav.contact, icon: MessageCircle },
    { id: "about", label: copy.nav.about, icon: Info },
  ] satisfies Array<{ id: SettingsSection; label: string; icon: typeof UserRound }>;

  const renderPanel = () => {
    if (activeSection === "account") {
      const statItems = usageStats
        ? [
            { label: copy.account.conversations, value: usageStats.conversationCount, icon: MessageCircle },
            { label: copy.account.turns, value: usageStats.turnCount, icon: BarChart3 },
            { label: copy.account.images, value: usageStats.generatedImageCount, icon: ImageIcon },
            { label: copy.account.activeTasks, value: usageStats.activeTaskCount, icon: Activity },
            { label: copy.account.liked, value: usageStats.likedImageCount, icon: Heart },
            { label: copy.account.disliked, value: usageStats.dislikedImageCount, icon: ThumbsDown },
          ]
        : [];
      return (
        <section>
          <div className={sectionTitleClass}>{copy.nav.account}</div>
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-50">{displayName}</div>
                <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{copy.account.current}</div>
              </div>
            </div>
          </div>
          {usageStats ? (
            <div className="mt-3">
              <div className={sectionTitleClass}>{copy.account.localStats}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-stone-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span>{item.label}</span>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-stone-950 dark:text-stone-50">{item.value}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                <span className="text-stone-500 dark:text-stone-400">{copy.account.lastActivity}</span>
                <span className="font-medium text-stone-800 dark:text-stone-200">{usageStats.lastActivityLabel || copy.account.noActivity}</span>
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    if (activeSection === "appearance") {
      return (
        <section>
          <div className={sectionTitleClass}>{copy.nav.appearance}</div>
          <div className="grid gap-2">
            <div className={settingRowClass}>
              <span className="text-stone-700 dark:text-stone-300">{copy.appearance.theme}</span>
              <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-white/10">
                {([
                  ["system", copy.appearance.system, Monitor],
                  ["light", copy.appearance.light, Sun],
                  ["dark", copy.appearance.dark, Moon],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 font-medium transition",
                      themePreference === value
                        ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                        : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={settingRowClass}>
              <span className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                <Globe2 className="size-4 text-stone-400" />
                {copy.appearance.language}
              </span>
              <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-white/10">
                {([
                  ["system", copy.appearance.system],
                  ["zh-CN", copy.appearance.chinese],
                  ["en-US", copy.appearance.english],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleLanguageChange(value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 font-medium transition",
                      language === value
                        ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                        : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
                    )}
                  >
                    {language === value ? <Check className="size-3" /> : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (activeSection === "provider") {
      if (providerView === "form") {
        const editingProvider = editingProviderId ? draftModelProviders.find((provider) => provider.id === editingProviderId) : null;
        return (
          <section>
            <div className="flex items-center justify-between gap-3 px-3 pb-2">
              <button
                type="button"
                onClick={() => {
                  setProviderView("list");
                  setEditingProviderId(null);
                  setDraftModelApiKey("");
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
              >
                <ArrowLeft className="size-3.5" />
                {copy.provider.back}
              </button>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{copy.provider.type}</label>
                  <input
                    value={draftModelProvider}
                    onChange={(event) => setDraftModelProvider(event.target.value.slice(0, 32))}
                    placeholder="newapi"
                    className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{copy.provider.baseUrl}</label>
                  <input
                    value={draftModelBaseUrl}
                    onChange={(event) => setDraftModelBaseUrl(event.target.value)}
                    placeholder="https://new-api.example.com/v1"
                    className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{copy.provider.apiKey}</label>
                    <span className="text-[11px] text-stone-400">
                      {editingProvider?.apiKeyConfigured ? copy.provider.configured : copy.provider.notConfigured}
                    </span>
                  </div>
                  <input
                    value={draftModelApiKey}
                    onChange={(event) => setDraftModelApiKey(event.target.value)}
                    type="password"
                    placeholder={copy.provider.apiKeyPlaceholder}
                    className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 font-mono text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveProvider()}
                  disabled={isSavingProvider}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {isSavingProvider ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {copy.provider.save}
                </button>
              </div>
            </div>
          </section>
        );
      }

      return (
        <section>
          <div className={sectionTitleClass}>{copy.provider.title}</div>
          <div className="grid gap-2">
            {draftModelProviders.length > 0 ? (
              draftModelProviders.map((provider) => (
                <div
                  key={provider.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-white p-3 transition dark:bg-white/[0.03]",
                    provider.selected
                      ? "border-stone-300 shadow-sm dark:border-white/20"
                      : "border-stone-200/80 dark:border-white/10",
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300">
                    <ServerCog className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{provider.type}</span>
                      {provider.selected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-stone-100 dark:text-stone-950">
                          <Check className="size-3" />
                          {copy.provider.active}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">{provider.baseUrl}</div>
                    <div className="mt-1 text-[11px] text-stone-400">
                      {provider.apiKeyConfigured ? copy.provider.configured : copy.provider.notConfigured}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openProviderForm(provider)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label={copy.provider.edit}
                      title={copy.provider.edit}
                    >
                      <Pencil className="size-4" />
                    </button>
                    {!provider.selected ? (
                      <button
                        type="button"
                        onClick={() => void handleSelectProvider(provider.id)}
                        disabled={isSavingProvider}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
                      >
                        {isSavingProvider ? <LoaderCircle className="size-3.5 animate-spin" /> : copy.provider.use}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-200/90 bg-stone-50/70 px-4 py-6 text-center text-sm text-stone-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-400">
                {copy.provider.empty}
              </div>
            )}
              <button
                type="button"
              onClick={() => openProviderForm()}
                disabled={isSavingProvider}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-100 dark:hover:bg-white/10"
              >
              <Plus className="size-4" />
              {copy.provider.add}
              </button>
          </div>
        </section>
      );
    }

    if (activeSection === "newapi") {
      const status = session.newapiBindingStatus || "pending";
      const statusLabel =
        status === "configured" ? copy.newapi.configured : status === "failed" ? copy.newapi.failed : copy.newapi.pending;
      return (
        <section>
          <div className={sectionTitleClass}>{copy.newapi.title}</div>
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-stone-500 dark:text-stone-400">{copy.newapi.status}</span>
              <span className="font-medium text-stone-900 dark:text-stone-100">{statusLabel}</span>
            </div>
            {session.newapiBindingMessage ? (
              <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{session.newapiBindingMessage}</p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.newapi.hint}</p>
            <a
              href="/settings/newapi"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <KeyRound className="size-4" />
              {copy.newapi.open}
            </a>
          </div>
        </section>
      );
    }

    if (activeSection === "watermark" && onSaveWatermarkLabel) {
      return (
        <section>
          <div className={sectionTitleClass}>{copy.nav.watermark}</div>
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-200">
              <Stamp className="size-4 text-stone-400" />
              {copy.watermark.label}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={draftWatermarkLabel}
                onChange={(event) => setDraftWatermarkLabel(event.target.value.slice(0, 64))}
                placeholder={copy.watermark.placeholder}
                className="h-9 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={() => void handleSaveWatermarkLabel()}
                disabled={isSavingWatermarkLabel}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {isSavingWatermarkLabel ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {copy.watermark.save}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.watermark.hint}</p>
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">{copy.watermark.previewTitle}</div>
              <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 dark:border-white/10 dark:bg-stone-900">
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-stone-800 dark:via-stone-900 dark:to-zinc-950">
                  <img src="/happy-token-logo.svg" alt={copy.watermark.previewAlt} className="size-20 rounded-2xl shadow-sm" />
                </div>
                <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
                  @Happy Token
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.watermark.previewCaption}</p>
            </div>
          </div>
        </section>
      );
    }

    if (activeSection === "contact") {
      return (
        <section>
          <div className={sectionTitleClass}>{copy.nav.contact}</div>
          <div className="grid gap-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Mail className="size-4 text-stone-400" />
              {copy.contact.email}
              <span className="ml-auto max-w-44 truncate text-xs text-stone-400">{SUPPORT_EMAIL}</span>
            </a>
            <button
              type="button"
              onClick={() => void handleCopy(SUPPORT_WECHAT, copy.contact.wechat)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Copy className="size-4 text-stone-400" />
              {copy.contact.wechat}
              <span className="ml-auto max-w-44 truncate text-xs text-stone-400">{SUPPORT_WECHAT}</span>
            </button>
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">{copy.contact.qr}</div>
              <img
                src={SUPPORT_WECHAT_QR}
                alt={copy.contact.qrAlt}
                className="mx-auto max-h-56 w-auto rounded-xl border border-stone-200 bg-white object-contain dark:border-white/10"
              />
            </div>
          </div>
        </section>
      );
    }

    return (
      <section>
        <div className={sectionTitleClass}>{copy.nav.about}</div>
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 text-sm text-stone-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-stone-400" />
            Happy Token
            <span className="ml-auto text-xs text-stone-400">v{webConfig.appVersion}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.about.description}</p>
        </div>
      </section>
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-stone-200/80 bg-white/80 px-2.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-white hover:text-stone-950 dark:border-white/10 dark:bg-white/8 dark:text-stone-200 dark:hover:bg-white/12 dark:hover:text-white sm:h-9 sm:px-3 sm:text-sm"
        aria-label={copy.trigger.aria}
      >
        <UserRound className="size-3.5 sm:size-4" />
        {iconOnly ? null : <span className={compactOnMobile ? "hidden md:inline" : undefined}>{triggerLabel}</span>}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[min(42rem,calc(100dvh-1.5rem))] w-[min(42rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-stone-200/80 bg-white/96 p-0 text-stone-950 shadow-[0_28px_80px_-36px_rgba(24,24,27,0.38)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/96 dark:text-stone-50"
      >
        <div className="border-b border-stone-100 px-4 py-3 dark:border-white/10">
          <div className="truncate text-sm font-semibold">{displayName}</div>
          <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{copy.header}</div>
        </div>

        <div className="grid min-h-[23rem] overflow-hidden grid-cols-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-stone-100 bg-stone-50/80 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:block sm:overflow-visible sm:border-b-0 sm:border-r">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition sm:w-full",
                    isActive
                      ? "bg-white text-stone-950 shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-stone-500 hover:bg-white/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/8 dark:hover:text-stone-100",
                  )}
                >
                  <Icon className="size-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 overflow-y-auto p-4">{renderPanel()}</div>
        </div>

        <div className="border-t border-stone-100 p-2 dark:border-white/10">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <LogOut className="size-4" />
            {copy.logout}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

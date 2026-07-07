"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Globe2,
  Heart,
  ImageIcon,
  Info,
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
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import webConfig from "@/constants/common-env";
import {
  fetchNewAPIManagement,
  testModelProvider,
  updateUserProfile,
  type NewAPIManagementResponse,
} from "@/lib/api";
import {
  SUPPORT_EMAIL,
  SUPPORT_WECHAT,
  SUPPORT_WECHAT_QR,
} from "@/lib/contact";
import {
  buildHappyTokenTopupUrl,
  HAPPYTOKEN_GATEWAY_URL,
} from "@/lib/happytoken";
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
type SettingsSection =
  | "account"
  | "appearance"
  | "provider"
  | "watermark"
  | "contact"
  | "about";

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
const HAPPYTOKEN_PROVIDER_ID = "newapi-default";
const HAPPYTOKEN_MANAGEMENT_URL = "/settings/newapi";
const HAPPYTOKEN_MODEL_BASE_URL = `${HAPPYTOKEN_GATEWAY_URL}/v1`;
const HAPPYTOKEN_IMAGE_GROUP = "image";
const HAPPYTOKEN_IMAGE_MODELS = ["gpt-image-2", "codex-gpt-image-2"];
const HAPPYTOKEN_MANAGEMENT_ORIGINS = new Set([HAPPYTOKEN_GATEWAY_URL]);
const OPENAI_PROTOCOL = "openai";
const PROVIDER_PRESETS = [
  {
    id: "openai",
    name: "OpenAI",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"],
  },
  {
    id: "volcengine",
    name: "火山方舟",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-seedream-3-0-t2i-250415", "seedream-4-0-250828"],
  },
  {
    id: "byteplus",
    name: "BytePlus ModelArk",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    models: ["seedream-5-0-lite", "seedream-4-5", "seedream-4-0"],
  },
  {
    id: "gemini",
    name: "Gemini / Nano Banana",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-2.5-flash-image",
    ],
  },
  {
    id: "alibaba",
    name: "阿里云百炼",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      "qwen-image-2.0-pro",
      "qwen-image-2.0",
      "qwen-image-max",
      "wan2.7-image",
    ],
  },
  {
    id: "custom",
    name: "自定义供应商",
    protocol: OPENAI_PROTOCOL,
    baseUrl: "",
    models: ["gpt-image-2"],
  },
] as const;
const GEMINI_IMAGE_MODEL_LABELS: Record<string, string> = {
  "gemini-3.1-flash-image": "gemini-3.1-flash-image（Nano Banana 2）",
  "gemini-3-pro-image": "gemini-3-pro-image（Nano Banana Pro）",
  "gemini-2.5-flash-image": "gemini-2.5-flash-image（Nano Banana）",
};

function formatImageModelLabel(model: string) {
  return GEMINI_IMAGE_MODEL_LABELS[model] || model;
}

const CNY_RATE = 7.2;
const QUOTA_PER_USD = 500_000;

function formatNumber(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCny(usd?: number) {
  if (!usd) return "-";
  const cny = usd * CNY_RATE;
  if (cny < 0.01) return `¥${(cny * 100).toFixed(4)} 分`;
  return `¥${cny.toFixed(4)}`;
}

function formatQuotaAsCny(quota?: number) {
  if (quota == null || quota === 0) return "¥0";
  const usd = quota / QUOTA_PER_USD;
  const cny = usd * CNY_RATE;
  if (cny < 0.01) return `<¥0.01`;
  return `¥${cny.toFixed(2)}`;
}

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
    },
    account: {
      current: "当前登录账户",
      localStats: "本机历史统计",
      newapiStats: "HappyToken 额度",
      topUp: "充值",
      topUpTitle: "打开 HappyToken 充值",
      quota: "总余额",
      usedQuota: "已消费",
      remainingQuota: "剩余",
      requestCount: "请求数",
      modelUsage: "生图用量（参考汇率 1 USD = 7.2 CNY）",
      modelColRequests: "次数",
      modelColCost: "费用",
      noModelUsage: "暂无生图记录",
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
      type: "供应商名称",
      preset: "供应商",
      baseUrl: "Base URL",
      models: "可用模型",
      modelsPlaceholder: "每行一个模型 ID",
      apiKey: "API Key",
      apiKeyPlaceholder: "留空则保持现有 API Key",
      configured: "已保存 API Key",
      notConfigured: "尚未保存 API Key",
      save: "保存供应商",
      add: "添加供应商",
      choose: "选择供应商",
      configure: "配置供应商",
      delete: "删除",
      deleteConfirm: "确定删除这个供应商吗？",
      edit: "编辑",
      use: "使用",
      active: "使用中",
      default: "默认",
      back: "返回列表",
      backToProviders: "返回供应商",
      empty: "还没有供应商",
      saved: "供应商配置已保存",
      deleted: "供应商已删除",
      failed: "保存供应商配置失败",
      test: "测试连接",
      testing: "测试中",
      testSuccess: "连接测试通过",
      testFailed: "连接测试失败",
      apiKeyRequired: "请填写 API Key 后测试连接",
      happyToken: "HappyToken",
      happyTokenManagement: "HappyToken",
      manageHappyToken: "管理",
      openHappyToken: "打开 HappyToken 管理",
      status: "绑定状态",
      bindingConfigured: "已自动绑定",
      pending: "等待绑定",
      bindingFailed: "绑定失败",
      hint: "配置后，当前账户发起的图片生成会优先使用这个 OpenAI 兼容网关。",
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
    docs: "使用文档",
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
    },
    account: {
      current: "Current signed-in account",
      localStats: "Local history stats",
      newapiStats: "HappyToken balance",
      topUp: "Top up",
      topUpTitle: "Open HappyToken top-up",
      quota: "Balance",
      usedQuota: "Spent",
      remainingQuota: "Remaining",
      requestCount: "Requests",
      modelUsage: "Image usage (ref rate: 1 USD = 7.2 CNY)",
      modelColRequests: "Runs",
      modelColCost: "Cost",
      noModelUsage: "No image generation yet",
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
      type: "Provider name",
      preset: "Provider",
      baseUrl: "Base URL",
      models: "Available models",
      modelsPlaceholder: "One model ID per line",
      apiKey: "API Key",
      apiKeyPlaceholder: "Leave blank to keep the current API key",
      configured: "API key saved",
      notConfigured: "No API key saved",
      save: "Save provider",
      add: "Add provider",
      choose: "Choose provider",
      configure: "Configure provider",
      delete: "Delete",
      deleteConfirm: "Delete this provider?",
      edit: "Edit",
      use: "Use",
      active: "Active",
      default: "Default",
      back: "Back",
      backToProviders: "Back to providers",
      empty: "No providers yet",
      saved: "Provider settings saved",
      deleted: "Provider deleted",
      failed: "Failed to save provider settings",
      test: "Test connection",
      testing: "Testing",
      testSuccess: "Connection test passed",
      testFailed: "Connection test failed",
      apiKeyRequired: "Enter an API key before testing",
      happyToken: "HappyToken",
      happyTokenManagement: "HappyToken",
      manageHappyToken: "Manage",
      openHappyToken: "Open HappyToken management",
      status: "Binding status",
      bindingConfigured: "Configured",
      pending: "Pending",
      bindingFailed: "Failed",
      hint: "When configured, image generation from this account uses this OpenAI-compatible gateway first.",
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
      previewCaption:
        "The watermark usually appears in the lower-right corner.",
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
    docs: "Docs",
    logout: "Sign out",
    fallbackName: "My account",
  },
} satisfies Record<EffectiveLanguage, unknown>;

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemePreference(preference: ThemePreference) {
  const effectiveTheme =
    preference === "system" ? getSystemTheme() : preference;
  document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  document.documentElement.style.colorScheme = effectiveTheme;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

function normalizeManagementUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return HAPPYTOKEN_MANAGEMENT_URL;
  }
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      !HAPPYTOKEN_MANAGEMENT_ORIGINS.has(parsed.origin)
    ) {
      return HAPPYTOKEN_MANAGEMENT_URL;
    }
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return HAPPYTOKEN_MANAGEMENT_URL;
  }
}

function isHappyTokenProvider(provider: StoredModelProvider) {
  const type = provider.type.toLowerCase();
  return (
    provider.id === HAPPYTOKEN_PROVIDER_ID ||
    type === "happytoken" ||
    (type === "newapi" &&
      provider.baseUrl.toLowerCase().includes("gateway.happy-token.cn"))
  );
}

function ensureSelectedProvider(providers: StoredModelProvider[]) {
  const selectedProvider =
    providers.find((provider) => provider.selected) ??
    providers.find((provider) => isHappyTokenProvider(provider)) ??
    providers[0];
  return providers.map((provider) => ({
    ...provider,
    selected: provider.id === selectedProvider?.id,
  }));
}

function createHappyTokenProvider(
  session: StoredAuthSession,
  providers: StoredModelProvider[]
): StoredModelProvider {
  const existingProvider = providers.find((provider) =>
    isHappyTokenProvider(provider)
  );
  const selectedCustomProvider = providers.find(
    (provider) => !isHappyTokenProvider(provider) && provider.selected
  );
  const sessionBaseUrl = String(session.modelBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const baseUrl = String(existingProvider?.baseUrl || sessionBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  return {
    id: HAPPYTOKEN_PROVIDER_ID,
    type: "happytoken",
    protocol: OPENAI_PROTOCOL,
    baseUrl: baseUrl || HAPPYTOKEN_MODEL_BASE_URL,
    group: existingProvider?.group || HAPPYTOKEN_IMAGE_GROUP,
    models: existingProvider?.models?.length
      ? existingProvider.models
      : HAPPYTOKEN_IMAGE_MODELS,
    apiKeyConfigured: Boolean(
      existingProvider?.apiKeyConfigured ||
        session.newapiBindingStatus === "configured" ||
        session.modelApiKeyConfigured
    ),
    selected: existingProvider?.selected || !selectedCustomProvider,
  };
}

function getSessionModelProviders(
  session: StoredAuthSession
): StoredModelProvider[] {
  const normalizedProviders = normalizeModelProviders(session.modelProviders);
  const happyTokenProvider = createHappyTokenProvider(
    session,
    normalizedProviders
  );
  const customProviders = normalizedProviders.filter(
    (provider) => !isHappyTokenProvider(provider)
  );
  if (customProviders.length > 0 || happyTokenProvider.baseUrl) {
    return ensureSelectedProvider([happyTokenProvider, ...customProviders]);
  }
  const baseUrl = String(session.modelBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (!baseUrl) {
    return [];
  }
  return ensureSelectedProvider([
    {
      id: "default",
      type:
        String(session.modelProvider || "happytoken").trim() || "happytoken",
      baseUrl,
      protocol: OPENAI_PROTOCOL,
      group: HAPPYTOKEN_IMAGE_GROUP,
      models: HAPPYTOKEN_IMAGE_MODELS,
      apiKeyConfigured: Boolean(session.modelApiKeyConfigured),
      selected: true,
    },
  ]);
}

function createProviderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `provider-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function buildSessionFromProfileResponse(
  session: StoredAuthSession,
  data: Awaited<ReturnType<typeof updateUserProfile>>,
  fallbackProviders: StoredModelProvider[]
): StoredAuthSession {
  const modelProviders = normalizeModelProviders(
    data.user?.model_providers ?? data.model_providers ?? fallbackProviders
  );
  return {
    ...session,
    name: data.user?.name || data.name || session.name,
    watermarkLabel:
      data.user?.watermark_label ??
      data.watermark_label ??
      session.watermarkLabel ??
      "",
    watermarkUnlocked:
      data.user?.watermark_unlocked ??
      data.watermark_unlocked ??
      session.watermarkUnlocked,
    modelProvider:
      data.user?.model_provider ??
      data.model_provider ??
      session.modelProvider ??
      "",
    modelBaseUrl:
      data.user?.model_base_url ??
      data.model_base_url ??
      session.modelBaseUrl ??
      "",
    modelApiKeyConfigured:
      data.user?.model_api_key_configured ??
      data.model_api_key_configured ??
      session.modelApiKeyConfigured ??
      false,
    modelGatewayEnabled:
      data.user?.model_gateway_enabled ??
      data.model_gateway_enabled ??
      session.modelGatewayEnabled ??
      false,
    newapiBindingStatus:
      data.user?.newapi_binding_status ??
      data.newapi_binding_status ??
      session.newapiBindingStatus,
    newapiBindingMessage:
      (data.user?.newapi_binding_status ?? data.newapi_binding_status) ===
      "configured"
        ? undefined
        : data.user?.newapi_binding_message ??
          data.newapi_binding_message ??
          session.newapiBindingMessage,
    newapiManagementUrl:
      data.user?.newapi_management_url ??
      data.newapi_management_url ??
      session.newapiManagementUrl,
    modelProviders,
    preferences: normalizeUserPreferences(
      data.user?.preferences ?? data.preferences ?? session.preferences
    ),
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
  const pathname = usePathname();
  const [draftWatermarkLabel, setDraftWatermarkLabel] = useState(
    watermarkLabel ?? session.watermarkLabel ?? ""
  );
  const [draftModelProviders, setDraftModelProviders] = useState<
    StoredModelProvider[]
  >(() => getSessionModelProviders(session));
  const [providerView, setProviderView] = useState<"list" | "picker" | "form">(
    "list"
  );
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null
  );
  const [draftProviderPreset, setDraftProviderPreset] = useState("openai");
  const [draftModelProvider, setDraftModelProvider] = useState("happytoken");
  const [draftProviderProtocol, setDraftProviderProtocol] =
    useState(OPENAI_PROTOCOL);
  const [draftModelBaseUrl, setDraftModelBaseUrl] = useState("");
  const [draftProviderModels, setDraftProviderModels] = useState("");
  const [draftModelApiKey, setDraftModelApiKey] = useState("");
  const [isSavingWatermarkLabel, setIsSavingWatermarkLabel] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [newapiManagement, setNewapiManagement] =
    useState<NewAPIManagementResponse | null>(null);
  const [isLoadingNewapiManagement, setIsLoadingNewapiManagement] =
    useState(false);
  const language = useLanguagePreference();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("account");
  const effectiveLanguage = resolveLanguage(language);
  const copy = settingsCopy[effectiveLanguage];
  const displayName = session.name.trim() || copy.fallbackName;
  const triggerLabel =
    session.role === "admin" ? copy.trigger.admin : copy.trigger.mine;
  const showDocsLink = pathname !== "/docs";
  const happyTokenManagementUrl = HAPPYTOKEN_MANAGEMENT_URL;
  const happyTokenTopupUrl = buildHappyTokenTopupUrl(
    newapiManagement?.management_url || session.newapiManagementUrl
  );
  useEffect(() => {
    const accountTheme = session.preferences?.theme;
    const storedTheme =
      accountTheme || window.localStorage.getItem(THEME_STORAGE_KEY);
    if (
      storedTheme === "system" ||
      storedTheme === "light" ||
      storedTheme === "dark"
    ) {
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
    if (session.role !== "user") {
      setNewapiManagement(null);
      return;
    }
    let cancelled = false;
    setIsLoadingNewapiManagement(true);
    fetchNewAPIManagement()
      .then((data) => {
        if (!cancelled) {
          setNewapiManagement(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewapiManagement(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingNewapiManagement(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session.role, session.subjectId, session.newapiBindingStatus]);

  useEffect(() => {
    const nextProviders = getSessionModelProviders(session);
    setDraftModelProviders(nextProviders);
    if (providerView === "list") {
      const selectedProvider =
        nextProviders.find((provider) => provider.selected) ?? nextProviders[0];
      setDraftModelProvider(selectedProvider?.type || "happytoken");
      setDraftProviderProtocol(selectedProvider?.protocol || OPENAI_PROTOCOL);
      setDraftModelBaseUrl(selectedProvider?.baseUrl || "");
      setDraftProviderModels((selectedProvider?.models || []).join("\n"));
    }
    setDraftModelApiKey("");
  }, [
    providerView,
    session.modelBaseUrl,
    session.modelProvider,
    session.modelProviders,
  ]);

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
      toast.error(
        error instanceof Error ? error.message : copy.watermark.failed
      );
    } finally {
      setIsSavingWatermarkLabel(false);
    }
  };

  const toProviderPayload = (
    providers: StoredModelProvider[],
    apiKeyById: Record<string, string> = {}
  ) =>
    providers.map((provider) => ({
      id: provider.id,
      type: provider.type,
      protocol: provider.protocol || OPENAI_PROTOCOL,
      base_url: provider.baseUrl,
      group: provider.group || "",
      models: provider.models || [],
      api_key_configured: Boolean(provider.apiKeyConfigured),
      selected: Boolean(provider.selected),
      ...(apiKeyById[provider.id]?.trim()
        ? { api_key: apiKeyById[provider.id].trim() }
        : {}),
    }));

  const openProviderPicker = () => {
    setEditingProviderId(null);
    setDraftProviderPreset("");
    setDraftModelApiKey("");
    setProviderView("picker");
  };

  const openProviderForm = (provider?: StoredModelProvider) => {
    const matchingPreset = PROVIDER_PRESETS.find(
      (preset) =>
        preset.id !== "custom" &&
        preset.name.toLowerCase() === String(provider?.type || "").toLowerCase()
    );
    const defaultPreset = PROVIDER_PRESETS[0];
    setEditingProviderId(provider?.id ?? null);
    setDraftProviderPreset(
      provider ? matchingPreset?.id || "custom" : defaultPreset.id
    );
    setDraftModelProvider(provider?.type || defaultPreset.name);
    setDraftProviderProtocol(provider?.protocol || defaultPreset.protocol);
    setDraftModelBaseUrl(provider?.baseUrl || defaultPreset.baseUrl);
    setDraftProviderModels(
      (provider?.models?.length ? provider.models : defaultPreset.models).join(
        "\n"
      )
    );
    setDraftModelApiKey("");
    setProviderView("form");
  };

  const handleProviderPresetChange = (presetId: string) => {
    const preset =
      PROVIDER_PRESETS.find((item) => item.id === presetId) ||
      PROVIDER_PRESETS[0];
    setDraftProviderPreset(preset.id);
    if (preset.id === "custom") {
      setDraftModelProvider("");
      setDraftProviderProtocol(OPENAI_PROTOCOL);
      setDraftModelBaseUrl("");
      setDraftProviderModels(preset.models.join("\n"));
      return;
    }
    setDraftModelProvider(preset.name);
    setDraftProviderProtocol(preset.protocol);
    setDraftModelBaseUrl(preset.baseUrl);
    setDraftProviderModels(preset.models.join("\n"));
  };

  const handleChooseProviderPreset = (presetId: string) => {
    setEditingProviderId(null);
    handleProviderPresetChange(presetId);
    setDraftModelApiKey("");
    setProviderView("form");
  };

  const syncProviderSession = async (
    providers: StoredModelProvider[],
    apiKeyById: Record<string, string> = {}
  ) => {
    const data = await updateUserProfile({
      model_providers: toProviderPayload(providers, apiKeyById),
    });
    const nextSession = buildSessionFromProfileResponse(
      session,
      data,
      providers
    );
    await setStoredAuthSession(nextSession);
    onSessionUpdate?.(nextSession);
    const nextProviders = getSessionModelProviders(nextSession);
    setDraftModelProviders(nextProviders);
    return nextSession;
  };

  const handleSaveProvider = async () => {
    const nextProvider = draftModelProvider.trim() || "custom";
    const nextProtocol = draftProviderProtocol.trim() || OPENAI_PROTOCOL;
    const nextBaseUrl = draftModelBaseUrl.trim().replace(/\/+$/, "");
    const nextModels = draftProviderModels
      .split(/\r?\n|,/)
      .map((model) => model.trim())
      .filter((model, index, list) => model && list.indexOf(model) === index);
    if (!nextBaseUrl) {
      toast.error(`${copy.provider.baseUrl} 不能为空`);
      return;
    }
    if (
      !nextBaseUrl.startsWith("http://") &&
      !nextBaseUrl.startsWith("https://")
    ) {
      toast.error(`${copy.provider.baseUrl} 必须以 http:// 或 https:// 开头`);
      return;
    }
    const providerId = editingProviderId || createProviderId();
    const existingProvider = draftModelProviders.find(
      (provider) => provider.id === providerId
    );
    const existingSelectedProvider =
      draftModelProviders.find(
        (provider) => provider.selected && provider.id !== providerId
      ) ?? existingProvider;
    const nextProviders = ensureSelectedProvider([
      ...draftModelProviders.filter((provider) => provider.id !== providerId),
      {
        id: providerId,
        type: nextProvider,
        protocol: nextProtocol,
        baseUrl: nextBaseUrl,
        models: nextModels,
        apiKeyConfigured: Boolean(
          draftModelApiKey.trim() || existingProvider?.apiKeyConfigured
        ),
        selected: editingProviderId
          ? Boolean(existingProvider?.selected)
          : providerId === existingSelectedProvider?.id,
      },
    ]);
    setIsSavingProvider(true);
    try {
      await syncProviderSession(
        nextProviders,
        draftModelApiKey.trim() ? { [providerId]: draftModelApiKey.trim() } : {}
      );
      setProviderView("list");
      setEditingProviderId(null);
      setDraftModelApiKey("");
      toast.success(copy.provider.saved);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.provider.failed
      );
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleTestProvider = async () => {
    const nextProvider = draftModelProvider.trim() || "custom";
    const nextBaseUrl = draftModelBaseUrl.trim().replace(/\/+$/, "");
    const nextModels = draftProviderModels
      .split(/\r?\n|,/)
      .map((model) => model.trim())
      .filter((model, index, list) => model && list.indexOf(model) === index);
    if (!nextBaseUrl) {
      toast.error(`${copy.provider.baseUrl} 不能为空`);
      return;
    }
    if (!draftModelApiKey.trim()) {
      toast.error(copy.provider.apiKeyRequired);
      return;
    }
    setIsTestingProvider(true);
    try {
      const result = await testModelProvider({
        type: nextProvider,
        protocol: OPENAI_PROTOCOL,
        base_url: nextBaseUrl,
        models: nextModels,
        api_key: draftModelApiKey.trim(),
      });
      if (Array.isArray(result.models) && result.models.length > 0) {
        setDraftProviderModels(result.models.join("\n"));
      }
      toast.success(copy.provider.testSuccess);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.provider.testFailed
      );
    } finally {
      setIsTestingProvider(false);
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
      toast.error(
        error instanceof Error ? error.message : copy.provider.failed
      );
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    const deletingProvider = draftModelProviders.find(
      (provider) => provider.id === providerId
    );
    if (!deletingProvider || isHappyTokenProvider(deletingProvider)) {
      return;
    }
    if (!window.confirm(copy.provider.deleteConfirm)) {
      return;
    }
    const remainingProviders = draftModelProviders.filter(
      (provider) => provider.id !== providerId
    );
    const selectedProvider =
      remainingProviders.find((provider) => provider.selected) ??
      remainingProviders.find((provider) => isHappyTokenProvider(provider)) ??
      remainingProviders[0];
    const nextProviders = remainingProviders.map((provider) => ({
      ...provider,
      selected: provider.id === selectedProvider?.id,
    }));
    setIsSavingProvider(true);
    try {
      await syncProviderSession(nextProviders);
      toast.success(copy.provider.deleted);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.provider.failed
      );
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(
        `${label}${
          effectiveLanguage === "zh-CN"
            ? copy.contact.copied
            : ` ${copy.contact.copied}`
        }`
      );
    } catch {
      toast.error(copy.contact.copyFailed);
    }
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    saveLanguagePreference(value);
    const nextPreferences = { ...(session.preferences ?? {}), language: value };
    void updateUserProfile({
      preferences: toPreferencePayload(nextPreferences),
    })
      .then(async (data) => {
        const nextSession = buildSessionFromProfileResponse(
          session,
          data,
          getSessionModelProviders(session)
        );
        await setStoredAuthSession(nextSession);
        onSessionUpdate?.(nextSession);
      })
      .catch(() => undefined);
    toast.success(
      settingsCopy[resolveLanguage(value)].appearance.languageSaved
    );
  };

  const handleThemeChange = (value: ThemePreference) => {
    setThemePreference(value);
    applyThemePreference(value);
    const nextPreferences = { ...(session.preferences ?? {}), theme: value };
    void updateUserProfile({
      preferences: toPreferencePayload(nextPreferences),
    })
      .then(async (data) => {
        const nextSession = buildSessionFromProfileResponse(
          session,
          data,
          getSessionModelProviders(session)
        );
        await setStoredAuthSession(nextSession);
        onSessionUpdate?.(nextSession);
      })
      .catch(() => undefined);
    toast.success(copy.appearance.themeSaved);
  };

  const settingRowClass =
    "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm";
  const sectionTitleClass =
    "px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500";
  const sections = [
    { id: "account", label: copy.nav.account, icon: UserRound },
    { id: "appearance", label: copy.nav.appearance, icon: Palette },
    ...(session.role === "user"
      ? [{ id: "provider" as const, label: copy.nav.provider, icon: ServerCog }]
      : []),
    ...(onSaveWatermarkLabel
      ? [{ id: "watermark" as const, label: copy.nav.watermark, icon: Stamp }]
      : []),
    { id: "contact", label: copy.nav.contact, icon: MessageCircle },
    { id: "about", label: copy.nav.about, icon: Info },
  ] satisfies Array<{
    id: SettingsSection;
    label: string;
    icon: typeof UserRound;
  }>;

  const renderPanel = () => {
    if (activeSection === "account") {
      const statItems = usageStats
        ? [
            {
              label: copy.account.conversations,
              value: usageStats.conversationCount,
              icon: MessageCircle,
            },
            {
              label: copy.account.turns,
              value: usageStats.turnCount,
              icon: BarChart3,
            },
            {
              label: copy.account.images,
              value: usageStats.generatedImageCount,
              icon: ImageIcon,
            },
            {
              label: copy.account.activeTasks,
              value: usageStats.activeTaskCount,
              icon: Activity,
            },
            {
              label: copy.account.liked,
              value: usageStats.likedImageCount,
              icon: Heart,
            },
            {
              label: copy.account.disliked,
              value: usageStats.dislikedImageCount,
              icon: ThumbsDown,
            },
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
                <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-50">
                  {displayName}
                </div>
                <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {copy.account.current}
                </div>
              </div>
            </div>
          </div>
          {session.role === "user" ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <div className={sectionTitleClass}>
                  {copy.account.newapiStats}
                </div>
                <a
                  href={happyTokenTopupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-stone-950 px-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
                  title={copy.account.topUpTitle}
                >
                  <CreditCard className="size-3.5" />
                  {copy.account.topUp}
                </a>
              </div>
              <div className="rounded-2xl border border-stone-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                {isLoadingNewapiManagement ? (
                  <div className="flex items-center justify-center py-6">
                    <LoaderCircle className="size-4 animate-spin text-stone-400" />
                  </div>
                ) : newapiManagement?.quota ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        {
                          label: copy.account.quota,
                          value: formatQuotaAsCny(newapiManagement.quota.quota),
                        },
                        {
                          label: copy.account.usedQuota,
                          value: formatQuotaAsCny(newapiManagement.quota.used_quota),
                        },
                        {
                          label: copy.account.remainingQuota,
                          value: formatQuotaAsCny(
                            newapiManagement.quota.remaining_quota
                          ),
                        },
                        {
                          label: copy.account.requestCount,
                          value: formatNumber(
                            newapiManagement.quota.request_count
                          ),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl bg-stone-50 px-3 py-2 dark:bg-white/5"
                        >
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {item.label}
                          </div>
                          <div className="mt-1 font-mono text-sm font-semibold text-stone-950 dark:text-stone-50">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] text-stone-400 dark:text-stone-500">
                      {copy.account.modelUsage}
                    </div>
                    <div className="mt-1.5 grid gap-1.5">
                      {newapiManagement.usage_by_model?.length ? (
                        <>
                          <div className="grid gap-2 px-3 text-[10px] text-stone-400 dark:text-stone-500 sm:grid-cols-[minmax(0,1fr)_4rem_6rem]">
                            <span>模型</span>
                            <span>{copy.account.modelColRequests}</span>
                            <span>{copy.account.modelColCost}</span>
                          </div>
                          {newapiManagement.usage_by_model.map((item) => (
                            <div
                              key={item.model}
                              className="grid gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs dark:bg-white/5 sm:grid-cols-[minmax(0,1fr)_4rem_6rem]"
                            >
                              <span className="truncate font-mono text-stone-800 dark:text-stone-200">
                                {item.model}
                              </span>
                              <span className="text-stone-600 dark:text-stone-300">
                                {formatNumber(item.requests)} 次
                              </span>
                              <span className="font-mono text-stone-900 dark:text-stone-100">
                                {formatCny(item.estimated_cost)}
                              </span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="rounded-xl bg-stone-50 px-3 py-3 text-center text-xs text-stone-500 dark:bg-white/5 dark:text-stone-400">
                          {copy.account.noModelUsage}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-xs text-stone-500 dark:text-stone-400">
                    {newapiManagement?.message || copy.account.noActivity}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {usageStats ? (
            <div className="mt-3">
              <div className={sectionTitleClass}>{copy.account.localStats}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-stone-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span>{item.label}</span>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-stone-950 dark:text-stone-50">
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                <span className="text-stone-500 dark:text-stone-400">
                  {copy.account.lastActivity}
                </span>
                <span className="font-medium text-stone-800 dark:text-stone-200">
                  {usageStats.lastActivityLabel || copy.account.noActivity}
                </span>
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
              <span className="text-stone-700 dark:text-stone-300">
                {copy.appearance.theme}
              </span>
              <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-white/10">
                {(
                  [
                    ["system", copy.appearance.system, Monitor],
                    ["light", copy.appearance.light, Sun],
                    ["dark", copy.appearance.dark, Moon],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 font-medium transition",
                      themePreference === value
                        ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                        : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
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
                {(
                  [
                    ["system", copy.appearance.system],
                    ["zh-CN", copy.appearance.chinese],
                    ["en-US", copy.appearance.english],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleLanguageChange(value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 font-medium transition",
                      language === value
                        ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                        : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
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
      if (providerView === "picker") {
        return (
          <section>
            <div className="flex items-center justify-between gap-3 px-3 pb-2">
              <button
                type="button"
                onClick={() => setProviderView("list")}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
              >
                <ArrowLeft className="size-3.5" />
                {copy.provider.back}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleChooseProviderPreset(preset.id)}
                  className="rounded-2xl border border-stone-200/80 bg-white p-3 text-left transition hover:border-stone-300 hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/8"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300">
                      <ServerCog className="size-4" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {preset.name}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[11px] text-stone-500 dark:text-stone-400">
                    {preset.baseUrl || copy.provider.configure}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-stone-400">
                    {preset.models
                      .slice(0, 2)
                      .map(formatImageModelLabel)
                      .join(", ")}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      }

      if (providerView === "form") {
        const editingProvider = editingProviderId
          ? draftModelProviders.find(
              (provider) => provider.id === editingProviderId
            )
          : null;
        const isCustomProvider = draftProviderPreset === "custom";
        const modelSummary = draftProviderModels
          .split(/\r?\n|,/)
          .map((model) => model.trim())
          .filter(Boolean)
          .map(formatImageModelLabel)
          .join(", ");
        return (
          <section className="flex min-h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-3 pb-2">
              <button
                type="button"
                onClick={() => {
                  setProviderView(editingProviderId ? "list" : "picker");
                  setEditingProviderId(null);
                  setDraftModelApiKey("");
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
              >
                <ArrowLeft className="size-3.5" />
                {editingProviderId
                  ? copy.provider.back
                  : copy.provider.backToProviders}
              </button>
            </div>
            <div className="flex-1 rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="space-y-3 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  <ServerCog className="size-4 text-stone-400" />
                  {draftModelProvider || copy.provider.configure}
                </div>
                {isCustomProvider ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {copy.provider.type}
                    </label>
                    <input
                      value={draftModelProvider}
                      onChange={(event) =>
                        setDraftModelProvider(event.target.value.slice(0, 32))
                      }
                      placeholder="custom"
                      className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  {isCustomProvider ? (
                    <>
                      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                        {copy.provider.baseUrl}
                      </label>
                      <input
                        value={draftModelBaseUrl}
                        onChange={(event) =>
                          setDraftModelBaseUrl(event.target.value)
                        }
                        placeholder="https://new-api.example.com/v1"
                        className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                      />
                    </>
                  ) : (
                    <div className="rounded-xl border border-stone-200/70 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/8">
                      <div className="text-[11px] font-medium text-stone-400">
                        {copy.provider.baseUrl}
                      </div>
                      <div className="mt-1 break-all text-xs text-stone-700 dark:text-stone-300">
                        {draftModelBaseUrl}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {isCustomProvider ? (
                    <>
                      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                        {copy.provider.models}
                      </label>
                      <textarea
                        value={draftProviderModels}
                        onChange={(event) =>
                          setDraftProviderModels(event.target.value)
                        }
                        rows={3}
                        placeholder={copy.provider.modelsPlaceholder}
                        className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-xs text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                      />
                    </>
                  ) : (
                    <div className="rounded-xl border border-stone-200/70 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/8">
                      <div className="text-[11px] font-medium text-stone-400">
                        {copy.provider.models}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-stone-700 dark:text-stone-300">
                        {modelSummary}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {copy.provider.apiKey}
                    </label>
                    <span className="text-[11px] text-stone-400">
                      {editingProvider?.apiKeyConfigured
                        ? copy.provider.configured
                        : copy.provider.notConfigured}
                    </span>
                  </div>
                  <input
                    value={draftModelApiKey}
                    onChange={(event) =>
                      setDraftModelApiKey(event.target.value)
                    }
                    type="password"
                    placeholder={copy.provider.apiKeyPlaceholder}
                    className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 font-mono text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 -mx-4 mt-3 border-t border-stone-200/80 bg-white/95 px-4 pb-1 pt-3 backdrop-blur dark:border-white/10 dark:bg-stone-950/95">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestProvider()}
                  disabled={isTestingProvider || isSavingProvider}
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-100 dark:hover:bg-white/10"
                >
                  {isTestingProvider ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Activity className="size-4" />
                  )}
                  <span className="truncate">
                    {isTestingProvider
                      ? copy.provider.testing
                      : copy.provider.test}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProvider()}
                  disabled={isSavingProvider || isTestingProvider}
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {isSavingProvider ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span className="truncate">{copy.provider.save}</span>
                </button>
              </div>
            </div>
          </section>
        );
      }

      const bindingStatus = session.newapiBindingStatus || "pending";
      const bindingStatusLabel =
        bindingStatus === "configured"
          ? copy.provider.bindingConfigured
          : bindingStatus === "failed"
          ? copy.provider.bindingFailed
          : copy.provider.pending;
      const happyTokenProvider =
        draftModelProviders.find((provider) =>
          isHappyTokenProvider(provider)
        ) ?? createHappyTokenProvider(session, draftModelProviders);
      const customModelProviders = draftModelProviders.filter(
        (provider) => !isHappyTokenProvider(provider)
      );

      return (
        <section>
          <div className={sectionTitleClass}>{copy.provider.title}</div>
          <div className="grid gap-2">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-white p-3 transition dark:bg-white/[0.03]",
                happyTokenProvider.selected
                  ? "border-stone-300 shadow-sm dark:border-white/20"
                  : "border-stone-200/80 dark:border-white/10"
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300">
                <ServerCog className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {copy.provider.happyToken}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
                    {copy.provider.default}
                  </span>
                  {happyTokenProvider.selected ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-stone-100 dark:text-stone-950">
                      <Check className="size-3" />
                      {copy.provider.active}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                  <span>
                    {copy.provider.status}: {bindingStatusLabel}
                  </span>
                  {happyTokenProvider.apiKeyConfigured ? (
                    <span>{copy.provider.configured}</span>
                  ) : null}
                </div>
                {bindingStatus !== "configured" &&
                session.newapiBindingMessage ? (
                  <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">
                    {session.newapiBindingMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={happyTokenManagementUrl}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={copy.provider.openHappyToken}
                  title={copy.provider.openHappyToken}
                >
                  <ExternalLink className="size-3.5" />
                  {copy.provider.manageHappyToken}
                </a>
                {!happyTokenProvider.selected ? (
                  <button
                    type="button"
                    onClick={() =>
                      void handleSelectProvider(happyTokenProvider.id)
                    }
                    disabled={isSavingProvider}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
                  >
                    {isSavingProvider ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      copy.provider.use
                    )}
                  </button>
                ) : null}
              </div>
            </div>
            {customModelProviders.map((provider) => {
              return (
                <div
                  key={provider.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-white p-3 transition dark:bg-white/[0.03]",
                    provider.selected
                      ? "border-stone-300 shadow-sm dark:border-white/20"
                      : "border-stone-200/80 dark:border-white/10"
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300">
                    <ServerCog className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {provider.type}
                      </span>
                      {provider.selected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-stone-100 dark:text-stone-950">
                          <Check className="size-3" />
                          {copy.provider.active}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">
                      {provider.baseUrl}
                    </div>
                    <div className="mt-1 text-[11px] text-stone-400">
                      {provider.apiKeyConfigured
                        ? copy.provider.configured
                        : copy.provider.notConfigured}
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
                    <button
                      type="button"
                      onClick={() => void handleDeleteProvider(provider.id)}
                      disabled={isSavingProvider}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-red-600 disabled:opacity-60 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-red-300"
                      aria-label={copy.provider.delete}
                      title={copy.provider.delete}
                    >
                      <Trash2 className="size-4" />
                    </button>
                    {!provider.selected ? (
                      <button
                        type="button"
                        onClick={() => void handleSelectProvider(provider.id)}
                        disabled={isSavingProvider}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
                      >
                        {isSavingProvider ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          copy.provider.use
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => openProviderPicker()}
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
                onChange={(event) =>
                  setDraftWatermarkLabel(event.target.value.slice(0, 64))
                }
                placeholder={copy.watermark.placeholder}
                className="h-9 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-stone-400 dark:border-white/10 dark:bg-white/8 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={() => void handleSaveWatermarkLabel()}
                disabled={isSavingWatermarkLabel}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {isSavingWatermarkLabel ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {copy.watermark.save}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
              {copy.watermark.hint}
            </p>
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                {copy.watermark.previewTitle}
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 dark:border-white/10 dark:bg-stone-900">
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-stone-800 dark:via-stone-900 dark:to-zinc-950">
                  <img
                    src="/happy-token-logo.svg"
                    alt={copy.watermark.previewAlt}
                    className="size-20 rounded-2xl shadow-sm"
                  />
                </div>
                <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
                  @Happy Token
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                {copy.watermark.previewCaption}
              </p>
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
              <span className="ml-auto max-w-44 truncate text-xs text-stone-400">
                {SUPPORT_EMAIL}
              </span>
            </a>
            <button
              type="button"
              onClick={() =>
                void handleCopy(SUPPORT_WECHAT, copy.contact.wechat)
              }
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Copy className="size-4 text-stone-400" />
              {copy.contact.wechat}
              <span className="ml-auto max-w-44 truncate text-xs text-stone-400">
                {SUPPORT_WECHAT}
              </span>
            </button>
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                {copy.contact.qr}
              </div>
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
            <span className="ml-auto text-xs text-stone-400">
              v{webConfig.appVersion}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
            {copy.about.description}
          </p>
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
        {iconOnly ? null : (
          <span className={compactOnMobile ? "hidden md:inline" : undefined}>
            {triggerLabel}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="flex h-[min(38rem,calc(100dvh-5.5rem))] w-[min(42rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border-stone-200/80 bg-white/96 p-0 text-stone-950 shadow-[0_28px_80px_-36px_rgba(24,24,27,0.38)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/96 dark:text-stone-50"
      >
        <div className="shrink-0 border-b border-stone-100 px-4 py-3 dark:border-white/10">
          <div className="truncate text-sm font-semibold">{displayName}</div>
          <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {copy.header}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[11rem_minmax(0,1fr)]">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-100 bg-stone-50/80 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:block sm:overflow-visible sm:border-b-0 sm:border-r">
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
                      : "text-stone-500 hover:bg-white/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/8 dark:hover:text-stone-100"
                  )}
                >
                  <Icon className="size-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 overflow-y-auto p-4 pb-24">
            {renderPanel()}
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-100 p-2 dark:border-white/10">
          {showDocsLink ? (
            <Link
              href="/docs"
              className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
            >
              <BookOpen className="size-4" />
              {copy.docs}
            </Link>
          ) : null}
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

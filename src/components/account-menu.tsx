"use client";

import {
  Activity,
  BarChart3,
  Check,
  Copy,
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
  Save,
  Stamp,
  Sun,
  ThumbsDown,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import webConfig from "@/constants/common-env";
import { SUPPORT_EMAIL, SUPPORT_WECHAT, SUPPORT_WECHAT_QR } from "@/lib/contact";
import { cn } from "@/lib/utils";
import type { StoredAuthSession } from "@/store/auth";

type LanguagePreference = "system" | "zh-CN" | "en-US";
type EffectiveLanguage = "zh-CN" | "en-US";
type ThemePreference = "system" | "light" | "dark";
type SettingsSection = "account" | "appearance" | "watermark" | "contact" | "about";

export type AccountUsageStats = {
  remainingQuotaLabel?: string;
  conversationCount: number;
  turnCount: number;
  generatedImageCount: number;
  activeTaskCount: number;
  likedImageCount: number;
  dislikedImageCount: number;
  lastActivityLabel?: string;
};

const LANGUAGE_STORAGE_KEY = "happyimage:language";
const THEME_STORAGE_KEY = "happyimage-theme";

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
    },
    account: {
      current: "当前登录账户",
      quota: "剩余额度",
      quotaUnit: "张",
      unlimited: "不限量",
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
      previewAlt: "HappyImage 水印示例",
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
    },
    account: {
      current: "Current signed-in account",
      quota: "Remaining quota",
      quotaUnit: "images",
      unlimited: "Unlimited",
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
      previewAlt: "HappyImage watermark preview",
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

function getSystemLanguage(): EffectiveLanguage {
  if (typeof navigator === "undefined") return "zh-CN";
  return navigator.language.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

function resolveLanguage(preference: LanguagePreference): EffectiveLanguage {
  return preference === "system" ? getSystemLanguage() : preference;
}

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

export function AccountMenu({
  session,
  onLogout,
  compactOnMobile = false,
  iconOnly = false,
  watermarkLabel,
  onSaveWatermarkLabel,
  usageStats,
}: {
  session: StoredAuthSession;
  onLogout: () => void | Promise<void>;
  compactOnMobile?: boolean;
  iconOnly?: boolean;
  watermarkLabel?: string;
  onSaveWatermarkLabel?: (value: string) => void | Promise<void>;
  usageStats?: AccountUsageStats;
}) {
  const [draftWatermarkLabel, setDraftWatermarkLabel] = useState(watermarkLabel ?? session.watermarkLabel ?? "");
  const [isSavingWatermarkLabel, setIsSavingWatermarkLabel] = useState(false);
  const [language, setLanguage] = useState<LanguagePreference>("system");
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const effectiveLanguage = resolveLanguage(language);
  const copy = settingsCopy[effectiveLanguage];
  const displayName = session.name.trim() || copy.fallbackName;
  const triggerLabel = session.role === "admin" ? copy.trigger.admin : copy.trigger.mine;
  const quotaLabel =
    usageStats?.remainingQuotaLabel ??
    (session.role === "admin"
      ? copy.account.unlimited
      : typeof session.imageQuota === "number"
        ? String(Math.max(0, session.imageQuota))
        : "--");

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "system" || stored === "zh-CN" || stored === "en-US") {
      setLanguage(stored);
    }
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "system" || storedTheme === "light" || storedTheme === "dark") {
      setThemePreference(storedTheme);
    }
  }, []);

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

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}${effectiveLanguage === "zh-CN" ? copy.contact.copied : ` ${copy.contact.copied}`}`);
    } catch {
      toast.error(copy.contact.copyFailed);
    }
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    setLanguage(value);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    toast.success(settingsCopy[resolveLanguage(value)].appearance.languageSaved);
  };

  const handleThemeChange = (value: ThemePreference) => {
    setThemePreference(value);
    applyThemePreference(value);
    toast.success(copy.appearance.themeSaved);
  };

  const settingRowClass = "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm";
  const sectionTitleClass = "px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500";
  const sections = [
    { id: "account", label: copy.nav.account, icon: UserRound },
    { id: "appearance", label: copy.nav.appearance, icon: Palette },
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
          <div className="mt-3 rounded-2xl border border-stone-200/80 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{copy.account.quota}</div>
            <div className="mt-2 flex items-end gap-2">
              <div className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">{quotaLabel}</div>
              {session.role !== "admin" ? <div className="pb-1 text-xs text-stone-400">{copy.account.quotaUnit}</div> : null}
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
                  <img src="/happyimage-logo.svg" alt={copy.watermark.previewAlt} className="size-20 rounded-2xl shadow-sm" />
                </div>
                <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
                  @HappyImage
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
            HappyImage
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

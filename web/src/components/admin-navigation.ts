import { FileText, ImageIcon, KeyRound, Settings, type LucideIcon } from "lucide-react";

import type { EffectiveLanguage } from "@/lib/language";

export type AdminNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const adminNavigationItems = [
  { href: "/users", label: { "zh-CN": "用户管理", "en-US": "Users" }, icon: KeyRound },
  { href: "/image-manager", label: { "zh-CN": "图片管理", "en-US": "Images" }, icon: ImageIcon },
  { href: "/logs", label: { "zh-CN": "日志管理", "en-US": "Logs" }, icon: FileText },
  { href: "/settings", label: { "zh-CN": "系统设置", "en-US": "Settings" }, icon: Settings },
];

export function getAdminNavigationItems(language: EffectiveLanguage): AdminNavigationItem[] {
  return adminNavigationItems.map((item) => ({
    href: item.href,
    label: item.label[language],
    icon: item.icon,
  }));
}

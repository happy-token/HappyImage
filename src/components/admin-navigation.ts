import { Bug, FileText, ImageIcon, KeyRound, Settings, Users, type LucideIcon } from "lucide-react";

export type AdminNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const adminNavigationItems: AdminNavigationItem[] = [
  { href: "/accounts", label: "号池管理", icon: Users },
  { href: "/users", label: "用户管理", icon: KeyRound },
  { href: "/image-manager", label: "图片管理", icon: ImageIcon },
  { href: "/logs", label: "日志管理", icon: FileText },
  { href: "/debug", label: "调试", icon: Bug },
  { href: "/settings", label: "系统设置", icon: Settings },
];

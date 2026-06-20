"use client";

import Link from "next/link";
import { Images, MessageSquarePlus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type ImageWorkspaceMode = "compose" | "official_gallery" | "user_gallery";

type ImageWorkspaceNavProps = {
  activeMode?: ImageWorkspaceMode;
  asLinks?: boolean;
  collapseLabels?: boolean;
  iconOnly?: boolean;
  className?: string;
  onCreateDraft?: () => void;
  onSelectMode?: (mode: ImageWorkspaceMode) => void;
};

const workspaceItems = [
  {
    mode: "compose" as const,
    href: "/image?mode=compose&new=1",
    label: "新建对话",
    collapsedLabel: "新对话",
    icon: MessageSquarePlus,
  },
  {
    mode: "official_gallery" as const,
    href: "/image?mode=official_gallery",
    label: "官方图库",
    collapsedLabel: "官方图库",
    icon: Sparkles,
  },
  {
    mode: "user_gallery" as const,
    href: "/image?mode=user_gallery",
    label: "我的图库",
    collapsedLabel: "我的图库",
    icon: Images,
  },
];

export function ImageWorkspaceNav({
  activeMode,
  asLinks = false,
  collapseLabels = false,
  iconOnly = false,
  className,
  onCreateDraft,
  onSelectMode,
}: ImageWorkspaceNavProps) {
  return (
    <nav className={cn("grid gap-1 border-b border-stone-200/70 pb-3 dark:border-white/10", className)}>
      {workspaceItems.map((item) => {
        const Icon = item.icon;
        const active = activeMode === item.mode;
        const itemClassName = cn(
          "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium transition",
          iconOnly ? "justify-center px-0" : collapseLabels ? "justify-center md:justify-between" : "justify-between",
          active
            ? "border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-50",
        );
        const label = iconOnly ? null : <span className={cn(collapseLabels && "hidden md:inline")}>{item.label}</span>;
        const icon = <Icon className="size-4 shrink-0" />;

        if (asLinks) {
          return (
            <Link key={item.mode} href={item.href} title={item.label} aria-label={item.label} className={itemClassName}>
              {label}
              {icon}
            </Link>
          );
        }

        return (
          <button
            key={item.mode}
            type="button"
            className={itemClassName}
            aria-label={item.label}
            title={item.label}
            onClick={() => {
              if (item.mode === "compose") {
                onCreateDraft?.();
                return;
              }
              onSelectMode?.(item.mode);
            }}
          >
            {label}
            {icon}
          </button>
        );
      })}
    </nav>
  );
}

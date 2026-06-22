"use client";

import Link from "next/link";
import { Images, MessageSquarePlus, Sparkles } from "lucide-react";

import { useEffectiveLanguage, type EffectiveLanguage } from "@/lib/language";
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
    label: {
      "zh-CN": "新建对话",
      "en-US": "New chat",
    },
    collapsedLabel: {
      "zh-CN": "新对话",
      "en-US": "New",
    },
    icon: MessageSquarePlus,
  },
  {
    mode: "official_gallery" as const,
    href: "/image?mode=official_gallery",
    label: {
      "zh-CN": "官方图库",
      "en-US": "Official gallery",
    },
    collapsedLabel: {
      "zh-CN": "官方图库",
      "en-US": "Official",
    },
    icon: Sparkles,
  },
  {
    mode: "user_gallery" as const,
    href: "/image?mode=user_gallery",
    label: {
      "zh-CN": "我的图库",
      "en-US": "My gallery",
    },
    collapsedLabel: {
      "zh-CN": "我的图库",
      "en-US": "Mine",
    },
    icon: Images,
  },
];

function getItemLabel(item: (typeof workspaceItems)[number], language: EffectiveLanguage, collapseLabels: boolean) {
  return (collapseLabels ? item.collapsedLabel : item.label)[language];
}

export function ImageWorkspaceNav({
  activeMode,
  asLinks = false,
  collapseLabels = false,
  iconOnly = false,
  className,
  onCreateDraft,
  onSelectMode,
}: ImageWorkspaceNavProps) {
  const language = useEffectiveLanguage();

  return (
    <nav className={cn("grid gap-1 border-b border-stone-200/70 pb-3 dark:border-white/10", className)}>
      {workspaceItems.map((item) => {
        const Icon = item.icon;
        const active = activeMode === item.mode;
        const labelText = getItemLabel(item, language, collapseLabels);
        const itemClassName = cn(
          "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium transition",
          iconOnly ? "justify-center px-0" : collapseLabels ? "justify-center md:justify-between" : "justify-between",
          active
            ? "border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-50",
        );
        const label = iconOnly ? null : <span className={cn(collapseLabels && "hidden md:inline")}>{labelText}</span>;
        const icon = <Icon className="size-4 shrink-0" />;

        if (asLinks) {
          return (
            <Link key={item.mode} href={item.href} title={labelText} aria-label={labelText} className={itemClassName}>
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
            aria-label={labelText}
            title={labelText}
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

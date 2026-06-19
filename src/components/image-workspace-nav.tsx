"use client";

import Link from "next/link";
import { Images, MessageSquarePlus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type ImageWorkspaceMode = "compose" | "official_gallery" | "user_gallery";

type ImageWorkspaceNavProps = {
  activeMode?: ImageWorkspaceMode;
  asLinks?: boolean;
  collapseLabels?: boolean;
  className?: string;
  onCreateDraft?: () => void;
  onSelectMode?: (mode: ImageWorkspaceMode) => void;
};

const workspaceItems = [
  {
    mode: "compose" as const,
    href: "/image?mode=compose&new=1",
    label: "新建对话",
    icon: MessageSquarePlus,
  },
  {
    mode: "official_gallery" as const,
    href: "/image?mode=official_gallery",
    label: "官方图库",
    icon: Sparkles,
  },
  {
    mode: "user_gallery" as const,
    href: "/image?mode=user_gallery",
    label: "我的图库",
    icon: Images,
  },
];

export function ImageWorkspaceNav({
  activeMode,
  asLinks = false,
  collapseLabels = false,
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
          collapseLabels ? "justify-center md:justify-between" : "justify-between",
          active
            ? "bg-stone-950 text-white dark:bg-white dark:text-stone-950"
            : "text-stone-700 hover:bg-white/70 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white",
        );
        const label = <span className={cn(collapseLabels && "hidden md:inline")}>{item.label}</span>;

        if (asLinks) {
          return (
            <Link key={item.mode} href={item.href} title={item.label} aria-label={item.label} className={itemClassName}>
              {label}
              <Icon className="size-4 shrink-0" />
            </Link>
          );
        }

        return (
          <button
            key={item.mode}
            type="button"
            className={itemClassName}
            onClick={() => {
              if (item.mode === "compose") {
                onCreateDraft?.();
                return;
              }
              onSelectMode?.(item.mode);
            }}
          >
            {label}
            <Icon className="size-4 shrink-0" />
          </button>
        );
      })}
    </nav>
  );
}

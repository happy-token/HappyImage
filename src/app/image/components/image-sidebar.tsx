"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LoaderCircle, PanelLeftClose, PanelLeftOpen, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { adminNavigationItems } from "@/components/admin-navigation";
import { ImageWorkspaceNav, type ImageWorkspaceMode } from "@/components/image-workspace-nav";
import { cn } from "@/lib/utils";
import { getImageConversationStats, type ImageConversation } from "@/store/image-conversations";

export type { ImageWorkspaceMode };

type ImageSidebarProps = {
  conversations: ImageConversation[];
  isLoadingHistory: boolean;
  selectedConversationId: string | null;
  activeMode: ImageWorkspaceMode;
  onCreateDraft: () => void;
  onSelectConversation: (id: string) => void;
  onSelectMode: (mode: ImageWorkspaceMode) => void;
  onDeleteConversation: (id: string) => void | Promise<void>;
  onRenameConversation: (id: string, title: string) => void | Promise<void>;
  formatConversationTime: (value: string) => string;
  hideActionButtons?: boolean;
  isAdmin?: boolean;
  accountFooter?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function ImageSidebar({
  conversations,
  isLoadingHistory,
  selectedConversationId,
  activeMode,
  onCreateDraft,
  onSelectConversation,
  onSelectMode,
  onDeleteConversation,
  onRenameConversation,
  formatConversationTime,
  hideActionButtons = false,
  isAdmin = false,
  accountFooter,
  collapsed = false,
  onToggleCollapsed,
}: ImageSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = useCallback((conversation: ImageConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  }, []);

  const commitRename = useCallback(() => {
    const trimmed = editingTitle.trim();
    if (editingId && trimmed) {
      void onRenameConversation(editingId, trimmed);
    }
    setEditingId(null);
    setEditingTitle("");
  }, [editingId, editingTitle, onRenameConversation]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  return (
    <aside className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-2 py-1 sm:gap-2 sm:py-1">
        {!hideActionButtons && (
          <div className="space-y-2">
            <div className={cn("flex items-center gap-2 px-2 pt-1 pb-2", collapsed && "justify-center px-0")}>
              {collapsed ? null : (
                <Image
                  src="/happyimage-logo.svg"
                  alt="HappyImage"
                  width={28}
                  height={28}
                  priority
                  className="size-7 rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)]"
                />
              )}
              {collapsed ? null : (
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  HappyImage
                </span>
              )}
              {onToggleCollapsed ? (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50"
                  aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                  title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                >
                  {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
              ) : null}
            </div>
            <ImageWorkspaceNav activeMode={activeMode} iconOnly={collapsed} onCreateDraft={onCreateDraft} onSelectMode={onSelectMode} />
          </div>
        )}

        <section className="shrink-0 space-y-1">
          {hideActionButtons ? (
            <ImageWorkspaceNav activeMode={activeMode} onCreateDraft={onCreateDraft} onSelectMode={onSelectMode} />
          ) : null}
          {isAdmin && !collapsed ? (
            <div className="space-y-1 pt-2">
              {adminNavigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-9 w-full items-center justify-between rounded-xl px-3 text-sm font-medium text-zinc-600 transition hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-50"
                  >
                    <span>{item.label}</span>
                    <Icon className="size-4" />
                  </Link>
                );
              })}
            </div>
          ) : null}
        </section>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(120,113,108,.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/45 [&::-webkit-scrollbar-track]:bg-transparent",
            hideActionButtons ? "space-y-1 pr-0" : "space-y-2 pr-1",
            collapsed && !hideActionButtons && "pr-0",
          )}
        >
          {collapsed && !hideActionButtons ? null : isLoadingHistory ? (
            <div className="flex items-center gap-2 px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              <LoaderCircle className="size-4 animate-spin" />
              正在读取会话记录
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">还没有图片记录，输入提示词后会在这里显示。</div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId;
              const stats = getImageConversationStats(conversation);
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group relative w-full rounded-xl text-left transition",
                    hideActionButtons ? "px-4 py-3.5" : "px-3 py-2.5",
                    active
                      ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
                      : "text-zinc-600 hover:bg-white/65 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className="block w-full pr-8 text-left"
                  >
                    <div className={cn("truncate font-medium", hideActionButtons ? "text-base" : "text-sm")}>
                      {editingId === conversation.id ? (
                        <input
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full truncate rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      ) : (
                        <span className="truncate">{conversation.title}</span>
                      )}
                    </div>
                    <div className={cn("mt-1 text-xs", active ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500")}>
                      {conversation.turns.length} 轮 · {formatConversationTime(conversation.updatedAt)}
                    </div>
                    {stats.running > 0 || stats.queued > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {stats.running > 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-600">处理中 {stats.running}</span>
                        ) : null}
                        {stats.queued > 0 ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">排队 {stats.queued}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                  <div className="absolute top-2.5 right-1.5 flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => startRename(conversation, e)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                      aria-label="重命名会话"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteConversation(conversation.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-white/10"
                      aria-label="删除会话"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {accountFooter ? (
          <div className="shrink-0 border-t border-zinc-200/70 pt-2 dark:border-zinc-800">
            {accountFooter}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

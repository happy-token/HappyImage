"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { adminNavigationItems } from "@/components/admin-navigation";
import { ImageWorkspaceNav, type ImageWorkspaceMode } from "@/components/image-workspace-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getImageConversationStats, type ImageConversation } from "@/store/image-conversations";

type ImageSidebarProps = {
  conversations: ImageConversation[];
  isLoadingHistory: boolean;
  selectedConversationId: string | null;
  activeMode: ImageWorkspaceMode;
  onCreateDraft: () => void;
  onClearHistory: () => void | Promise<void>;
  onSelectConversation: (id: string) => void;
  onSelectMode: (mode: ImageWorkspaceMode) => void;
  onDeleteConversation: (id: string) => void | Promise<void>;
  onRenameConversation: (id: string, title: string) => void | Promise<void>;
  formatConversationTime: (value: string) => string;
  hideActionButtons?: boolean;
  isAdmin?: boolean;
};

export function ImageSidebar({
  conversations,
  isLoadingHistory,
  selectedConversationId,
  activeMode,
  onCreateDraft,
  onClearHistory,
  onSelectConversation,
  onSelectMode,
  onDeleteConversation,
  onRenameConversation,
  formatConversationTime,
  hideActionButtons = false,
  isAdmin = false,
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
      <div className="flex h-full min-h-0 flex-col gap-2 py-1 sm:gap-3 sm:py-2">
        {!hideActionButtons && (
          <div className="space-y-2">
            <ImageWorkspaceNav activeMode={activeMode} onCreateDraft={onCreateDraft} onSelectMode={onSelectMode} />
            <Button
              variant="outline"
              className="h-10 w-full justify-between rounded-lg border-stone-200 bg-white/85 px-3 text-sm font-medium text-stone-600 hover:bg-white"
              onClick={() => void onClearHistory()}
              disabled={conversations.length === 0}
            >
              <span>清空历史</span>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}

        <section className="shrink-0 space-y-1">
          {hideActionButtons ? (
            <ImageWorkspaceNav activeMode={activeMode} onCreateDraft={onCreateDraft} onSelectMode={onSelectMode} />
          ) : null}
          {isAdmin ? (
            <div className="space-y-1 pt-2">
              {adminNavigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-stone-700 transition hover:bg-white/70 hover:text-stone-950"
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
          )}
        >
          {isLoadingHistory ? (
            <div className="flex items-center gap-2 px-2 py-3 text-sm text-stone-500">
              <LoaderCircle className="size-4 animate-spin" />
              正在读取会话记录
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-3 text-sm leading-6 text-stone-500">还没有图片记录，输入提示词后会在这里显示。</div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId;
              const stats = getImageConversationStats(conversation);
              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group relative w-full border-l-2 text-left transition",
                    hideActionButtons ? "px-4 py-3.5" : "px-3 py-2 sm:py-3",
                    active
                      ? "border-stone-900 bg-black/[0.035] text-stone-950"
                      : "border-transparent text-stone-700 hover:border-stone-300 hover:bg-white/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className="block w-full pr-8 text-left"
                  >
                    <div className={cn("truncate font-semibold", hideActionButtons ? "text-base" : "text-sm")}>
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
                          className="w-full truncate rounded border border-stone-300 bg-white px-1 py-0.5 text-sm outline-none focus:border-stone-500"
                        />
                      ) : (
                        <span className="truncate">{conversation.title}</span>
                      )}
                    </div>
                    <div className={cn("mt-1 text-xs", active ? "text-stone-500" : "text-stone-400")}>
                      {conversation.turns.length} 轮 · {formatConversationTime(conversation.updatedAt)}
                    </div>
                    {stats.running > 0 || stats.queued > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {stats.running > 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-600">处理中 {stats.running}</span>
                        ) : null}
                        {stats.queued > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">排队 {stats.queued}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                  <div className="absolute top-2.5 right-1.5 flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => startRename(conversation, e)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                      aria-label="重命名会话"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteConversation(conversation.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-rose-500"
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

      </div>
    </aside>
  );
}

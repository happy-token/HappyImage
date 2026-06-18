"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageIcon, Plus, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ImageConversation } from "@/store/image-conversations";

import { UserGalleryDetailDrawer } from "./user-gallery-detail-drawer";
import {
  buildUserGalleryItems,
  type UserGalleryItem,
} from "./user-gallery-adapter";

type UserGalleryPanelProps = {
  conversations: ImageConversation[];
  onUsePrompt: (prompt: string) => void;
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UserGalleryCard({
  item,
  selected,
  onSelect,
}: {
  item: UserGalleryItem;
  selected: boolean;
  onSelect: (item: UserGalleryItem) => void;
}) {
  const createdAt = formatCreatedAt(item.createdAt);
  const label = `查看我的图库作品，创建于 ${createdAt}`;

  return (
    <article
      className={`mb-3 break-inside-avoid overflow-hidden rounded-lg border bg-white/92 shadow-sm transition hover:border-stone-300 hover:shadow-md ${
        selected
          ? "border-stone-950 ring-2 ring-stone-950/15"
          : "border-stone-200/80"
      }`}
    >
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={selected}
        className="block w-full bg-stone-100 text-left outline-none ring-stone-950/10 transition focus-visible:ring-4"
        onClick={() => onSelect(item)}
      >
        <img
          src={item.imageUrl}
          alt={label}
          loading="lazy"
          className="h-auto w-full object-cover"
        />
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="truncate text-xs text-stone-500">{createdAt}</span>
        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
          {item.size || item.model || "图片"}
        </span>
      </div>
    </article>
  );
}

function EmptyUserGallery({
  onUsePrompt,
}: {
  onUsePrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white/75 px-5 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
        <ImageIcon className="size-7" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stone-950">
        还没有可展示的作品
      </h3>
      <p className="mt-1 max-w-[280px] text-xs leading-5 text-stone-500">
        完成一次图片生成后，这里会自动整理成你的个人图库。
      </p>
      <Button
        type="button"
        className="mt-4 h-9 rounded-md bg-stone-950 text-white hover:bg-stone-800"
        onClick={() => onUsePrompt("")}
      >
        <Plus className="size-4" />
        返回创作
      </Button>
    </div>
  );
}

export function UserGalleryPanel({
  conversations,
  onUsePrompt,
}: UserGalleryPanelProps) {
  const items = useMemo(
    () => buildUserGalleryItems(conversations),
    [conversations],
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  const handleSelect = (item: UserGalleryItem) => {
    setSelectedItemId(item.id);
  };

  const handleCloseDrawer = useCallback(() => {
    setSelectedItemId(null);
  }, []);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-stone-200/75 bg-stone-50/70">
      <header className="shrink-0 border-b border-stone-200/75 bg-white/82 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-950">我的图库</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              点击图片整理分享草稿，或继续复用提示词。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-md border-stone-200 bg-white text-stone-700"
            onClick={() => onUsePrompt("")}
          >
            <WandSparkles className="size-3.5" />
            创作
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-color:rgba(120,113,108,.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/45 [&::-webkit-scrollbar-track]:bg-transparent sm:px-4">
        {items.length === 0 ? (
          <EmptyUserGallery onUsePrompt={onUsePrompt} />
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
            {items.map((item) => (
              <UserGalleryCard
                key={item.id}
                item={item}
                selected={selectedItemId === item.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      <UserGalleryDetailDrawer
        item={selectedItem}
        onClose={handleCloseDrawer}
        onUsePrompt={onUsePrompt}
      />
    </section>
  );
}

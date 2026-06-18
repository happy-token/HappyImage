"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ImageIcon, LoaderCircle, Search, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import webConfig from "@/constants/common-env";
import { fetchSeedGallery, type SeedGalleryItem } from "@/lib/api";
import { formatGalleryCategory } from "@/lib/gallery-categories";

function buildAssetUrl(path: string) {
  if (!path) {
    return "";
  }
  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }
  const base = webConfig.apiUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getPreviewImageUrl(item: SeedGalleryItem) {
  const image = item.images[0];
  if (!image) {
    return "";
  }
  const thumbnailUrl = "thumbnail_url" in image && typeof image.thumbnail_url === "string" ? image.thumbnail_url : "";
  return buildAssetUrl(thumbnailUrl || image.url);
}

function getAspectRatio(item: SeedGalleryItem) {
  const image = item.images[0];
  if (image?.width && image?.height) {
    return `${image.width} / ${image.height}`;
  }
  return "1 / 1";
}

function formatCategory(value: string) {
  return formatGalleryCategory(value);
}

function OfficialGalleryCard({
  item,
  onUsePrompt,
}: {
  item: SeedGalleryItem;
  onUsePrompt: (prompt: string, title: string) => void;
}) {
  const imageUrl = getPreviewImageUrl(item);

  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-lg border border-stone-200/80 bg-white/92 shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <div
        className="relative w-full overflow-hidden bg-stone-100"
        style={{ aspectRatio: getAspectRatio(item) }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            <ImageIcon className="size-8" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              {formatCategory(item.category)}
            </span>
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-stone-950">
            {item.title}
          </h3>
          <p className="line-clamp-3 text-xs leading-5 text-stone-500">
            {item.prompt}
          </p>
        </div>

        <Button
          size="sm"
          className="h-8 w-full rounded-md bg-stone-950 text-white hover:bg-stone-800"
          onClick={() => onUsePrompt(item.prompt, item.title)}
        >
          <WandSparkles className="size-3.5" />
          使用提示词
        </Button>
      </div>
    </article>
  );
}

export function OfficialGalleryPanel({
  onUsePrompt,
}: {
  onUsePrompt: (prompt: string, title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<SeedGalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await fetchSeedGallery({ query: debouncedQuery, limit: 80 });
        if (!cancelled) {
          setItems(data.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "读取官方图库失败";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const stateMessage = useMemo(() => {
    if (isLoading && items.length === 0) {
      return "正在读取官方图库";
    }
    if (!isLoading && !error && items.length === 0) {
      return debouncedQuery ? "没有找到匹配的官方案例" : "官方图库暂时没有可用案例";
    }
    return "";
  }, [debouncedQuery, error, isLoading, items.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-stone-200/75 bg-stone-50/70">
      <header className="shrink-0 border-b border-stone-200/75 bg-white/82 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-950">官方图库</h2>
            <p className="mt-0.5 text-xs text-stone-500">选择案例提示词，快速带入当前创作。</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-md border-stone-200 bg-white text-stone-700"
            asChild
          >
            <a href="/gallery" target="_blank" rel="noreferrer">
              全部图库
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、分类或提示词"
            aria-label="搜索官方图库"
            className="h-10 rounded-lg border-stone-200 bg-white pl-9 shadow-none"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-color:rgba(120,113,108,.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/45 [&::-webkit-scrollbar-track]:bg-transparent sm:px-4">
        {error ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {isLoading && items.length > 0 ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">
            <LoaderCircle className="size-4 animate-spin" />
            正在更新官方图库
          </div>
        ) : null}

        {stateMessage ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white/70 px-4 text-sm text-stone-500">
            <span className="inline-flex items-center gap-2">
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {stateMessage}
            </span>
          </div>
        ) : (
          <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
            {items.map((item) => (
              <OfficialGalleryCard key={item.id} item={item} onUsePrompt={onUsePrompt} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

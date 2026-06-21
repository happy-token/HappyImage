"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, ExternalLink, ImageIcon, LoaderCircle, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import webConfig from "@/constants/common-env";
import {
  fetchSeedGallery,
  fetchSeedGalleryFacets,
  type SeedGalleryFacetsResponse,
  type SeedGalleryItem,
} from "@/lib/api";
import { compareGalleryCategoryEntries, formatGalleryCategory } from "@/lib/gallery-categories";
import { saveGalleryPromptIntent } from "@/lib/gallery-intent";
import { cn } from "@/lib/utils";

function buildAssetUrl(path: string) {
  if (/^(https?:|data:|blob:)/.test(path) || path.startsWith("/seed-gallery/")) {
    return path;
  }
  const base = webConfig.apiUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getPrimaryImageUrl(item: SeedGalleryItem) {
  const image = item.images[0];
  return image ? buildAssetUrl(image.url) : "";
}

function getPreviewImageUrl(item: SeedGalleryItem) {
  const image = item.images[0];
  if (!image) {
    return "";
  }
  return buildAssetUrl(
    image.thumbnail_url ||
      image.url
        .replace("/api/seed-gallery/images/", "/api/seed-gallery/thumbnails/640/")
        .replace("/seed-gallery/images/", "/seed-gallery/thumbnails/w640/"),
  );
}

function formatCategory(value: string) {
  return formatGalleryCategory(value);
}

function SeedGalleryCard({
  item,
  onUsePrompt,
  onCopyPrompt,
}: {
  item: SeedGalleryItem;
  onUsePrompt: (item: SeedGalleryItem) => void;
  onCopyPrompt: (item: SeedGalleryItem) => void;
}) {
  const image = item.images[0];
  const imageUrl = getPreviewImageUrl(item);
  const aspectRatio = image?.width && image?.height ? `${image.width} / ${image.height}` : "1 / 1";
  const topTags = item.tags.filter((tag) => tag !== item.category).slice(0, 3);
  const detailHref = `/gallery/${encodeURIComponent(item.id)}`;

  return (
    <article className="group overflow-hidden rounded-lg border border-stone-200/80 bg-white/88 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-white/10 dark:bg-stone-950/72">
      <Link
        href={detailHref}
        className="relative block w-full overflow-hidden bg-stone-100 text-left dark:bg-stone-900"
        style={{ aspectRatio }}
        title="查看提示词详情"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            <ImageIcon className="size-8" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/62 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/94 px-2.5 py-1 text-xs font-medium text-stone-900">
            查看提示词
            <ArrowRight className="size-3" />
          </span>
        </div>
      </Link>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-2 py-0.5">
            {formatCategory(item.category)}
          </Badge>
        </div>
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-stone-950 dark:text-stone-50">
            <Link href={detailHref} className="hover:text-stone-700 dark:hover:text-stone-200">
              {item.title}
            </Link>
          </h2>
          <p className="line-clamp-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
            {item.prompt}
          </p>
        </div>
        {topTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {topTags.map((tag) => (
              <span key={tag} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500 dark:bg-white/8 dark:text-stone-300">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 flex-1 rounded-md" onClick={() => onUsePrompt(item)}>
            <ArrowRight className="size-3.5" />
            生成同款
          </Button>
          <Button size="icon" variant="outline" className="size-8 rounded-md" onClick={() => onCopyPrompt(item)} title="复制提示词">
            <Copy className="size-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="size-8 rounded-md" asChild title="查看详情">
            <Link href={detailHref}>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          {item.source_url ? (
            <Button size="icon" variant="outline" className="size-8 rounded-md" asChild title="查看来源">
              <a href={item.source_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type GalleryBrowserProps = {
  embedded?: boolean;
  onUsePrompt?: (prompt: string, title: string, item: SeedGalleryItem) => void;
};

export function GalleryBrowser({ embedded = false, onUsePrompt }: GalleryBrowserProps = {}) {
  const router = useRouter();
  const [items, setItems] = useState<SeedGalleryItem[]>([]);
  const [facets, setFacets] = useState<SeedGalleryFacetsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const categories = useMemo(
    () => Object.entries(facets?.categories || {}).sort(compareGalleryCategoryEntries),
    [facets],
  );

  const loadItems = useCallback(
    async (nextOffset = 0, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        const data = await fetchSeedGallery({
          query: query.trim(),
          category: category === "all" ? "" : category,
          limit: 48,
          offset: nextOffset,
        });
        setItems((current) => (append ? [...current, ...data.items] : data.items));
        setOffset(data.offset + data.items.length);
        setTotal(data.total);
        setHasMore(data.has_more);
      } catch (error) {
        const message = error instanceof Error ? error.message : "读取图库失败";
        toast.error(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [category, query],
  );

  useEffect(() => {
    let cancelled = false;
    const loadFacets = async () => {
      try {
        const data = await fetchSeedGalleryFacets();
        if (!cancelled) {
          setFacets(data);
        }
      } catch {
        if (!cancelled) {
          setFacets(null);
        }
      }
    };
    void loadFacets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems(0, false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const handleUsePrompt = (item: SeedGalleryItem) => {
    if (onUsePrompt) {
      onUsePrompt(item.prompt, item.title, item);
      return;
    }

    saveGalleryPromptIntent({
      prompt: item.prompt,
      sourceGalleryId: item.id,
      sourceKind: "seed",
      title: item.title,
      imageUrl: getPrimaryImageUrl(item) || undefined,
    });
    router.push("/image");
  };

  const handleCopyPrompt = async (item: SeedGalleryItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      toast.success("提示词已复制");
    } catch {
      toast.error("复制失败，请手动选择提示词");
    }
  };

  return (
    <section
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-4 px-0 sm:px-3",
        embedded
          ? "min-h-0 max-w-none overflow-y-auto pb-4 [scrollbar-color:rgba(120,113,108,.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/45 [&::-webkit-scrollbar-track]:bg-transparent"
          : "max-w-[1380px] pb-8",
      )}
    >
      <div className="flex flex-col gap-4 rounded-lg border border-stone-200/80 bg-white/74 p-4 shadow-sm dark:border-white/10 dark:bg-stone-950/62 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
              <ImageIcon className="size-4" />
              HappyImage 灵感图库
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-50 sm:text-3xl">
              从好看的图开始生成
            </h1>
            <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
              已接入开源提示词素材库。图片和提示词可用于灵感与复刻起点，发布到正式商业图库前仍需要版权、商标和肖像复核。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[260px]">
            <div className="rounded-md bg-stone-100/80 px-3 py-2 dark:bg-white/8">
              <div className="text-lg font-semibold text-stone-950 dark:text-stone-50">{facets?.total ?? "..."}</div>
              <div className="text-xs text-stone-500">素材</div>
            </div>
            <div className="rounded-md bg-stone-100/80 px-3 py-2 dark:bg-white/8">
              <div className="text-lg font-semibold text-stone-950 dark:text-stone-50">{categories.length || "..."}</div>
              <div className="text-xs text-stone-500">分类</div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_210px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索香水海报、产品摄影、人像、UI、故事板..."
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 rounded-2xl bg-white/90">
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map(([value, count]) => (
                <SelectItem key={value} value={value}>
                  {formatCategory(value)} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <ShieldAlert className="size-4 text-amber-600" />
          <span>当前展示 {items.length} / {total} 条；品牌、真实人物或商用发布素材请先复核权利风险。</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center text-stone-500">
          <LoaderCircle className="mr-2 size-5 animate-spin" />
          正在读取图库
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-300 bg-white/60 text-center dark:border-white/10 dark:bg-stone-950/40">
          <ImageIcon className="size-8 text-stone-400" />
          <div>
            <div className="font-medium text-stone-800 dark:text-stone-100">没有找到匹配素材</div>
            <div className="mt-1 text-sm text-stone-500">换个关键词或清空筛选再试一次。</div>
          </div>
        </div>
      ) : (
        <>
          <div className={cn("columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5")}>
            {items.map((item) => (
              <div key={item.id} className="mb-3 break-inside-avoid">
                <SeedGalleryCard item={item} onUsePrompt={handleUsePrompt} onCopyPrompt={handleCopyPrompt} />
              </div>
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                className="rounded-2xl bg-white/80 px-6"
                disabled={isLoadingMore}
                onClick={() => void loadItems(offset, true)}
              >
                {isLoadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function GalleryPage() {
  return <GalleryBrowser />;
}

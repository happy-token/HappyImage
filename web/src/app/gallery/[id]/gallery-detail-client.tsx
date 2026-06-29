"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ImageIcon,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import webConfig from "@/constants/common-env";
import { fetchRelatedSeedGalleryItems, fetchSeedGalleryItem, type SeedGalleryItem } from "@/lib/api";
import { formatGalleryCategory } from "@/lib/gallery-categories";
import { saveGalleryPromptIntent } from "@/lib/gallery-intent";

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

function getRouteId(param: string | string[] | undefined) {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function DetailMeta({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return (
    <div className="rounded-md bg-stone-100/80 px-3 py-2 dark:bg-white/8">
      <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-stone-900 dark:text-stone-100">{value}</div>
    </div>
  );
}

function RelatedItemCard({ item }: { item: SeedGalleryItem }) {
  const imageUrl = getPreviewImageUrl(item);
  const href = `/gallery/${encodeURIComponent(item.id)}`;

  return (
    <Link
      href={href}
      className="group grid grid-cols-[86px_minmax(0,1fr)] overflow-hidden rounded-lg border border-stone-200/80 bg-white/78 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white dark:border-white/10 dark:bg-stone-950/62 dark:hover:bg-stone-900"
    >
      <div className="aspect-square bg-stone-100 dark:bg-stone-900">
        {imageUrl ? (
          <img src={imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <ImageIcon className="size-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-5 text-stone-950 dark:text-stone-50">{item.title}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{item.prompt}</div>
      </div>
    </Link>
  );
}

export function GalleryDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const id = useMemo(() => getRouteId(params.id), [params.id]);
  const [item, setItem] = useState<SeedGalleryItem | null>(null);
  const [relatedItems, setRelatedItems] = useState<SeedGalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadItem = async () => {
      if (!id) {
        setErrorMessage("图库素材地址无效");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      setRelatedItems([]);
      try {
        const data = await fetchSeedGalleryItem(id);
        if (!cancelled) {
          setItem(data.item);
        }
      } catch (error) {
        if (!cancelled) {
          setItem(null);
          setErrorMessage(error instanceof Error ? error.message : "读取图库素材失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadItem();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadRelated = async () => {
      if (!item?.id) {
        setRelatedItems([]);
        return;
      }
      try {
        const data = await fetchRelatedSeedGalleryItems(item.id, 4);
        if (!cancelled) {
          setRelatedItems(data.items);
        }
      } catch {
        if (!cancelled) {
          setRelatedItems([]);
        }
      }
    };
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [item]);

  const imageUrl = item ? getPrimaryImageUrl(item) : "";
  const image = item?.images[0];
  const aspectRatio = image?.width && image?.height ? `${image.width} / ${image.height}` : "1 / 1";
  const topTags = item?.tags.filter((tag) => tag !== item.category) || [];

  const handleUsePrompt = () => {
    if (!item) return;
    saveGalleryPromptIntent({
      prompt: item.prompt,
      sourceGalleryId: item.id,
      sourceKind: "seed",
      title: item.title,
      imageUrl: imageUrl || undefined,
    });
    router.push("/image");
  };

  const handleCopyPrompt = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.prompt);
      toast.success("提示词已复制");
    } catch {
      toast.error("复制失败，请手动选择提示词");
    }
  };

  if (isLoading) {
    return (
      <section className="mx-auto flex min-h-[520px] w-full max-w-[1180px] items-center justify-center px-0 pb-8 sm:px-3">
        <div className="inline-flex items-center rounded-lg border border-stone-200/80 bg-white/78 px-4 py-3 text-sm text-stone-500 shadow-sm dark:border-white/10 dark:bg-stone-950/62 dark:text-stone-400">
          <LoaderCircle className="mr-2 size-4 animate-spin" />
          正在读取提示词详情
        </div>
      </section>
    );
  }

  if (errorMessage || !item) {
    return (
      <section className="mx-auto flex min-h-[520px] w-full max-w-[1180px] items-center justify-center px-0 pb-8 sm:px-3">
        <div className="w-full max-w-md rounded-lg border border-stone-200/80 bg-white/82 p-5 text-center shadow-sm dark:border-white/10 dark:bg-stone-950/62">
          <ShieldAlert className="mx-auto size-7 text-amber-600" />
          <h1 className="mt-3 text-base font-semibold text-stone-950 dark:text-stone-50">没有找到这条灵感</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{errorMessage || "素材可能已下线或地址不完整。"}</p>
          <Button asChild className="mt-4 rounded-md">
            <Link href="/gallery">
              <ArrowLeft className="size-4" />
              返回灵感图库
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 px-0 pb-8 sm:px-3">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="rounded-md px-2 text-stone-600 dark:text-stone-300">
          <Link href="/gallery">
            <ArrowLeft className="size-4" />
            返回图库
          </Link>
        </Button>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
          <Sparkles className="size-4" />
          Happy Token 灵感图库
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="overflow-hidden rounded-lg border border-stone-200/80 bg-white/78 shadow-sm dark:border-white/10 dark:bg-stone-950/62">
          <div className="relative bg-stone-100 dark:bg-stone-900" style={{ aspectRatio }}>
            {imageUrl ? (
              <img src={imageUrl} alt={item.title} className="h-full w-full object-contain" />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-stone-400">
                <ImageIcon className="size-10" />
              </div>
            )}
          </div>
          <div className="grid gap-2 border-t border-stone-200/80 p-3 dark:border-white/10 sm:grid-cols-3">
            <DetailMeta label="分类" value={formatCategory(item.category)} />
            <DetailMeta label="来源" value={item.source_author || item.source_repo || "官方种子图库"} />
            <DetailMeta label="案例编号" value={item.case_no} />
          </div>
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border border-stone-200/80 bg-white/82 p-4 shadow-sm dark:border-white/10 dark:bg-stone-950/66 sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="rounded-md px-2 py-0.5">
                {formatCategory(item.category)}
              </Badge>
              {item.source_repo ? (
                <Badge variant="outline" className="rounded-md px-2 py-0.5">
                  {item.source_repo}
                </Badge>
              ) : null}
              {item.license ? (
                <Badge variant="info" className="rounded-md px-2 py-0.5">
                  {item.license}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-stone-950 dark:text-stone-50 sm:text-3xl">
              {item.title}
            </h1>
            {topTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {topTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-500 dark:bg-white/8 dark:text-stone-300">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-stone-800 dark:text-stone-100">提示词</div>
              <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-xs" onClick={handleCopyPrompt}>
                <Copy className="size-3.5" />
                复制
              </Button>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="w-full rounded-lg border border-stone-200/80 bg-stone-50/92 p-3 text-left text-sm leading-6 text-stone-700 shadow-inner transition hover:border-stone-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-white/10 dark:bg-white/6 dark:text-stone-200 dark:hover:bg-white/8"
              title="点击复制提示词"
            >
              {item.prompt}
            </button>
          </div>

          {item.negative_prompt ? (
            <div className="rounded-md bg-stone-100/80 px-3 py-2 text-xs leading-5 text-stone-500 dark:bg-white/8 dark:text-stone-400">
              <span className="font-medium text-stone-700 dark:text-stone-200">负向提示词：</span>
              {item.negative_prompt}
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-10 rounded-md" onClick={handleUsePrompt}>
                生成同款
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="h-10 rounded-md" onClick={handleCopyPrompt}>
                <Copy className="size-4" />
                复制提示词
              </Button>
            </div>
            <Button asChild variant="ghost" className="rounded-md text-stone-500">
              <Link href="/gallery">
                <ArrowLeft className="size-4" />
                返回灵感图库
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      {relatedItems.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-stone-950 dark:text-stone-50">相关灵感</h2>
            <Link href="/gallery" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">
              浏览图库
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {relatedItems.map((relatedItem) => (
              <RelatedItemCard key={relatedItem.id} item={relatedItem} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

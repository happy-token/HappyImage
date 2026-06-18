"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  LoaderCircle,
  Save,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateUserGallerySharePrompt,
  saveShareDraft,
  summarizeUserGalleryItem,
  type GalleryTextPayload,
} from "@/lib/api";

import type { UserGalleryItem } from "./user-gallery-adapter";

type UserGalleryDetailDrawerProps = {
  item: UserGalleryItem | null;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildDefaultTags(item: UserGalleryItem) {
  return [item.model, item.size, item.quality].filter(Boolean).join(", ");
}

function buildGalleryTextPayload(item: UserGalleryItem, imageUrl: string): GalleryTextPayload {
  return {
    conversation_id: item.conversationId,
    conversation_title: item.conversationTitle,
    original_prompt: item.originalPrompt,
    image_url: imageUrl,
    model: item.model,
    size: item.size,
    quality: item.quality,
  };
}

export function UserGalleryDetailDrawer({
  item,
  onClose,
  onUsePrompt,
}: UserGalleryDetailDrawerProps) {
  const itemId = item?.id ?? null;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const lastInitializedItemIdRef = useRef<string | null>(null);
  const currentItemIdRef = useRef<string | null>(null);
  const isDrawerOpenRef = useRef(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [conversationSummary, setConversationSummary] = useState("");
  const [sharePrompt, setSharePrompt] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingSharePrompt, setIsGeneratingSharePrompt] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const restorePreviousFocus = () => {
    const element = previousFocusedElementRef.current;
    if (element && document.contains(element)) {
      element.focus();
    }
    previousFocusedElementRef.current = null;
  };

  useEffect(() => {
    currentItemIdRef.current = itemId;
    if (!itemId) {
      currentItemIdRef.current = null;
      lastInitializedItemIdRef.current = null;
      if (isDrawerOpenRef.current) {
        isDrawerOpenRef.current = false;
        restorePreviousFocus();
      }
      return;
    }

    if (!isDrawerOpenRef.current) {
      previousFocusedElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      isDrawerOpenRef.current = true;
    }

    window.setTimeout(() => {
      if (currentItemIdRef.current === itemId) {
        closeButtonRef.current?.focus();
      }
    }, 0);
  }, [itemId]);

  useEffect(() => {
    return () => {
      if (isDrawerOpenRef.current) {
        isDrawerOpenRef.current = false;
        restorePreviousFocus();
      }
    };
  }, []);

  useEffect(() => {
    if (!item || !itemId || lastInitializedItemIdRef.current === itemId) {
      return;
    }
    lastInitializedItemIdRef.current = itemId;
    setTitle(item.conversationTitle || "未命名作品");
    setCategory("");
    setTags(buildDefaultTags(item));
    setConversationSummary("");
    setSharePrompt(item.revisedPrompt || item.originalPrompt);
    setIsSummarizing(false);
    setIsGeneratingSharePrompt(false);
    setIsSavingDraft(false);
    setCopiedPrompt(false);
  }, [itemId]);

  useEffect(() => {
    if (!itemId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [itemId, onClose]);

  const textPayload = useMemo(
    () => (item?.shareableImageUrl ? buildGalleryTextPayload(item, item.shareableImageUrl) : null),
    [item],
  );

  if (!item) {
    return null;
  }

  const shareUnavailableMessage =
    "这张图只保存在本地/旧格式中，暂不能整理为分享草稿；请重新生成或使用已落盘图片。";
  const canUseShareDraftActions = Boolean(item.shareableImageUrl && textPayload);

  const handleCopyOriginalPrompt = async () => {
    try {
      await navigator.clipboard.writeText(item.originalPrompt);
      setCopiedPrompt(true);
      toast.success("原始提示词已复制");
      window.setTimeout(() => setCopiedPrompt(false), 1400);
    } catch {
      toast.error("复制失败，请手动选择提示词");
    }
  };

  const handleUsePrompt = () => {
    onUsePrompt(item.originalPrompt);
  };

  const handleSummarize = async () => {
    if (!textPayload) {
      toast.info(shareUnavailableMessage);
      return;
    }
    const requestItemId = item.id;
    setIsSummarizing(true);
    try {
      const result = await summarizeUserGalleryItem(textPayload);
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      setConversationSummary(result.summary || "");
      toast.success("已生成对话摘要");
    } catch (error) {
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      toast.error(getErrorMessage(error, "生成对话摘要失败"));
    } finally {
      if (currentItemIdRef.current === requestItemId) {
        setIsSummarizing(false);
      }
    }
  };

  const handleGenerateSharePrompt = async () => {
    if (!textPayload) {
      toast.info(shareUnavailableMessage);
      return;
    }
    const requestItemId = item.id;
    setIsGeneratingSharePrompt(true);
    try {
      const result = await generateUserGallerySharePrompt({
        ...textPayload,
        conversation_summary: conversationSummary,
      });
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      setSharePrompt(result.share_prompt || sharePrompt);
      toast.success("已生成分享提示词");
    } catch (error) {
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      toast.error(getErrorMessage(error, "生成分享提示词失败"));
    } finally {
      if (currentItemIdRef.current === requestItemId) {
        setIsGeneratingSharePrompt(false);
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!item.shareableImageUrl) {
      toast.info(shareUnavailableMessage);
      return;
    }
    const requestItemId = item.id;
    setIsSavingDraft(true);
    try {
      await saveShareDraft({
        source: "user_gallery",
        image_url: item.shareableImageUrl,
        conversation_id: item.conversationId,
        turn_id: item.turnId,
        image_id: item.imageId,
        original_prompt: item.originalPrompt,
        conversation_summary: conversationSummary,
        share_prompt: sharePrompt,
        title: title.trim() || item.conversationTitle || "未命名作品",
        category: category.trim() || undefined,
        tags: parseTags(tags),
        status: "draft",
      });
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      toast.success("已保存为分享草稿");
    } catch (error) {
      if (currentItemIdRef.current !== requestItemId) {
        return;
      }
      toast.error(getErrorMessage(error, "保存分享草稿失败"));
    } finally {
      if (currentItemIdRef.current === requestItemId) {
        setIsSavingDraft(false);
      }
    }
  };

  return (
    <aside
      aria-label="我的图库详情"
      aria-modal="false"
      role="dialog"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-stone-200 bg-white shadow-2xl sm:w-[440px]"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-stone-950">
            作品详情
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            整理为分享草稿，不会发布到官方图库。
          </p>
        </div>
        <Button
          ref={closeButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="关闭作品详情"
          className="size-8 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(120,113,108,.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          <img
            src={item.imageUrl}
            alt="选中的我的图库作品预览"
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="mt-4 space-y-4">
          {!canUseShareDraftActions ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {shareUnavailableMessage}
            </p>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-600">标题</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
              placeholder="给这张图起个标题"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-600">分类</span>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                placeholder="例如：人像"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-600">标签</span>
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                placeholder="用逗号分隔"
              />
            </label>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-stone-600">原始提示词</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-stone-200 bg-white text-stone-700"
                onClick={handleCopyOriginalPrompt}
              >
                {copiedPrompt ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                复制
              </Button>
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-700">
              {item.originalPrompt}
            </div>
            <Button
              type="button"
              className="h-9 w-full rounded-md bg-stone-950 text-white hover:bg-stone-800"
              onClick={handleUsePrompt}
            >
              <WandSparkles className="size-4" />
              用这个提示词继续创作
            </Button>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-stone-600">对话摘要</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-stone-200 bg-white text-stone-700"
                onClick={handleSummarize}
                disabled={!canUseShareDraftActions || isSummarizing}
              >
                {isSummarizing ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                生成
              </Button>
            </div>
            <Textarea
              value={conversationSummary}
              onChange={(event) => setConversationSummary(event.target.value)}
              className="min-h-28 rounded-lg border-stone-200 bg-white text-sm shadow-none"
              placeholder="补充这张图的创作背景、修改方向或亮点"
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-stone-600">分享提示词</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-stone-200 bg-white text-stone-700"
                onClick={handleGenerateSharePrompt}
                disabled={!canUseShareDraftActions || isGeneratingSharePrompt}
              >
                {isGeneratingSharePrompt ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                生成
              </Button>
            </div>
            <Textarea
              value={sharePrompt}
              onChange={(event) => setSharePrompt(event.target.value)}
              className="min-h-36 rounded-lg border-stone-200 bg-white text-sm shadow-none"
              placeholder="适合分享给其他人复用的提示词"
            />
          </section>
        </div>
      </div>

      <footer className="shrink-0 border-t border-stone-200 bg-white px-4 py-3">
        <Button
          type="button"
          className="h-10 w-full rounded-md bg-stone-950 text-white hover:bg-stone-800"
          onClick={handleSaveDraft}
          disabled={!canUseShareDraftActions || isSavingDraft}
        >
          {isSavingDraft ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          保存为分享草稿
        </Button>
      </footer>
    </aside>
  );
}

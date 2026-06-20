"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Check, Clock3, Copy, Download, EyeOff, FolderOpen, LoaderCircle, Maximize2, Pencil, RotateCcw, Sparkles, Stamp, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetchAuthenticatedImageBlob } from "@/components/authenticated-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createImageAccessLink } from "@/lib/api";
import type { ImageFeedbackVote } from "@/lib/api";
import { buildWatermarkedFilename, createTextWatermarkedBlob, triggerBlobDownload } from "@/lib/watermark-image";
import type { ImageConversation, ImageTurnStatus, StoredImage, StoredReferenceImage } from "@/store/image-conversations";

export type ImageLightboxItem = {
  id: string;
  src: string;
  sizeLabel?: string;
  dimensions?: string;
  watermarkText?: string;
};

type ImageResultsProps = {
  selectedConversation: ImageConversation | null;
  currentUserId: string;
  watermarkLabel: string;
  watermarkUnlocked: boolean;
  onOpenLightbox: (images: ImageLightboxItem[], index: number) => void;
  onContinueEdit: (conversationId: string, image: StoredImage | StoredReferenceImage) => void;
  onDeletePrompt: (conversationId: string, turnId: string) => void;
  onDeleteResults: (conversationId: string, turnId: string) => void;
  onReuseTurnConfig: (conversationId: string, turnId: string) => void | Promise<void>;
  onRegenerateTurn: (conversationId: string, turnId: string) => void | Promise<void>;
  onRetryImage: (conversationId: string, turnId: string, imageId: string) => void | Promise<void>;
  onImageFeedback: (conversationId: string, turnId: string, imageId: string, taskId: string, vote: ImageFeedbackVote) => void | Promise<void>;
  onTimeoutRetryContinue: (taskId: string) => void | Promise<void>;
  onDismissErrors: (conversationId: string, turnId: string) => void | Promise<void>;
  formatConversationTime: (value: string) => string;
};

type DownloadChoice = "original" | "watermark";
type DownloadLocation = "default" | "choose";
type PendingDownload = { image: StoredImage; index: number } | null;

type FileSavePicker = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

// Blob URL 缓存：避免 base64 超长字符串在 DOM 中，改用短小的 blob: URL
const b64BlobUrlCache = new Map<string, string>();
const authenticatedBlobUrlCache = new Map<string, string>();

function isDirectImageSource(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function getStoredImageSrc(image: StoredImage) {
  if (image.b64_json) {
    let url = b64BlobUrlCache.get(image.b64_json);
    if (!url) {
      const binary = atob(image.b64_json);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      url = URL.createObjectURL(blob);
      b64BlobUrlCache.set(image.b64_json, url);
    }
    return url;
  }
  return image.url || "";
}

async function resolveDisplayImageSrc(src: string) {
  if (!src || isDirectImageSource(src)) {
    return src;
  }
  const cached = authenticatedBlobUrlCache.get(src);
  if (cached) {
    return cached;
  }
  const blob = await fetchAuthenticatedImageBlob(src);
  const objectUrl = URL.createObjectURL(blob);
  authenticatedBlobUrlCache.set(src, objectUrl);
  return objectUrl;
}

async function getStoredImageBlob(image: StoredImage) {
  if (image.b64_json) {
    const binary = atob(image.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  if (!image.url) {
    return null;
  }

  return fetchAuthenticatedImageBlob(image.url);
}

async function saveBlobToChosenLocation(blob: Blob, filename: string) {
  const picker = (window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSavePicker>;
  }).showSaveFilePicker;

  if (!picker) {
    throw new Error("当前浏览器不支持选择保存位置，将使用默认下载目录。");
  }

  const handle = await picker({
    suggestedName: filename,
    types: [
      {
        description: "PNG 图片",
        accept: { "image/png": [".png"] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function showDownloadStartedToast(filename: string, location: DownloadLocation) {
  toast.success(location === "choose" ? "下载已完成" : "下载已开始", {
    description: location === "choose" ? `${filename} 已保存到你选择的位置。` : `${filename} 将保存到浏览器默认下载目录。`,
  });
}

function buildUserWatermarkText(watermarkLabel: string, currentUserId: string) {
  const label = watermarkLabel.trim();
  const userId = currentUserId.trim();
  if (!label && (!userId || userId === "guest" || userId.startsWith("guest:"))) {
    return "HappyImage";
  }
  return label && userId ? `${label} · ${userId}` : label;
}

async function prepareDownloadBlob(
  image: StoredImage,
  index: number,
  choice: DownloadChoice,
  watermarkLabel: string,
  currentUserId: string,
) {
  const baseFilename = `image-${index + 1}.png`;
  const blob = await getStoredImageBlob(image);
  if (!blob) {
    return null;
  }
  if (choice === "original") {
    return { blob, filename: baseFilename };
  }
  const watermarkText = buildUserWatermarkText(watermarkLabel, currentUserId);
  if (!watermarkText) {
    throw new Error("请先在左下角“我的”里设置水印标签，或登录后使用无水印导出。");
  }
  const watermarkedBlob = await createTextWatermarkedBlob(blob, watermarkText);
  return { blob: watermarkedBlob, filename: buildWatermarkedFilename(baseFilename) };
}

async function savePreparedDownload(blob: Blob, filename: string, location: DownloadLocation) {
  if (location === "choose") {
    await saveBlobToChosenLocation(blob, filename);
    return;
  }
  triggerBlobDownload(blob, filename);
}

async function copyTextToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("已复制");
  } catch {
    toast.error("复制失败，请手动复制");
  }
}

async function copyImageBlobToClipboard(blob: Blob) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("当前浏览器不支持直接复制图片，请使用下载。");
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" }),
    }),
  ]);
}

async function copyImageToClipboard(
  image: StoredImage,
  index: number,
  watermarkUnlocked: boolean,
  watermarkLabel: string,
  currentUserId: string,
) {
  const choice: DownloadChoice = watermarkUnlocked ? "original" : "watermark";
  try {
    const prepared = await prepareDownloadBlob(image, index, choice, watermarkLabel, currentUserId);
    if (!prepared) {
      toast.error("图片还没有准备好");
      return;
    }
    await copyImageBlobToClipboard(prepared.blob);
    toast.success(watermarkUnlocked ? "已复制原图" : "已复制带水印图片", {
      description: watermarkUnlocked ? "复制内容与无水印下载一致。" : "当前模式会自动复制带水印图片。",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "复制失败";
    if (!watermarkUnlocked) {
      toast.error(message);
      return;
    }
    if (!image.url) {
      toast.error(message);
      return;
    }
    try {
      const publicUrl = await createImageAccessLink(image.url);
      await navigator.clipboard.writeText(publicUrl || image.url);
      toast.warning("已复制图片链接", {
        description: "当前浏览器未能复制图片内容，已改为复制可打开链接。",
      });
    } catch {
      toast.error(message);
    }
  }
}

export function ImageResults({
  selectedConversation,
  currentUserId,
  watermarkLabel,
  watermarkUnlocked,
  onOpenLightbox,
  onContinueEdit,
  onDeletePrompt,
  onDeleteResults,
  onReuseTurnConfig,
  onRegenerateTurn,
  onRetryImage,
  onImageFeedback,
  onTimeoutRetryContinue,
  onDismissErrors,
  formatConversationTime,
}: ImageResultsProps) {
  const [imageDimensionsById, setImageDimensionsById] = useState<Record<string, string>>({});
  const [resolvedImageSrcById, setResolvedImageSrcById] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [pendingDownload, setPendingDownload] = useState<PendingDownload>(null);
  const [downloadChoice, setDownloadChoice] = useState<DownloadChoice>(watermarkUnlocked ? "original" : "watermark");
  const [downloadLocation, setDownloadLocation] = useState<DownloadLocation>("default");
  const [isDownloading, setIsDownloading] = useState(false);
  
  // 仅在存在 loading 图片时启动定时器，避免空闲时无谓重渲染
  const hasLoadingImages = selectedConversation?.turns.some(
    (turn) => !turn.resultsDeleted && turn.images.some((image) => image.status === "loading"),
  );
  useEffect(() => {
    if (!hasLoadingImages) return;
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [hasLoadingImages]);

  const updateImageDimensions = (id: string, width: number, height: number) => {
    const dimensions = formatImageDimensions(width, height);
    setImageDimensionsById((current) => (current[id] === dimensions ? current : { ...current, [id]: dimensions }));
  };

  const openDownloadDialog = (image: StoredImage, index: number) => {
    setPendingDownload({ image, index });
    setDownloadChoice(watermarkUnlocked ? "original" : "watermark");
    setDownloadLocation("default");
  };

  const handleConfirmDownload = async () => {
    if (!pendingDownload) {
      return;
    }
    if (downloadChoice === "original" && !watermarkUnlocked) {
      toast.info("当前模式需带水印下载", {
        description: "登录后可使用原图下载。",
      });
      return;
    }

    setIsDownloading(true);
    try {
      const prepared = await prepareDownloadBlob(
        pendingDownload.image,
        pendingDownload.index,
        downloadChoice,
        watermarkLabel,
        currentUserId,
      );
      if (!prepared) {
        return;
      }
      await savePreparedDownload(prepared.blob, prepared.filename, downloadLocation);
      showDownloadStartedToast(prepared.filename, downloadLocation);
      setPendingDownload(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "下载失败";
      if (downloadLocation === "choose" && message.includes("不支持选择保存位置")) {
        toast.warning(message);
        setDownloadLocation("default");
      } else {
        toast.error(message);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (!selectedConversation) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center text-center sm:min-h-[420px]">
        <div className="w-full max-w-4xl">
          <h1
            className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl md:text-5xl"
            style={{
              fontFamily: '"Palatino Linotype","Book Antiqua","URW Palladio L","Times New Roman",serif',
            }}
          >
            Turn ideas into images
          </h1>
          <p
            className="mx-auto mt-3 max-w-[280px] text-sm italic tracking-[0.01em] text-stone-500 sm:mt-4 sm:max-w-none sm:text-[15px]"
            style={{
              fontFamily: '"Palatino Linotype","Book Antiqua","URW Palladio L","Times New Roman",serif',
            }}
          >
            在同一窗口里保留本地历史与任务状态，并从已有结果图继续发起新的无状态编辑。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 sm:gap-9">
      <Dialog open={Boolean(pendingDownload)} onOpenChange={(open) => (!open ? setPendingDownload(null) : null)}>
        <DialogContent className="rounded-2xl border-white/80 bg-white p-5 dark:border-zinc-800 dark:bg-[#171717] sm:p-6">
          <DialogHeader>
            <DialogTitle>下载图片</DialogTitle>
            <DialogDescription>选择下载版本和保存位置。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDownloadChoice("original")}
                disabled={!watermarkUnlocked}
                className={cn(
                  "flex min-h-20 items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                  downloadChoice === "original"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  !watermarkUnlocked && "cursor-not-allowed opacity-55",
                )}
              >
                <Download className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">原图下载</span>
                  <span className={cn("mt-1 block text-xs leading-5", downloadChoice === "original" ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-500")}>
                    {watermarkUnlocked ? "下载无水印版本" : "登录后可用"}
                  </span>
                </span>
                {downloadChoice === "original" ? <Check className="ml-auto size-4 shrink-0" /> : null}
              </button>

              <button
                type="button"
                onClick={() => setDownloadChoice("watermark")}
                className={cn(
                  "flex min-h-20 items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                  downloadChoice === "watermark"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <Stamp className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">带水印下载</span>
                  <span className={cn("mt-1 block text-xs leading-5", downloadChoice === "watermark" ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-500")}>
                    使用水印标签和用户 ID
                  </span>
                </span>
                {downloadChoice === "watermark" ? <Check className="ml-auto size-4 shrink-0" /> : null}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDownloadLocation("default")}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition",
                  downloadLocation === "default"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <Download className="size-4" />
                默认下载目录
              </button>
              <button
                type="button"
                onClick={() => setDownloadLocation("choose")}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition",
                  downloadLocation === "choose"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <FolderOpen className="size-4" />
                选择保存位置
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-zinc-100 px-5 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => setPendingDownload(null)}
              disabled={isDownloading}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-zinc-900 px-5 text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              onClick={() => void handleConfirmDownload()}
              disabled={isDownloading}
            >
              {isDownloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
              下载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedConversation.turns.map((turn, turnIndex) => {
        const referenceLightboxImages = turn.referenceImages.map((image, index) => ({
          id: `${turn.id}-reference-${index}`,
          src: image.dataUrl,
        }));
        const successfulTurnImages = turn.images.flatMap((image) => {
          const src = image.status === "success" ? getStoredImageSrc(image) : "";
          const resolvedSrc = resolvedImageSrcById[image.id] || src;
          const watermarkText = !watermarkUnlocked ? buildUserWatermarkText(watermarkLabel, currentUserId) : undefined;
          return src
            ? [
                {
                  id: image.id,
                  src: resolvedSrc,
                  sizeLabel: image.b64_json ? formatBase64ImageSize(image.b64_json) : undefined,
                  dimensions: imageDimensionsById[image.id],
                  watermarkText,
                },
              ]
            : [];
        });

        return (
          <div key={turn.id} className="flex flex-col gap-4 sm:gap-5">
            {!turn.promptDeleted ? (
              <div className="group/prompt flex justify-end">
                <div className="max-w-[92%] sm:max-w-[78%]">
                  <div className="rounded-[22px] border border-zinc-200 bg-zinc-100 px-4 py-3 text-[14px] leading-6 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-[#242426] dark:text-zinc-100 sm:px-5 sm:py-3.5 sm:text-[15px] sm:leading-7">
                    <div className="text-right">{turn.prompt}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[12px] text-zinc-400 opacity-100 transition sm:opacity-0 sm:group-hover/prompt:opacity-100 sm:group-focus-within/prompt:opacity-100">
                    <span>{formatConversationTime(turn.createdAt)}</span>
                    <span className="hidden sm:inline">·</span>
                    <span>{turn.mode === "edit" ? "编辑图" : "文生图"}</span>
                    <span className="hidden sm:inline">·</span>
                    <span>{getTurnStatusLabel(turn.status)}</span>
                    <button
                      type="button"
                      onClick={() => void onReuseTurnConfig(selectedConversation.id, turn.id)}
                      className="inline-flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label="复用配置"
                      title="复用配置"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyTextToClipboard(turn.prompt)}
                      className="inline-flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label="复制提示词"
                      title="复制提示词"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePrompt(selectedConversation.id, turn.id)}
                      className="inline-flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-white/10"
                      aria-label="删除提示词记录"
                      title="删除提示词记录"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!turn.resultsDeleted ? (
              <div className="flex justify-start">
                <div className="w-full">
                  {turn.referenceImages.length > 0 ? (
                    <div className="mb-4 flex flex-col items-end">
                      <div className="mb-3 text-xs font-medium text-stone-500">本轮参考图</div>
                      <div className="flex flex-wrap justify-end gap-3">
                        {turn.referenceImages.map((image, index) => (
                          <div key={`${turn.id}-${image.name}-${index}`} className="group/ref flex flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenLightbox(referenceLightboxImages, index)}
                              className="group relative h-24 w-24 overflow-hidden border border-stone-200/80 bg-stone-100/60 text-left transition hover:border-stone-300"
                              aria-label={`预览参考图 ${image.name || index + 1}`}
                            >
                              <img
                                src={image.dataUrl}
                                alt={image.name || `参考图 ${index + 1}`}
                                className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                              />
                            </button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 rounded-full border-transparent bg-transparent text-zinc-400 opacity-100 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white sm:opacity-0 sm:group-hover/ref:opacity-100 sm:group-focus-within/ref:opacity-100"
                              onClick={() => onContinueEdit(selectedConversation.id, image)}
                              aria-label="加入编辑"
                              title="加入编辑"
                            >
                              <Sparkles className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 sm:mb-4 sm:gap-2 sm:text-xs">
                    <span>{turn.count} 张</span>
                    <span>·</span>
                    <span>{getTurnStatusLabel(turn.status)}</span>
                    {turn.status === "queued" ? (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">等待当前对话中的前序任务完成</span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-7">
                    {turn.images.map((image, index) => {
                      const imageSrc = image.status === "success" ? getStoredImageSrc(image) : "";
                      if (image.status === "success" && imageSrc) {
                        const currentIndex = successfulTurnImages.findIndex((item) => item.id === image.id);
                        const sizeLabel = image.b64_json ? formatBase64ImageSize(image.b64_json) : "";
                        const dimensions = imageDimensionsById[image.id];
                        const imageMeta = [sizeLabel, dimensions].filter(Boolean).join(" · ");
                        const feedbackVote = image.feedback?.vote ?? null;

                        return (
                          <div
                            key={image.id}
                            className="group/image"
                          >
                            <div className="relative overflow-hidden rounded-[28px]">
                              <LazyImage
                                src={imageSrc}
                                alt={`Generated result ${index + 1}`}
                                className="group block w-full cursor-zoom-in overflow-hidden bg-zinc-100 dark:bg-zinc-900"
                                onLoad={(event) => {
                                  updateImageDimensions(
                                    image.id,
                                    event.currentTarget.naturalWidth,
                                    event.currentTarget.naturalHeight,
                                  );
                                }}
                                onResolvedSrc={(resolvedSrc) => {
                                  setResolvedImageSrcById((current) =>
                                    current[image.id] === resolvedSrc ? current : { ...current, [image.id]: resolvedSrc },
                                  );
                                }}
                                onOpen={() => onOpenLightbox(successfulTurnImages, currentIndex)}
                              />
                              {!watermarkUnlocked ? (
                                <div className="pointer-events-none absolute right-4 bottom-4 rounded-xl border border-white/25 bg-zinc-950/55 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm sm:right-6 sm:bottom-6 sm:px-4 sm:py-2 sm:text-sm">
                                  {buildUserWatermarkText(watermarkLabel, currentUserId)}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex min-w-0 items-center gap-3 px-0.5 pt-3 text-[12px] text-zinc-400">
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 opacity-100 transition sm:opacity-0 sm:group-hover/image:opacity-100 sm:group-focus-within/image:opacity-100">
                                <span className="whitespace-nowrap">结果 {index + 1}</span>
                                {image.durationMs != null ? <span className="whitespace-nowrap">{formatDuration(image.durationMs)}</span> : null}
                                {imageMeta ? <span className="min-w-0 break-normal">{imageMeta}</span> : null}
                                <span className="whitespace-nowrap">生成 {formatConversationTime(turn.createdAt)}</span>
                              </div>
                              <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                                  onClick={() => void copyImageToClipboard(image, index, watermarkUnlocked, watermarkLabel, currentUserId)}
                                  aria-label="复制图片"
                                  title={watermarkUnlocked ? "复制原图" : "复制带水印图片"}
                                >
                                  <Copy className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-8 rounded-full shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white",
                                    feedbackVote === "like" ? "bg-zinc-100 text-zinc-950 dark:bg-white/10 dark:text-white" : "text-zinc-400",
                                  )}
                                  onClick={() =>
                                    image.taskId
                                      ? void onImageFeedback(selectedConversation.id, turn.id, image.id, image.taskId, "like")
                                      : toast.error("图片任务还没有准备好")
                                  }
                                  aria-label="喜欢"
                                  title={feedbackVote === "like" ? "取消喜欢" : "喜欢"}
                                >
                                  <ThumbsUp className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-8 rounded-full shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white",
                                    feedbackVote === "dislike" ? "bg-zinc-100 text-zinc-950 dark:bg-white/10 dark:text-white" : "text-zinc-400",
                                  )}
                                  onClick={() =>
                                    image.taskId
                                      ? void onImageFeedback(selectedConversation.id, turn.id, image.id, image.taskId, "dislike")
                                      : toast.error("图片任务还没有准备好")
                                  }
                                  aria-label="不喜欢"
                                  title={feedbackVote === "dislike" ? "取消不喜欢" : "不喜欢"}
                                >
                                  <ThumbsDown className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                                  onClick={() => onOpenLightbox(successfulTurnImages, currentIndex)}
                                  aria-label="放大预览"
                                  title="放大"
                                >
                                  <Maximize2 className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                                  onClick={() => onContinueEdit(selectedConversation.id, image)}
                                  aria-label="加入编辑"
                                  title="加入编辑"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                                  onClick={() => openDownloadDialog(image, index)}
                                  aria-label="下载"
                                  title="下载"
                                >
                                  <Download className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                                  onClick={() => void onRegenerateTurn(selectedConversation.id, turn.id)}
                                  aria-label="全部重新生成"
                                  title="全部重新生成"
                                >
                                  <RotateCcw className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full text-zinc-400 shadow-none hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                                  onClick={() => onDeleteResults(selectedConversation.id, turn.id)}
                                  aria-label="删除本轮结果"
                                  title="删除本轮结果"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (image.status === "error") {
                        const isTimeoutError = image.error?.includes("超时") && image.taskId;
                        return (
                          <div key={image.id} className="break-inside-avoid">
                            <div
                              className={cn(
                                "overflow-hidden rounded-xl border border-rose-200 bg-rose-50",
                                "aspect-square",
                                turn.ratio === "1:1" && "sm:aspect-square",
                                turn.ratio === "16:9" && "sm:aspect-video",
                                turn.ratio === "9:16" && "sm:aspect-[9/16]",
                                turn.ratio === "4:3" && "sm:aspect-[4/3]",
                                turn.ratio === "3:4" && "sm:aspect-[3/4]",
                              )}
                            >
                            <div className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 px-2 py-2 text-center text-[11px] leading-4 text-rose-600 sm:gap-3 sm:px-6 sm:py-8 sm:text-sm sm:leading-6">
                              <p className="font-medium">图片 {index + 1}/{turn.images.length}</p>
                              <span className="line-clamp-2 sm:line-clamp-none">{image.error || "生成失败"}</span>
                              <div className="flex items-center gap-2">
                                {isTimeoutError && (
                                  <button
                                    type="button"
                                    onClick={() => void onTimeoutRetryContinue(image.taskId!)}
                                    className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-600 shadow-sm transition hover:bg-emerald-200 sm:px-3 sm:text-xs"
                                  >
                                    继续等待
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void onRetryImage(selectedConversation.id, turn.id, image.id)}
                                  className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-rose-600 shadow-sm transition hover:bg-rose-100 sm:px-3 sm:text-xs"
                                >
                                  重新生成这一张
                                </button>
                              </div>
                            </div>
                            </div>
                            <div className="flex flex-col gap-1 px-0.5 py-1 text-[10px] sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-3 sm:py-3 sm:text-xs">
                              <div className="min-w-0 text-stone-500">
                                <span>结果 {index + 1}</span>
                                {image.durationMs != null ? <span className="text-stone-400 sm:ml-2">{formatDuration(image.durationMs)}</span> : null}
                                <span className="block text-transparent">-</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const imageTaskStatus = image.taskStatus || (turn.status === "queued" ? "queued" : "running");
                      const imageStatusLabel = imageTaskStatus === "queued" ? "排队中" : getProgressLabel(image.progress);
                      const showElapsed = imageTaskStatus === "running" && image.elapsedSecs != null;
                      const elapsedDisplay = showElapsed
                        ? formatElapsed(
                            image.elapsedUpdatedAt != null
                              ? image.elapsedSecs! + (currentTime - image.elapsedUpdatedAt!) / 1000
                              : image.elapsedSecs!,
                          )
                        : null;
                      return (
                        <div key={image.id} className="break-inside-avoid">
                          <div
                            className={cn(
                              "overflow-hidden rounded-xl border border-stone-200/80 bg-stone-100/80 relative",
                              turn.ratio === "1:1" && "aspect-square",
                              turn.ratio === "16:9" && "aspect-video",
                              turn.ratio === "9:16" && "aspect-[9/16]",
                              turn.ratio === "4:3" && "aspect-[4/3]",
                              turn.ratio === "3:4" && "aspect-[3/4]",
                            )}
                          >
                          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 py-3 text-center text-stone-500 sm:gap-3 sm:px-6 sm:py-8">
                            <div className="rounded-full bg-white p-2 shadow-sm sm:p-3">
                              {imageTaskStatus === "queued" ? (
                                <Clock3 className="size-4 sm:size-5" />
                              ) : (
                                <LoaderCircle className="size-4 animate-spin sm:size-5" />
                              )}
                            </div>
                            <p className="text-[11px] font-medium leading-4 sm:text-sm">
                              图片 {index + 1}/{turn.images.length}
                            </p>
                            <p className="text-[10px] leading-4 text-stone-400 sm:text-xs">
                              {imageStatusLabel}
                            </p>
                          </div>
                          </div>
                          {elapsedDisplay != null && (
                            <div className="px-0.5 py-1 text-[10px] text-stone-400 sm:px-3 sm:py-3 sm:text-xs">{elapsedDisplay}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {turn.status === "error" && turn.error ? (
                    <div className="mt-4 flex items-center justify-between border-l-2 border-zinc-300 bg-zinc-100/80 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      <span>{turn.error}</span>
                      <button
                        type="button"
                        onClick={() => void onDismissErrors(selectedConversation.id, turn.id)}
                        className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-300 hover:text-zinc-950 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                      >
                        <EyeOff className="size-3" />
                        忽略错误
                      </button>
                    </div>
                  ) : null}

                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function getTurnStatusLabel(status: ImageTurnStatus) {
  if (status === "queued") {
    return "排队中";
  }
  if (status === "generating") {
    return "处理中";
  }
  if (status === "success") {
    return "已完成";
  }
  return "失败";
}

const PROGRESS_LABELS: Record<string, string> = {
  getting_account: "确认可用账号",
  uploading: "上传图片",
  bootstrapping: "预热首页",
  getting_token: "获取 token",
  preparing_conversation: "准备会话",
  starting_generation: "启动生成",
  generating: "生成中",
  receiving_image: "接收图片中",
};

function getProgressLabel(progress?: string) {
  if (!progress) {
    return "生成中";
  }
  return PROGRESS_LABELS[progress] || "生成中";
}

function formatElapsed(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

const base64SizeCache = new Map<string, string>();
function formatBase64ImageSize(base64: string) {
  let cached = base64SizeCache.get(base64);
  if (cached !== undefined) return cached;
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);

  if (bytes >= 1024 * 1024) {
    cached = `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    cached = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    cached = `${bytes} B`;
  }
  base64SizeCache.set(base64, cached);
  return cached;
}

function formatImageDimensions(width: number, height: number) {
  return `${width} x ${height}`;
}

const LazyImage = memo(function LazyImage({ src, alt, className, onLoad, onResolvedSrc, onOpen }: {
  src: string;
  alt: string;
  className: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onResolvedSrc?: (src: string) => void;
  onOpen?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [displaySrc, setDisplaySrc] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const onResolvedSrcRef = useRef(onResolvedSrc);

  useEffect(() => {
    onResolvedSrcRef.current = onResolvedSrc;
  }, [onResolvedSrc]);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    void resolveDisplayImageSrc(src)
      .then((resolvedSrc) => {
        if (cancelled) return;
        setDisplaySrc(resolvedSrc);
        onResolvedSrcRef.current?.(resolvedSrc);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible, src]);

  return (
    <div ref={imgRef} className="relative">
      {isVisible && displaySrc && !loadFailed ? (
        <button
          type="button"
          onClick={onOpen}
          className={className}
        >
          <img
            src={displaySrc}
            alt={alt}
            className="block h-auto w-full object-contain transition duration-200 group-hover:brightness-90"
            onLoad={onLoad}
            onError={() => setLoadFailed(true)}
          />
        </button>
      ) : isVisible && loadFailed ? (
        <div className={`flex min-h-[200px] items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-400 sm:min-h-[280px] ${className}`}>
          图片无法加载
        </div>
      ) : (
        <div className={`animate-pulse rounded-xl bg-stone-100 min-h-[200px] sm:min-h-[280px] ${className}`} />
      )}
    </div>
  );
});

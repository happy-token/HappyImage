"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { ArrowDown, History, LogIn, LoaderCircle, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ImageComposer } from "@/app/image/components/image-composer";
import {
  ImageResults,
  type ImageLightboxItem,
} from "@/app/image/components/image-results";
import {
  ImageSidebar,
  type ImageWorkspaceMode,
} from "@/app/image/components/image-sidebar";
import { GalleryBrowser } from "@/app/gallery/gallery-browser";
import { UserGalleryPanel } from "@/app/image/components/user-gallery-panel";
import { AccountMenu } from "@/components/account-menu";
import { fetchAuthenticatedImageBlob } from "@/components/authenticated-image";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  createImageConversationTurn,
  createImageEditTask,
  createImageGenerationTask,
  deleteServerImageConversation,
  fetchImageConversations,
  fetchImageTasks,
  updateImageConversationResult,
  updateImageConversationTurn,
  updateImageTaskFeedback,
  updateUserProfile,
  upsertImageConversation,
  type ImageFeedbackVote,
  type ImageModel,
  type ImageTask,
} from "@/lib/api";
import { consumeGalleryPromptIntent } from "@/lib/gallery-intent";
import {
  getValidatedAuthSession,
  logoutCurrentSession,
} from "@/lib/auth-session";
import { promptRequiresReferenceImage } from "@/lib/prompt-reference";
import { useEffectiveLanguage } from "@/lib/language";
import { humanizeRequestError } from "@/lib/request";
import { cn } from "@/lib/utils";
import {
  getStoredAuthKey,
  normalizeModelProviders,
  setStoredAuthSession,
  type StoredAuthSession,
  type StoredUserPreferences,
} from "@/store/auth";
import {
  deleteImageConversation,
  getImageConversationStats,
  listImageConversations,
  renameImageConversation,
  saveImageConversation,
  saveImageConversations,
  type ImageConversation,
  type ImageConversationMode,
  type ImageTurn,
  type ImageTurnStatus,
  type StoredImage,
  type StoredReferenceImage,
} from "@/store/image-conversations";

const ACTIVE_CONVERSATION_STORAGE_KEY =
  "happytoken:image_active_conversation_id";
const IMAGE_RATIO_STORAGE_KEY = "happytoken:image_last_ratio";
const IMAGE_TIER_STORAGE_KEY = "happytoken:image_last_tier";
const IMAGE_QUALITY_STORAGE_KEY = "happytoken:image_last_quality";
const IMAGE_MODEL_STORAGE_KEY = "happytoken:image_last_model";
const IMAGE_COUNT_STORAGE_KEY = "happytoken:image_last_count";
const DEFAULT_IMAGE_COUNT = "1";
const DEFAULT_IMAGE_MODELS: ImageModel[] = [
  "gpt-image-2",
  "codex-gpt-image-2",
];
const SIDEBAR_WIDTH_STORAGE_KEY = "happytoken:image_sidebar_width";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "happytoken:image_sidebar_collapsed";

function toPreferencePayload(preferences: StoredUserPreferences) {
  return {
    theme: preferences.theme,
    language: preferences.language,
    image_ratio: preferences.imageRatio,
    image_tier: preferences.imageTier,
    image_quality: preferences.imageQuality,
    image_model: preferences.imageModel,
    sidebar_collapsed: preferences.sidebarCollapsed,
    sidebar_width: preferences.sidebarWidth,
  };
}
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 380;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;

const imagePageCopy = {
  "zh-CN": {
    login: "登录",
    resizeSidebar: "调整侧边栏宽度",
    dragResizeSidebar: "拖动调整侧边栏宽度",
  },
  "en-US": {
    login: "Sign in",
    resizeSidebar: "Resize sidebar",
    dragResizeSidebar: "Drag to resize sidebar",
  },
};

function scopedLocalStorageKey(baseKey: string, ownerId: string) {
  return `${baseKey}:${ownerId || "anonymous"}`;
}

function clampSidebarWidth(value: number) {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, value));
}
const SCROLL_POSITIONS_STORAGE_KEY = "happytoken:image_scroll_positions";
const SCROLL_TO_LATEST_THRESHOLD = 160;

function loadScrollPositions(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.sessionStorage.getItem(SCROLL_POSITIONS_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveScrollPositions(positions: Map<string, number>) {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = {};
    positions.forEach((value, key) => {
      obj[key] = value;
    });
    window.sessionStorage.setItem(
      SCROLL_POSITIONS_STORAGE_KEY,
      JSON.stringify(obj)
    );
  } catch {
    // sessionStorage may be full or unavailable
  }
}

function clampImageCount(value: string) {
  return String(Math.min(100, Math.max(1, Math.floor(Number(value) || 1))));
}
function parseImageSize(size: string) {
  const match = size.match(/^(\d+)x(\d+)$/);
  return match
    ? { width: match[1], height: match[2] }
    : { width: "1024", height: "1024" };
}

const ACTIVE_QUEUE_STALE_MS = 90_000;
const activeConversationQueueIds = new Map<string, number>();

function isConversationQueueActive(conversationId: string) {
  const startedAt = activeConversationQueueIds.get(conversationId);
  if (!startedAt) {
    return false;
  }
  if (Date.now() - startedAt > ACTIVE_QUEUE_STALE_MS) {
    activeConversationQueueIds.delete(conversationId);
    return false;
  }
  return true;
}
let pollAbortController: AbortController | null = null;

function getResultsDistanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function buildConversationTitle(prompt: string) {
  const trimmed = prompt.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }
  return `${trimmed.slice(0, 12)}...`;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取参考图失败"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType?: string) {
  const [header, content] = dataUrl.split(",", 2);
  const matchedMimeType = header.match(/data:(.*?);base64/)?.[1];
  const binary = atob(content || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, {
    type: mimeType || matchedMimeType || "image/png",
  });
}

function normalizeStoredImageModel(
  value: string | null,
  availableModels: ImageModel[]
): ImageModel {
  const normalized = String(value || "").trim();
  if (normalized && availableModels.includes(normalized)) {
    return normalized;
  }
  return availableModels[0] || "gpt-image-2";
}

function getSessionProviderImageModels(
  session: StoredAuthSession | null | undefined
): ImageModel[] {
  const providers = Array.isArray(session?.modelProviders)
    ? session.modelProviders
    : [];
  const selectedProvider =
    providers.find((provider) => provider.selected) ?? providers[0];
  const models = Array.isArray(selectedProvider?.models)
    ? selectedProvider.models
    : [];
  return models
    .map((model) => String(model || "").trim())
    .filter((model, index, list) => model && list.indexOf(model) === index);
}

function mergeImageModels(...groups: ImageModel[][]): ImageModel[] {
  const merged: ImageModel[] = [];
  groups.flat().forEach((model) => {
    if (model && !merged.includes(model)) {
      merged.push(model);
    }
  });
  return merged.length > 0 ? merged : [...DEFAULT_IMAGE_MODELS];
}

function buildReferenceImageFromResult(
  image: StoredImage,
  fileName: string
): StoredReferenceImage | null {
  if (!image.b64_json) {
    return null;
  }

  return {
    name: fileName,
    type: "image/png",
    dataUrl: `data:image/png;base64,${image.b64_json}`,
  };
}

async function fetchImageAsFile(url: string, fileName: string) {
  const blob = await fetchAuthenticatedImageBlob(url);
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

async function buildReferenceImageFromStoredImage(
  image: StoredImage,
  fileName: string
) {
  const direct = buildReferenceImageFromResult(image, fileName);
  if (direct) {
    return {
      referenceImage: direct,
      file: dataUrlToFile(direct.dataUrl, direct.name, direct.type),
    };
  }

  if (!image.url) {
    return null;
  }
  const file = await fetchImageAsFile(image.url, fileName);
  return {
    referenceImage: {
      name: file.name,
      type: file.type || "image/png",
      dataUrl: await readFileAsDataUrl(file),
    },
    file,
  };
}

function taskDataToStoredImage(
  image: StoredImage,
  task: ImageTask
): StoredImage {
  if (task.status === "success") {
    const first = task.data?.[0];
    if (!first?.b64_json && !first?.url) {
      return {
        ...image,
        taskId: task.id,
        status: "error",
        taskStatus: undefined,
        progress: undefined,
        error: "未返回图片数据",
      };
    }
    return {
      ...image,
      taskId: task.id,
      status: "success",
      taskStatus: undefined,
      progress: undefined,
      b64_json: first.b64_json,
      url: first.url,
      revised_prompt: first.revised_prompt,
      feedback: first.feedback,
      error: undefined,
      durationMs: task.duration_ms,
    };
  }

  if (task.status === "error") {
    return {
      ...image,
      taskId: task.id,
      status: "error",
      taskStatus: undefined,
      progress: undefined,
      error: humanizeRequestError(task.error || "生成失败"),
      durationMs: task.duration_ms,
    };
  }

  const newTaskStatus =
    task.status === "queued"
      ? "queued"
      : task.status === "running"
      ? "running"
      : image.taskStatus;
  const shouldSetStartTime = newTaskStatus === "running" && !image.startTime;
  const startTime = shouldSetStartTime ? Date.now() : image.startTime;
  // elapsedSecs 仅使用后端返回的值，确保计时从 image_stream_resolve_start 开始
  const elapsedSecs =
    newTaskStatus === "running" && typeof task.elapsed_secs === "number"
      ? task.elapsed_secs
      : undefined;

  return {
    ...image,
    taskId: task.id,
    status: "loading",
    taskStatus: newTaskStatus,
    progress: task.progress || image.progress,
    error: undefined,
    startTime,
    elapsedSecs,
    elapsedUpdatedAt: elapsedSecs != null ? Date.now() : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pickFallbackConversationId(conversations: ImageConversation[]) {
  const activeConversation = conversations.find((conversation) =>
    conversation.turns.some(
      (turn) => turn.status === "queued" || turn.status === "generating"
    )
  );
  return activeConversation?.id ?? conversations[0]?.id ?? null;
}

function sortImageConversations(conversations: ImageConversation[]) {
  return [...conversations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function deriveTurnStatus(
  turn: ImageTurn
): Pick<ImageTurn, "status" | "error"> {
  const loadingCount = turn.images.filter(
    (image) => image.status === "loading"
  ).length;
  const failedCount = turn.images.filter(
    (image) => image.status === "error"
  ).length;
  const successCount = turn.images.filter(
    (image) => image.status === "success"
  ).length;
  if (loadingCount > 0) {
    // 如果任何图片的 taskStatus 为 running，则状态为 generating
    const hasRunning = turn.images.some(
      (image) => image.taskStatus === "running"
    );
    if (hasRunning) {
      return { status: "generating", error: undefined };
    }
    return {
      status: turn.status === "queued" ? "queued" : "generating",
      error: undefined,
    };
  }
  if (failedCount > 0) {
    return { status: "error", error: `其中 ${failedCount} 张未成功生成` };
  }
  if (successCount > 0) {
    return { status: "success", error: undefined };
  }
  // 所有图片都被忽略（images 为空），视为完成
  return { status: "success", error: undefined };
}

async function syncConversationImageTasks(
  items: ImageConversation[],
  ownerId: string
) {
  const taskIds = Array.from(
    new Set(
      items.flatMap((conversation) =>
        conversation.turns.flatMap((turn) =>
          turn.resultsDeleted
            ? []
            : turn.images.flatMap((image) =>
                image.taskId ? [image.taskId] : []
              )
        )
      )
    )
  );
  if (taskIds.length === 0) {
    return items;
  }

  let taskList: Awaited<ReturnType<typeof fetchImageTasks>>;
  try {
    taskList = await fetchImageTasks(taskIds);
  } catch {
    return items;
  }
  const taskMap = new Map(taskList.items.map((task) => [task.id, task]));
  let changed = false;
  const normalized = items.map((conversation) => {
    const turns = conversation.turns.map((turn) => {
      let turnChanged = false;
      const images = turn.images.map((image) => {
        if (!image.taskId) {
          return image;
        }
        const task = taskMap.get(image.taskId);
        if (!task) {
          return image;
        }
        const nextImage = taskDataToStoredImage(image, task);
        if (nextImage !== image) {
          turnChanged = true;
        }
        return nextImage;
      });
      if (!turnChanged) {
        return turn;
      }
      changed = true;
      const derived = deriveTurnStatus({ ...turn, images });
      return {
        ...turn,
        ...derived,
        images,
      };
    });
    if (
      turns === conversation.turns ||
      !turns.some((turn, index) => turn !== conversation.turns[index])
    ) {
      return conversation;
    }
    return {
      ...conversation,
      turns,
      updatedAt: new Date().toISOString(),
    };
  });

  if (changed) {
    await saveImageConversations(normalized, ownerId);
  }
  return normalized;
}

async function recoverConversationHistory(
  items: ImageConversation[],
  ownerId: string
) {
  let changed = false;
  const normalized = items.map((conversation) => {
    const turns = conversation.turns.map((turn) => {
      if (
        turn.status !== "queued" &&
        turn.status !== "generating" &&
        turn.status !== "error"
      ) {
        return turn;
      }

      let turnChanged = false;
      const images = turn.images.map((image) => {
        if (image.status !== "loading" || image.taskId) {
          return image;
        }
        turnChanged = true;
        return {
          ...image,
          status: "error" as const,
          error: "页面刷新或任务中断，未找到可恢复的任务 ID",
        };
      });
      const derived = deriveTurnStatus({ ...turn, images });
      if (
        !turnChanged &&
        derived.status === turn.status &&
        derived.error === turn.error
      ) {
        return turn;
      }
      changed = true;
      return {
        ...turn,
        ...derived,
        images,
      };
    });

    if (!turns.some((turn, index) => turn !== conversation.turns[index])) {
      return conversation;
    }

    return {
      ...conversation,
      turns,
      updatedAt: new Date().toISOString(),
    };
  });

  if (changed) {
    await saveImageConversations(normalized, ownerId);
  }

  return syncConversationImageTasks(normalized, ownerId);
}

function parseWorkspaceMode(value: string | null): ImageWorkspaceMode | null {
  if (
    value === "compose" ||
    value === "official_gallery" ||
    value === "user_gallery"
  ) {
    return value;
  }
  return null;
}

function ImagePageContent({
  isAdmin,
  ownerId,
  session,
  onSessionUpdate,
}: {
  isAdmin: boolean;
  ownerId: string;
  session: StoredAuthSession | null;
  onSessionUpdate: (session: StoredAuthSession) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const language = useEffectiveLanguage();
  const copy = imagePageCopy[language];
  const conversationsRef = useRef<ImageConversation[]>([]);
  const loadCancelledRef = useRef(false);
  const loadHistoryInFlightRef = useRef(false);
  const didLoadGalleryPromptRef = useRef(false);
  const lastRouteIntentRef = useRef<string | null>(null);
  const skipNextHistoryConversationRestoreRef = useRef(false);
  const resultsViewportRef = useRef<HTMLDivElement>(null);
  const lastConversationIdRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(loadScrollPositions());
  const isRestoringScrollRef = useRef(false);
  const scrollRestoreGenerationRef = useRef(0);

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageCount, setImageCount] = useState(DEFAULT_IMAGE_COUNT);
  const [imageRatio, setImageRatio] = useState("auto");
  const [imageTier, setImageTier] = useState("1k");
  const [imageWidth, setImageWidth] = useState("1024");
  const [imageHeight, setImageHeight] = useState("1024");
  const [imageQuality, setImageQuality] = useState("auto");
  const [imageModel, setImageModel] = useState<ImageModel>(
    DEFAULT_IMAGE_MODELS[0]
  );
  const [imageModels, setImageModels] = useState<ImageModel[]>([
    ...DEFAULT_IMAGE_MODELS,
  ]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] =
    useState<ImageWorkspaceMode>("compose");
  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceImages, setReferenceImages] = useState<
    StoredReferenceImage[]
  >([]);
  const [conversations, setConversations] = useState<ImageConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const accountWidth = Number(session?.preferences?.sidebarWidth);
    if (Number.isFinite(accountWidth) && accountWidth > 0) {
      return clampSidebarWidth(accountWidth);
    }
    if (typeof window === "undefined") {
      return SIDEBAR_DEFAULT_WIDTH;
    }
    const storedWidth = Number(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    );
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampSidebarWidth(storedWidth)
      : SIDEBAR_DEFAULT_WIDTH;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    typeof session?.preferences?.sidebarCollapsed === "boolean"
      ? session.preferences.sidebarCollapsed
      : typeof window !== "undefined" &&
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1"
  );
  const isGuest = !session;
  const [watermarkLabel, setWatermarkLabel] = useState(
    session?.watermarkLabel ?? ""
  );
  const [watermarkUnlocked, setWatermarkUnlocked] = useState(true);
  const [lightboxImages, setLightboxImages] = useState<ImageLightboxItem[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollToLatestBtnRef = useRef<HTMLButtonElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { type: "one"; id: string }
    | { type: "prompt"; conversationId: string; turnId: string }
    | { type: "results"; conversationId: string; turnId: string }
    | null
  >(null);
  const parsedCount = useMemo(
    () => Number(clampImageCount(imageCount)),
    [imageCount]
  );
  const selectedConversation = useMemo(
    () =>
      conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const activeTaskCount = useMemo(
    () =>
      conversations.reduce((sum, conversation) => {
        const stats = getImageConversationStats(conversation);
        return sum + stats.queued + stats.running;
      }, 0),
    [conversations]
  );
  const accountUsageStats = useMemo(() => {
    let turnCount = 0;
    let generatedImageCount = 0;
    let likedImageCount = 0;
    let dislikedImageCount = 0;
    let latestActivity = "";

    for (const conversation of conversations) {
      if (
        !latestActivity ||
        conversation.updatedAt.localeCompare(latestActivity) > 0
      ) {
        latestActivity = conversation.updatedAt;
      }
      for (const turn of conversation.turns) {
        if (!turn.promptDeleted) {
          turnCount += 1;
        }
        if (!turn.resultsDeleted) {
          for (const image of turn.images) {
            if (image.status === "success" && (image.url || image.b64_json)) {
              generatedImageCount += 1;
            }
            if (image.feedback?.vote === "like") {
              likedImageCount += 1;
            } else if (image.feedback?.vote === "dislike") {
              dislikedImageCount += 1;
            }
          }
        }
      }
    }

    return {
      conversationCount: conversations.length,
      turnCount,
      generatedImageCount,
      activeTaskCount,
      likedImageCount,
      dislikedImageCount,
      lastActivityLabel: latestActivity
        ? formatConversationTime(latestActivity)
        : "",
    };
  }, [activeTaskCount, conversations]);
  const deleteConfirmTitle =
    deleteConfirm?.type === "prompt"
      ? "删除提示词记录"
      : deleteConfirm?.type === "results"
      ? "删除生成结果"
      : deleteConfirm?.type === "one"
      ? "删除对话"
      : "";
  const deleteConfirmDescription =
    deleteConfirm?.type === "prompt"
      ? "确认删除这条提示词记录吗？对应生成结果会保留。"
      : deleteConfirm?.type === "results"
      ? "确认删除这条生成结果吗？对应提示词记录会保留。"
      : deleteConfirm?.type === "one"
      ? "确认删除这条图片对话吗？删除后无法恢复。"
      : "";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(sidebarWidth)
    );
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isSidebarCollapsed ? "1" : "0"
    );
  }, [isSidebarCollapsed]);

  const handleSidebarResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isSidebarCollapsed) {
        return;
      }
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setSidebarWidth(
          clampSidebarWidth(startWidth + moveEvent.clientX - startX)
        );
      };
      const handlePointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [isSidebarCollapsed, sidebarWidth]
  );

  const handleLogout = useCallback(async () => {
    const redirectedToProvider = await logoutCurrentSession();
    if (redirectedToProvider) {
      return;
    }
    router.replace("/login");
  }, [router]);

  const handleSaveWatermarkLabel = useCallback(
    async (nextLabel: string) => {
      if (!session) {
        toast.info("登录后可以设置水印标签");
        return;
      }
      const data = await updateUserProfile({ watermark_label: nextLabel });
      const updatedLabel =
        data.user?.watermark_label ?? data.watermark_label ?? nextLabel;
      const updatedUnlocked =
        data.user?.watermark_unlocked ??
        data.watermark_unlocked ??
        watermarkUnlocked;
      setWatermarkLabel(updatedLabel);
      setWatermarkUnlocked(Boolean(updatedUnlocked));
      await setStoredAuthSession({
        ...session,
        watermarkLabel: updatedLabel,
        watermarkUnlocked: Boolean(updatedUnlocked),
        modelProvider:
          data.user?.model_provider ??
          data.model_provider ??
          session.modelProvider ??
          "",
        modelBaseUrl:
          data.user?.model_base_url ??
          data.model_base_url ??
          session.modelBaseUrl ??
          "",
        modelApiKeyConfigured:
          data.user?.model_api_key_configured ??
          data.model_api_key_configured ??
          session.modelApiKeyConfigured ??
          false,
        modelGatewayEnabled:
          data.user?.model_gateway_enabled ??
          data.model_gateway_enabled ??
          session.modelGatewayEnabled ??
          false,
        modelProviders: normalizeModelProviders(
          data.user?.model_providers ??
            data.model_providers ??
            session.modelProviders ??
            []
        ),
        preferences: session.preferences,
      });
    },
    [session, watermarkUnlocked]
  );

  const clearComposerInputs = useCallback(() => {
    setImagePrompt("");
    setReferenceImageFiles([]);
    setReferenceImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const loadPromptIntoCleanDraft = useCallback(
    (
      prompt: string,
      successMessage?: string,
      options: { skipHistoryConversationRestore?: boolean } = {}
    ) => {
      if (options.skipHistoryConversationRestore) {
        skipNextHistoryConversationRestoreRef.current = true;
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(
          scopedLocalStorageKey(ACTIVE_CONVERSATION_STORAGE_KEY, ownerId)
        );
      }
      setWorkspaceMode("compose");
      setSelectedConversationId(null);
      clearComposerInputs();
      setImagePrompt(prompt);
      if (successMessage) {
        toast.success(successMessage);
      }
      window.setTimeout(() => textareaRef.current?.focus(), 80);
    },
    [clearComposerInputs, ownerId]
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (didLoadGalleryPromptRef.current) {
      return;
    }
    didLoadGalleryPromptRef.current = true;
    const intent = consumeGalleryPromptIntent();
    if (!intent) {
      return;
    }
    loadPromptIntoCleanDraft(
      intent.prompt,
      `已载入图库提示词${intent.title ? `：${intent.title.slice(0, 24)}` : ""}`,
      { skipHistoryConversationRestore: true }
    );
  }, [loadPromptIntoCleanDraft]);

  const scrollResultsToLatest = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const element = resultsViewportRef.current;
      if (!element) {
        return;
      }

      shouldStickToBottomRef.current = true;
      const btn = scrollToLatestBtnRef.current;
      if (btn) btn.style.display = "none";
      element.scrollTo({
        top: element.scrollHeight,
        behavior,
      });
    },
    []
  );

  const handleResultsScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      return;
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const element = resultsViewportRef.current;
      if (!element) {
        return;
      }

      // 恢复滚动位置期间不处理滚动事件
      if (isRestoringScrollRef.current) {
        return;
      }

      // 保存当前会话的滚动位置（debounce 300ms 写入 sessionStorage）
      const convId = lastConversationIdRef.current;
      if (convId) {
        scrollPositionsRef.current.set(convId, element.scrollTop);
        if (scrollSaveTimerRef.current)
          clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = setTimeout(() => {
          scrollSaveTimerRef.current = null;
          saveScrollPositions(scrollPositionsRef.current);
        }, 300);
      }

      const isAwayFromLatest =
        getResultsDistanceFromBottom(element) > SCROLL_TO_LATEST_THRESHOLD;
      shouldStickToBottomRef.current = !isAwayFromLatest;
      // 直接操作 DOM 控制按钮显隐，避免 setState 触发全组件重渲染
      const btn = scrollToLatestBtnRef.current;
      if (btn) {
        if (isAwayFromLatest) {
          btn.style.display = "";
        } else {
          btn.style.display = "none";
        }
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
      if (scrollSaveTimerRef.current !== null) {
        clearTimeout(scrollSaveTimerRef.current);
        saveScrollPositions(scrollPositionsRef.current);
      }
    };
  }, []);

  const loadServerConversations = useCallback(async () => {
    if (isGuest) {
      return null;
    }

    try {
      const data = await fetchImageConversations();
      const items = sortImageConversations(data.items);
      await saveImageConversations(items, ownerId);
      return items;
    } catch {
      return null;
    }
  }, [isGuest, ownerId]);

  const loadHistory = useCallback(async () => {
    let consumedHistoryRestoreSkip = false;
    loadHistoryInFlightRef.current = true;
    try {
      const storedRatio =
        session?.preferences?.imageRatio ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(IMAGE_RATIO_STORAGE_KEY)
          : null);
      const storedTier =
        session?.preferences?.imageTier ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(IMAGE_TIER_STORAGE_KEY)
          : null);
      const storedQuality =
        session?.preferences?.imageQuality ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(IMAGE_QUALITY_STORAGE_KEY)
          : null);
      setImageRatio(storedRatio || "1:1");
      setImageTier(storedTier || "1k");
      setImageWidth("1024");
      setImageHeight("1024");
      setImageQuality(storedQuality || "auto");
      setImageCount(DEFAULT_IMAGE_COUNT);
      window.localStorage.removeItem(IMAGE_COUNT_STORAGE_KEY);

      const cachedItems = await listImageConversations(ownerId);
      const serverItems = await loadServerConversations();
      const normalizedItems =
        serverItems ?? (await recoverConversationHistory(cachedItems, ownerId));
      if (loadCancelledRef.current) {
        return;
      }

      conversationsRef.current = normalizedItems;
      setConversations(normalizedItems);
      if (skipNextHistoryConversationRestoreRef.current) {
        skipNextHistoryConversationRestoreRef.current = false;
        consumedHistoryRestoreSkip = true;
        setSelectedConversationId(null);
        return;
      }
      const storedConversationId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(
              scopedLocalStorageKey(ACTIVE_CONVERSATION_STORAGE_KEY, ownerId)
            )
          : null;
      const nextSelectedConversationId =
        (storedConversationId &&
        normalizedItems.some(
          (conversation) => conversation.id === storedConversationId
        )
          ? storedConversationId
          : null) ?? pickFallbackConversationId(normalizedItems);
      setSelectedConversationId(nextSelectedConversationId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "读取会话记录失败";
      toast.error(message);
    } finally {
      loadHistoryInFlightRef.current = false;
      if (!consumedHistoryRestoreSkip) {
        skipNextHistoryConversationRestoreRef.current = false;
      }
      if (!loadCancelledRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [
    loadServerConversations,
    ownerId,
    session?.preferences?.imageQuality,
    session?.preferences?.imageRatio,
    session?.preferences?.imageTier,
    setImageRatio,
    setImageTier,
    setImageWidth,
    setImageHeight,
    setImageQuality,
    setImageCount,
    setConversations,
    setSelectedConversationId,
    setIsLoadingHistory,
  ]);

  // Handle bfcache (back/forward cache) — re-sync task status on page restore
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void loadHistory();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadHistory]);

  useEffect(() => {
    loadCancelledRef.current = false;
    void loadHistory();
    return () => {
      loadCancelledRef.current = true;
      // 组件卸载时保存当前滚动位置到 sessionStorage
      const element = resultsViewportRef.current;
      const convId = lastConversationIdRef.current;
      if (element && convId) {
        scrollPositionsRef.current.set(convId, element.scrollTop);
        saveScrollPositions(scrollPositionsRef.current);
      }
      activeConversationQueueIds.clear();
      if (pollAbortController) {
        pollAbortController.abort();
        pollAbortController = null;
      }
    };
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;

    const loadImageModels = async () => {
      const providerModels = getSessionProviderImageModels(session);
      const available = mergeImageModels(providerModels, DEFAULT_IMAGE_MODELS);
      const storedModel =
        session?.preferences?.imageModel ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(IMAGE_MODEL_STORAGE_KEY)
          : null);

      await Promise.resolve();
      if (cancelled) {
        return;
      }

      setImageModels(available);
      setImageModel((current) => {
        if (storedModel && available.includes(storedModel)) {
          return storedModel;
        }
        if (available.includes(current)) {
          return current;
        }
        return normalizeStoredImageModel(storedModel, available);
      });
    };

    void loadImageModels();
    return () => {
      cancelled = true;
    };
  }, [session, session?.preferences?.imageModel]);

  // 切换会话时保存旧会话滚动位置，并隐藏容器防止闪烁
  useLayoutEffect(() => {
    if (workspaceMode !== "compose") {
      return;
    }

    if (!selectedConversation) {
      lastConversationIdRef.current = null;
      shouldStickToBottomRef.current = true;
      const btn = scrollToLatestBtnRef.current;
      if (btn) btn.style.display = "none";
      return;
    }

    const element = resultsViewportRef.current;
    if (!element) {
      return;
    }

    const didSwitchConversation =
      lastConversationIdRef.current !== selectedConversation.id;

    if (didSwitchConversation) {
      // 递增 generation，使之前未完成的 rAF 回调失效
      scrollRestoreGenerationRef.current += 1;

      // 先保存旧会话的滚动位置（lastConversationIdRef 还是旧值）
      const oldConvId = lastConversationIdRef.current;
      if (oldConvId) {
        scrollPositionsRef.current.set(oldConvId, element.scrollTop);
        saveScrollPositions(scrollPositionsRef.current);
      }
      // 更新为新会话 ID
      lastConversationIdRef.current = selectedConversation.id;
    }

    // 如果有保存的滚动位置，隐藏容器防止用户看到 scrollTop=0 的内容
    const savedScrollTop = scrollPositionsRef.current.get(
      selectedConversation.id
    );
    if (savedScrollTop != null && savedScrollTop > 0) {
      element.style.visibility = "hidden";
      isRestoringScrollRef.current = true;
    }
  }, [selectedConversation?.id, workspaceMode]);

  // 恢复滚动位置或跟随最新内容
  useEffect(() => {
    if (workspaceMode !== "compose") {
      return;
    }

    if (!selectedConversation) {
      return;
    }

    const element = resultsViewportRef.current;
    if (!element) {
      return;
    }

    const savedScrollTop = scrollPositionsRef.current.get(
      selectedConversation.id
    );

    if (savedScrollTop != null && savedScrollTop > 0) {
      // 捕获当前 generation，用于检测是否已被新的切换取代
      const generation = scrollRestoreGenerationRef.current;
      // 容器已在 useLayoutEffect 中设为 visibility:hidden，用户看不到滚动过程
      requestAnimationFrame(() => {
        // 如果 generation 已变，说明用户又切换了，放弃本次恢复
        if (scrollRestoreGenerationRef.current !== generation) return;
        element.scrollTop = savedScrollTop;
        // 再等一帧确保 scrollTop 生效后再显示容器
        requestAnimationFrame(() => {
          // 再次检查 generation
          if (scrollRestoreGenerationRef.current !== generation) return;
          const isAwayFromLatest =
            getResultsDistanceFromBottom(element) > SCROLL_TO_LATEST_THRESHOLD;
          shouldStickToBottomRef.current = !isAwayFromLatest;
          const btn = scrollToLatestBtnRef.current;
          if (btn) btn.style.display = isAwayFromLatest ? "" : "none";
          // 显示容器 — 用户直接看到正确位置的内容
          element.style.visibility = "";
          isRestoringScrollRef.current = false;
        });
      });
      // 恢复后清除保存的位置，下次内容更新时走正常的 shouldFollowLatest 逻辑
      scrollPositionsRef.current.delete(selectedConversation.id);
      return;
    }

    // 无保存位置，按正常逻辑处理
    const shouldFollowLatest =
      shouldStickToBottomRef.current ||
      getResultsDistanceFromBottom(element) <= SCROLL_TO_LATEST_THRESHOLD;

    if (shouldFollowLatest) {
      requestAnimationFrame(() => scrollResultsToLatest("smooth"));
      return;
    }

    const btn = scrollToLatestBtnRef.current;
    if (btn) btn.style.display = "";
  }, [
    selectedConversation?.id,
    selectedConversation?.updatedAt,
    selectedConversation?.turns.length,
    scrollResultsToLatest,
    workspaceMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedConversationId) {
      window.localStorage.setItem(
        scopedLocalStorageKey(ACTIVE_CONVERSATION_STORAGE_KEY, ownerId),
        selectedConversationId
      );
    } else {
      window.localStorage.removeItem(
        scopedLocalStorageKey(ACTIVE_CONVERSATION_STORAGE_KEY, ownerId)
      );
    }
  }, [ownerId, selectedConversationId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(IMAGE_RATIO_STORAGE_KEY, imageRatio);
    window.localStorage.setItem(IMAGE_TIER_STORAGE_KEY, imageTier);
    window.localStorage.setItem(IMAGE_QUALITY_STORAGE_KEY, imageQuality);
    window.localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, imageModel);
  }, [imageRatio, imageTier, imageQuality, imageModel]);

  useEffect(() => {
    if (!session || isLoadingHistory) {
      return;
    }
    const nextPreferences: StoredUserPreferences = {
      ...(session.preferences ?? {}),
      imageRatio,
      imageTier,
      imageQuality,
      imageModel,
      sidebarCollapsed: isSidebarCollapsed,
      sidebarWidth,
    };
    const current = session.preferences ?? {};
    if (
      current.imageRatio === nextPreferences.imageRatio &&
      current.imageTier === nextPreferences.imageTier &&
      current.imageQuality === nextPreferences.imageQuality &&
      current.imageModel === nextPreferences.imageModel &&
      current.sidebarCollapsed === nextPreferences.sidebarCollapsed &&
      current.sidebarWidth === nextPreferences.sidebarWidth
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void updateUserProfile({
        preferences: toPreferencePayload(nextPreferences),
      })
        .then(async (data) => {
          const updatedPreferences =
            data.user?.preferences ??
            data.preferences ??
            toPreferencePayload(nextPreferences);
          const nextSession = {
            ...session,
            preferences: {
              ...nextPreferences,
              theme: updatedPreferences.theme ?? nextPreferences.theme,
              language: updatedPreferences.language ?? nextPreferences.language,
              imageRatio:
                updatedPreferences.image_ratio ?? nextPreferences.imageRatio,
              imageTier:
                updatedPreferences.image_tier ?? nextPreferences.imageTier,
              imageQuality:
                updatedPreferences.image_quality ??
                nextPreferences.imageQuality,
              imageModel:
                updatedPreferences.image_model ?? nextPreferences.imageModel,
              sidebarCollapsed:
                updatedPreferences.sidebar_collapsed ??
                nextPreferences.sidebarCollapsed,
              sidebarWidth:
                updatedPreferences.sidebar_width ??
                nextPreferences.sidebarWidth,
            },
          };
          await setStoredAuthSession(nextSession);
          onSessionUpdate(nextSession);
        })
        .catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    imageModel,
    imageQuality,
    imageRatio,
    imageTier,
    isLoadingHistory,
    isSidebarCollapsed,
    onSessionUpdate,
    session,
    sidebarWidth,
  ]);

  useEffect(() => {
    if (
      selectedConversationId &&
      !conversations.some(
        (conversation) => conversation.id === selectedConversationId
      )
    ) {
      setSelectedConversationId(pickFallbackConversationId(conversations));
    }
  }, [conversations, selectedConversationId]);

  const persistConversation = async (conversation: ImageConversation) => {
    const nextConversations = sortImageConversations([
      conversation,
      ...conversationsRef.current.filter((item) => item.id !== conversation.id),
    ]);
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    await saveImageConversation(conversation, ownerId);
    if (!isGuest) {
      try {
        await upsertImageConversation(conversation.id, conversation.title);
      } catch (error) {
        const message = error instanceof Error ? error.message : "同步会话失败";
        toast.error(message);
      }
    }
  };

  const persistServerTurn = useCallback(
    async (
      conversation: ImageConversation,
      turn: ImageTurn,
      options: { toastOnError?: boolean } = {}
    ) => {
      if (isGuest) {
        return;
      }
      try {
        await upsertImageConversation(conversation.id, conversation.title);
        await createImageConversationTurn(conversation.id, turn);
      } catch (error) {
        if (options.toastOnError !== false) {
          const message =
            error instanceof Error ? error.message : "同步会话记录失败";
          toast.error(message);
        }
      }
    },
    [isGuest]
  );

  const syncServerImageResults = useCallback(
    async (conversationId: string, turnId: string, tasks: ImageTask[]) => {
      if (isGuest || tasks.length === 0) {
        return;
      }
      const taskIds = new Set(tasks.map((task) => task.id));
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      );
      const turn = conversation?.turns.find((item) => item.id === turnId);
      if (!turn) {
        return;
      }
      const updates = turn.images
        .filter((image) => taskIds.has(image.taskId || image.id))
        .map((image) =>
          updateImageConversationResult(conversationId, image.id, {
            taskId: image.taskId,
            status: image.status,
            taskStatus: image.taskStatus ?? null,
            progress: image.progress ?? null,
            url: image.url ?? null,
            revised_prompt: image.revised_prompt ?? null,
            error: image.error ?? null,
            durationMs: image.durationMs ?? null,
            feedback: image.feedback ?? null,
          })
        );
      await Promise.allSettled(updates);
    },
    [isGuest]
  );

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (current: ImageConversation | null) => ImageConversation,
      options: { persist?: boolean } = {}
    ) => {
      const current =
        conversationsRef.current.find((item) => item.id === conversationId) ??
        null;
      const nextConversation = updater(current);
      const nextConversations = sortImageConversations([
        nextConversation,
        ...conversationsRef.current.filter(
          (item) => item.id !== conversationId
        ),
      ]);
      conversationsRef.current = nextConversations;
      setConversations(nextConversations);
      if (options.persist !== false) {
        await saveImageConversation(nextConversation, ownerId);
      }
    },
    [ownerId]
  );

  const resetComposer = useCallback(() => {
    clearComposerInputs();
  }, [clearComposerInputs]);

  const handleCreateDraft = useCallback(() => {
    shouldStickToBottomRef.current = true;
    const btn = scrollToLatestBtnRef.current;
    if (btn) btn.style.display = "none";
    setSelectedConversationId(null);
    resetComposer();
    setWorkspaceMode("compose");
    textareaRef.current?.focus();
  }, [resetComposer]);

  useEffect(() => {
    const mode = parseWorkspaceMode(searchParams.get("mode"));
    const shouldCreateDraft = searchParams.get("new") === "1";
    const intentKey = `${mode ?? ""}:${shouldCreateDraft ? "new" : ""}`;

    if (lastRouteIntentRef.current === intentKey) {
      return;
    }
    lastRouteIntentRef.current = intentKey;

    if (shouldCreateDraft) {
      handleCreateDraft();
      return;
    }
    if (mode) {
      setWorkspaceMode(mode);
      setIsHistoryOpen(false);
    }
  }, [handleCreateDraft, searchParams]);

  const handleSelectConversation = useCallback((id: string) => {
    setWorkspaceMode("compose");
    setSelectedConversationId(id);
    setIsHistoryOpen(false);
  }, []);

  const handleSelectWorkspaceMode = useCallback((mode: ImageWorkspaceMode) => {
    setWorkspaceMode(mode);
    setIsHistoryOpen(false);
  }, []);

  const handleDeleteConversation = async (id: string) => {
    const nextConversations = conversations.filter((item) => item.id !== id);
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    if (selectedConversationId === id) {
      setSelectedConversationId(pickFallbackConversationId(nextConversations));
      resetComposer();
    }

    try {
      await deleteImageConversation(id, ownerId);
      if (!isGuest) {
        try {
          await deleteServerImageConversation(id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "同步删除失败";
          toast.error(message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除会话失败";
      toast.error(message);
      const items = await listImageConversations(ownerId);
      conversationsRef.current = items;
      setConversations(items);
    }
  };

  const handleDeleteTurnPart = async (
    conversationId: string,
    turnId: string,
    part: "prompt" | "results"
  ) => {
    const conversation = conversationsRef.current.find(
      (item) => item.id === conversationId
    );
    if (!conversation) {
      return;
    }

    const turns = conversation.turns
      .map((turn) => {
        if (turn.id !== turnId) {
          return turn;
        }
        const nextTurn = {
          ...turn,
          prompt: part === "prompt" ? "" : turn.prompt,
          promptDeleted: part === "prompt" ? true : turn.promptDeleted,
          resultsDeleted: part === "results" ? true : turn.resultsDeleted,
          status:
            part === "results" && turn.status === "generating"
              ? ("error" as const)
              : turn.status,
          images:
            part === "results"
              ? turn.images.map((image) => ({
                  id: image.id,
                  status: "error" as const,
                  error: "生成结果已删除",
                }))
              : turn.images,
        };
        return nextTurn.promptDeleted && nextTurn.resultsDeleted
          ? null
          : nextTurn;
      })
      .filter((turn): turn is ImageTurn => Boolean(turn));

    if (turns.length === 0) {
      await handleDeleteConversation(conversationId);
      return;
    }

    const nextConversation = {
      ...conversation,
      updatedAt: new Date().toISOString(),
      turns,
    };
    await persistConversation(nextConversation);
    if (!isGuest) {
      try {
        await updateImageConversationTurn(conversationId, turnId, {
          ...(part === "prompt" ? { prompt: "", promptDeleted: true } : {}),
          ...(part === "results"
            ? { resultsDeleted: true, status: "error", error: "生成结果已删除" }
            : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "同步删除失败";
        toast.error(message);
      }
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    const nextConversations = conversations.map((item) =>
      item.id === id
        ? { ...item, title, updatedAt: new Date().toISOString() }
        : item
    );
    conversationsRef.current = sortImageConversations(nextConversations);
    setConversations(conversationsRef.current);
    try {
      await renameImageConversation(id, title, ownerId);
      if (!isGuest) {
        try {
          await upsertImageConversation(id, title);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "同步重命名失败";
          toast.error(message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "重命名失败";
      toast.error(message);
    }
  };

  const openDeleteConversationConfirm = (id: string) => {
    setIsHistoryOpen(false);
    setDeleteConfirm({ type: "one", id });
  };

  const openDeletePromptConfirm = (conversationId: string, turnId: string) => {
    setDeleteConfirm({ type: "prompt", conversationId, turnId });
  };

  const openDeleteResultsConfirm = (conversationId: string, turnId: string) => {
    setDeleteConfirm({ type: "results", conversationId, turnId });
  };

  const handleConfirmDelete = async () => {
    const target = deleteConfirm;
    setDeleteConfirm(null);
    if (!target) {
      return;
    }
    if (target.type === "prompt" || target.type === "results") {
      await handleDeleteTurnPart(
        target.conversationId,
        target.turnId,
        target.type
      );
      return;
    }
    await handleDeleteConversation(target.id);
  };

  const appendReferenceImages = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    try {
      const previews = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || "image/png",
          dataUrl: await readFileAsDataUrl(file),
        }))
      );

      setReferenceImageFiles((prev) => [...prev, ...files]);
      setReferenceImages((prev) => [...prev, ...previews]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取参考图失败";
      toast.error(message);
    }
  }, []);

  const handleReferenceImageChange = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      await appendReferenceImages(files);
    },
    [appendReferenceImages]
  );

  const handleRemoveReferenceImage = useCallback((index: number) => {
    setReferenceImageFiles((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return next;
    });
    setReferenceImages((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index)
    );
  }, []);

  const handleContinueEdit = useCallback(
    async (
      conversationId: string,
      image: StoredImage | StoredReferenceImage
    ) => {
      try {
        const nextReference =
          "dataUrl" in image
            ? {
                referenceImage: image,
                file: dataUrlToFile(image.dataUrl, image.name, image.type),
              }
            : await buildReferenceImageFromStoredImage(
                image,
                `conversation-${conversationId}-${Date.now()}.png`
              );
        if (!nextReference) {
          return;
        }

        setSelectedConversationId(conversationId);

        setReferenceImages((prev) => [...prev, nextReference.referenceImage]);
        setReferenceImageFiles((prev) => [...prev, nextReference.file]);
        setImagePrompt("");
        textareaRef.current?.focus();
        toast.success("已加入当前参考图，继续输入描述即可编辑");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "读取结果图失败";
        toast.error(message);
      }
    },
    []
  );

  const handleReuseTurnConfig = useCallback(
    async (conversationId: string, turnId: string) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      );
      const turn = conversation?.turns.find((item) => item.id === turnId);
      if (!conversation || !turn || !turn.prompt.trim()) {
        return;
      }

      setSelectedConversationId(conversationId);
      setImagePrompt(turn.prompt);
      setImageCount(String(Math.max(1, turn.count || turn.images.length || 1)));
      setImageRatio(turn.ratio);
      setImageTier(turn.tier);
      const parsedSize = parseImageSize(turn.size);
      setImageWidth(parsedSize.width);
      setImageHeight(parsedSize.height);
      setImageQuality(turn.quality);
      setImageModel(turn.model);
      setReferenceImages(turn.referenceImages);
      setReferenceImageFiles(
        turn.referenceImages.map((image) =>
          dataUrlToFile(image.dataUrl, image.name, image.type)
        )
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      textareaRef.current?.focus();
      toast.success("已复用这条提示词配置");
    },
    []
  );

  const openLightbox = useCallback(
    (images: ImageLightboxItem[], index: number) => {
      if (images.length === 0) {
        return;
      }

      setLightboxImages(images);
      setLightboxIndex(Math.max(0, Math.min(index, images.length - 1)));
      setLightboxOpen(true);
    },
    []
  );

  const createLoadingImages = (turnId: string, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const imageId = `${turnId}-${index}`;
      return {
        id: imageId,
        taskId: imageId,
        status: "loading" as const,
      };
    });

  /* eslint-disable react-hooks/preserve-manual-memoization */
  const runConversationQueue = useCallback(
    async (conversationId: string) => {
      if (isConversationQueueActive(conversationId)) {
        return;
      }

      const snapshot = conversationsRef.current.find(
        (conversation) => conversation.id === conversationId
      );
      const activeTurn = snapshot?.turns.find(
        (turn) =>
          (turn.status === "queued" || turn.status === "generating") &&
          turn.images.some((image) => image.status === "loading")
      );
      if (!snapshot || !activeTurn) {
        return;
      }

      activeConversationQueueIds.set(conversationId, Date.now());
      const applyTasks = async (tasks: ImageTask[]) => {
        const taskMap = new Map(tasks.map((task) => [task.id, task]));
        await updateConversation(conversationId, (current) => {
          const conversation = current ?? snapshot;
          const turns = conversation.turns.map((turn) => {
            if (turn.id !== activeTurn.id) {
              return turn;
            }
            const images = turn.images.map((image) => {
              const taskId = image.taskId || image.id;
              const task = taskMap.get(taskId);
              return task
                ? taskDataToStoredImage({ ...image, taskId }, task)
                : image;
            });
            const derived = deriveTurnStatus({ ...turn, images });
            return {
              ...turn,
              ...derived,
              images,
            };
          });
          return {
            ...conversation,
            updatedAt: new Date().toISOString(),
            turns,
          };
        });
        await syncServerImageResults(conversationId, activeTurn.id, tasks);
      };

      try {
        const referenceFiles = activeTurn.referenceImages.map((image, index) =>
          dataUrlToFile(
            image.dataUrl,
            image.name || `${activeTurn.id}-${index + 1}.png`,
            image.type
          )
        );
        if (activeTurn.mode === "edit" && referenceFiles.length === 0) {
          throw new Error("未找到可用于继续编辑的参考图");
        }

        const pendingImages = activeTurn.images.filter(
          (image) => image.status === "loading"
        );
        const taskMetadata = { conversationId, turnId: activeTurn.id };
        const submitted = await Promise.all(
          pendingImages.map((image) => {
            const taskId = image.taskId || image.id;
            const metadata = { ...taskMetadata, imageId: image.id };
            return activeTurn.mode === "edit"
              ? createImageEditTask(
                  taskId,
                  referenceFiles,
                  activeTurn.prompt,
                  activeTurn.model,
                  activeTurn.size,
                  activeTurn.quality,
                  metadata
                )
              : createImageGenerationTask(
                  taskId,
                  activeTurn.prompt,
                  activeTurn.model,
                  activeTurn.size,
                  activeTurn.quality,
                  metadata
                );
          })
        );
        await applyTasks(submitted);

        let consecutiveErrors = 0;
        while (true) {
          const latestConversation = conversationsRef.current.find(
            (conversation) => conversation.id === conversationId
          );
          const latestTurn = latestConversation?.turns.find(
            (turn) => turn.id === activeTurn.id
          );
          const loadingTaskIds =
            latestTurn?.images.flatMap((image) =>
              image.status === "loading" && image.taskId ? [image.taskId] : []
            ) || [];
          if (loadingTaskIds.length === 0) {
            break;
          }

          await sleep(2000);
          try {
            const taskList = await fetchImageTasks(loadingTaskIds);
            consecutiveErrors = 0;
            if (taskList.items.length > 0) {
              await applyTasks(taskList.items);
            }
            if (taskList.missing_ids.length > 0 && latestTurn) {
              const missingImages = latestTurn.images.filter(
                (image) =>
                  image.status === "loading" &&
                  image.taskId &&
                  taskList.missing_ids.includes(image.taskId)
              );
              const resubmitted = await Promise.all(
                missingImages.map((image) => {
                  const metadata = { ...taskMetadata, imageId: image.id };
                  return activeTurn.mode === "edit"
                    ? createImageEditTask(
                        image.taskId || image.id,
                        referenceFiles,
                        activeTurn.prompt,
                        activeTurn.model,
                        activeTurn.size,
                        activeTurn.quality,
                        metadata
                      )
                    : createImageGenerationTask(
                        image.taskId || image.id,
                        activeTurn.prompt,
                        activeTurn.model,
                        activeTurn.size,
                        activeTurn.quality,
                        metadata
                      );
                })
              );
              if (resubmitted.length > 0) {
                await applyTasks(resubmitted);
              }
            }
          } catch (pollError) {
            consecutiveErrors += 1;
            if (consecutiveErrors >= 10) {
              throw pollError;
            }
          }
        }
      } catch (error) {
        const message = humanizeRequestError(
          error instanceof Error ? error.message : "生成图片失败"
        );
        await updateConversation(conversationId, (current) => {
          const conversation = current ?? snapshot;
          return {
            ...conversation,
            updatedAt: new Date().toISOString(),
            turns: conversation.turns.map((turn) =>
              turn.id === activeTurn.id
                ? {
                    ...turn,
                    status: "error",
                    error: message,
                    images: turn.images.map((image) =>
                      image.status === "loading"
                        ? { ...image, status: "error", error: message }
                        : image
                    ),
                  }
                : turn
            ),
          };
        });
        toast.error(message);
      } finally {
        activeConversationQueueIds.delete(conversationId);
        for (const conversation of conversationsRef.current) {
          if (
            !isConversationQueueActive(conversation.id) &&
            conversation.turns.some(
              (turn) =>
                (turn.status === "queued" || turn.status === "generating") &&
                turn.images.some((image) => image.status === "loading")
            )
          ) {
            void runConversationQueue(conversation.id);
          }
        }
      }
    },
    [syncServerImageResults, updateConversation]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const handleRegenerateTurn = useCallback(
    async (conversationId: string, turnId: string) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      );
      const sourceTurn = conversation?.turns.find((turn) => turn.id === turnId);
      if (!conversation || !sourceTurn || !sourceTurn.prompt.trim()) {
        return;
      }

      const now = new Date().toISOString();
      const nextTurnId = createId();
      const count = Math.max(
        1,
        sourceTurn.count || sourceTurn.images.length || 1
      );
      const nextTurn: ImageTurn = {
        id: nextTurnId,
        prompt: sourceTurn.prompt,
        model: sourceTurn.model,
        mode: sourceTurn.mode,
        referenceImages: sourceTurn.referenceImages,
        count,
        size: sourceTurn.size,
        ratio: sourceTurn.ratio,
        tier: sourceTurn.tier,
        quality: sourceTurn.quality,
        images: createLoadingImages(nextTurnId, count),
        createdAt: now,
        status: "queued",
      };
      const nextConversation = {
        ...conversation,
        updatedAt: now,
        turns: [...conversation.turns, nextTurn],
      };

      setSelectedConversationId(conversationId);
      await persistConversation(nextConversation);
      await persistServerTurn(nextConversation, nextTurn);
      void runConversationQueue(conversationId);
      toast.success("已加入重新生成队列");
    },
    [persistServerTurn, runConversationQueue]
  );

  const handleRetryImage = useCallback(
    async (conversationId: string, turnId: string, imageId: string) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      );
      if (!conversation) {
        return;
      }

      const now = new Date().toISOString();
      const retryImageId = `${turnId}-${createId()}`;
      const nextConversation = {
        ...conversation,
        updatedAt: now,
        turns: conversation.turns.map((turn) => {
          if (turn.id !== turnId) {
            return turn;
          }
          if (!turn.prompt.trim()) {
            return turn;
          }

          const images = turn.images.map((image) =>
            image.id === imageId
              ? {
                  id: retryImageId,
                  taskId: retryImageId,
                  status: "loading" as const,
                }
              : image
          );
          const derived = deriveTurnStatus({
            ...turn,
            status: "queued",
            images,
          });
          return {
            ...turn,
            ...derived,
            images,
          };
        }),
      };
      const nextTurn = nextConversation.turns.find(
        (turn) => turn.id === turnId
      );

      setSelectedConversationId(conversationId);
      await persistConversation(nextConversation);
      if (nextTurn) {
        await persistServerTurn(nextConversation, nextTurn);
      }
      void runConversationQueue(conversationId);
    },
    [persistServerTurn, runConversationQueue]
  );

  const handleImageFeedback = useCallback(
    async (
      conversationId: string,
      turnId: string,
      imageId: string,
      taskId: string,
      vote: ImageFeedbackVote
    ) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      );
      const turn = conversation?.turns.find((item) => item.id === turnId);
      const imageIndex =
        turn?.images.findIndex((item) => item.id === imageId) ?? -1;
      const image = imageIndex >= 0 ? turn?.images[imageIndex] : null;
      if (!conversation || !turn || !image || imageIndex < 0) {
        toast.error("没有找到这张图片");
        return;
      }

      const nextVote = image.feedback?.vote === vote ? null : vote;
      const optimisticFeedback = nextVote
        ? {
            ...image.feedback,
            vote: nextVote,
            likes: nextVote === "like" ? 1 : 0,
            dislikes: nextVote === "dislike" ? 1 : 0,
          }
        : undefined;

      await updateConversation(conversationId, (current) => {
        if (!current) return conversation;
        return {
          ...current,
          turns: current.turns.map((candidateTurn) =>
            candidateTurn.id === turnId
              ? {
                  ...candidateTurn,
                  images: candidateTurn.images.map((candidateImage) =>
                    candidateImage.id === imageId
                      ? { ...candidateImage, feedback: optimisticFeedback }
                      : candidateImage
                  ),
                }
              : candidateTurn
          ),
        };
      });

      try {
        const updatedTask = await updateImageTaskFeedback(taskId, 0, nextVote);
        const feedback = updatedTask.data?.[0]?.feedback;
        await updateConversation(conversationId, (current) => {
          if (!current) return conversation;
          return {
            ...current,
            turns: current.turns.map((candidateTurn) =>
              candidateTurn.id === turnId
                ? {
                    ...candidateTurn,
                    images: candidateTurn.images.map((candidateImage) =>
                      candidateImage.id === imageId
                        ? { ...candidateImage, feedback }
                        : candidateImage
                    ),
                  }
                : candidateTurn
            ),
          };
        });
        if (!isGuest) {
          await Promise.allSettled([
            updateImageConversationResult(conversationId, imageId, {
              feedback: feedback ?? null,
            }),
          ]);
        }
        toast.success(
          nextVote === "like"
            ? "已记录喜欢"
            : nextVote === "dislike"
            ? "已记录不喜欢"
            : "已取消反馈"
        );
      } catch (error) {
        await updateConversation(conversationId, (current) => {
          if (!current) return conversation;
          return {
            ...current,
            turns: current.turns.map((candidateTurn) =>
              candidateTurn.id === turnId
                ? {
                    ...candidateTurn,
                    images: candidateTurn.images.map((candidateImage) =>
                      candidateImage.id === imageId
                        ? { ...candidateImage, feedback: image.feedback }
                        : candidateImage
                    ),
                  }
                : candidateTurn
            ),
          };
        });
        toast.error(error instanceof Error ? error.message : "反馈保存失败");
      }
    },
    [isGuest, updateConversation]
  );

  const handleDismissErrors = useCallback(
    async (conversationId: string, turnId: string) => {
      await updateConversation(conversationId, (current) => {
        const conversation =
          current ??
          conversationsRef.current.find((c) => c.id === conversationId);
        if (!conversation) return current!;
        return {
          ...conversation,
          updatedAt: new Date().toISOString(),
          turns: conversation.turns.map((turn) => {
            if (turn.id !== turnId) return turn;
            const successImages = turn.images.filter(
              (image) => image.status !== "error"
            );
            const derived = deriveTurnStatus({
              ...turn,
              images: successImages,
            });
            return {
              ...turn,
              ...derived,
              count: successImages.length,
              images: successImages,
            };
          }),
        };
      });
    },
    [updateConversation]
  );

  useEffect(() => {
    for (const conversation of conversations) {
      if (
        !isConversationQueueActive(conversation.id) &&
        conversation.turns.some(
          (turn) =>
            !turn.resultsDeleted &&
            (turn.status === "queued" || turn.status === "generating") &&
            turn.images.some((image) => image.status === "loading")
        )
      ) {
        void runConversationQueue(conversation.id);
      }
    }
  }, [conversations, runConversationQueue]);

  const handleSubmit = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt) {
      toast.error("请输入提示词");
      return;
    }
    if (isGuest) {
      toast.info("登录或注册后即可生成图片", {
        description: "登录后可以保存历史会话和管理生成结果。",
      });
      router.push("/login?next=%2Fimage");
      return;
    }

    const hasReferenceImage =
      referenceImages.length > 0 || referenceImageFiles.length > 0;
    const effectiveImageMode: ImageConversationMode = hasReferenceImage
      ? "edit"
      : "generate";
    if (
      effectiveImageMode === "generate" &&
      promptRequiresReferenceImage(prompt)
    ) {
      toast.error("请先上传参考图", {
        description:
          "这条提示词要求使用已上传图片或参考图，上传后会自动切换为图生图。",
      });
      fileInputRef.current?.click();
      return;
    }
    const effectiveReferenceImages =
      effectiveImageMode === "edit" && referenceImages.length === 0
        ? await Promise.all(
            referenceImageFiles.map(async (file) => ({
              name: file.name,
              type: file.type || "image/png",
              dataUrl: await readFileAsDataUrl(file),
            }))
          )
        : referenceImages;

    const targetConversation = selectedConversationId
      ? conversationsRef.current.find(
          (conversation) => conversation.id === selectedConversationId
        ) ?? null
      : null;
    const now = new Date().toISOString();
    const conversationId = targetConversation?.id ?? createId();
    const turnId = createId();
    const imageSize = `${imageWidth || 1024}x${imageHeight || 1024}`;
    const draftTurn: ImageTurn = {
      id: turnId,
      prompt,
      model: imageModel,
      mode: effectiveImageMode,
      referenceImages:
        effectiveImageMode === "edit" ? effectiveReferenceImages : [],
      count: parsedCount,
      size: imageSize,
      ratio: imageRatio,
      tier: imageTier,
      quality: imageQuality,
      images: createLoadingImages(turnId, parsedCount),
      createdAt: now,
      status: "queued",
    };

    const baseConversation: ImageConversation = targetConversation
      ? {
          ...targetConversation,
          updatedAt: now,
          turns: [...targetConversation.turns, draftTurn],
        }
      : {
          id: conversationId,
          title: buildConversationTitle(prompt),
          createdAt: now,
          updatedAt: now,
          turns: [draftTurn],
        };

    shouldStickToBottomRef.current = true;
    const btn = scrollToLatestBtnRef.current;
    if (btn) btn.style.display = "none";
    setSelectedConversationId(conversationId);
    clearComposerInputs();

    await persistConversation(baseConversation);
    await persistServerTurn(baseConversation, draftTurn);
    void runConversationQueue(conversationId);

    const targetStats = getImageConversationStats(baseConversation);
    if (targetStats.running > 0 || targetStats.queued > 1) {
      toast.success("已加入当前对话队列");
    } else if (!targetConversation) {
      toast.success("已创建新对话并开始处理");
    } else {
      toast.success("已发送到当前对话");
    }
  };

  const composeWorkspace = (
    <>
      <div className="relative min-h-0 flex-1">
        <div
          ref={resultsViewportRef}
          onScroll={handleResultsScroll}
          className="hide-scrollbar h-full overscroll-contain overflow-y-auto px-3 py-4 sm:px-8 sm:py-6"
          style={{ contain: "layout style paint" }}
        >
          <ImageResults
            selectedConversation={selectedConversation}
            currentUserId={ownerId}
            watermarkLabel={watermarkLabel}
            watermarkUnlocked={true}
            onOpenLightbox={openLightbox}
            onContinueEdit={handleContinueEdit}
            onDeletePrompt={openDeletePromptConfirm}
            onDeleteResults={openDeleteResultsConfirm}
            onReuseTurnConfig={handleReuseTurnConfig}
            onRegenerateTurn={handleRegenerateTurn}
            onRetryImage={handleRetryImage}
            onImageFeedback={handleImageFeedback}
            onDismissErrors={handleDismissErrors}
            formatConversationTime={formatConversationTime}
          />
        </div>

        <button
          ref={scrollToLatestBtnRef}
          type="button"
          aria-label="滚动到最新消息"
          title="滚动到最新消息"
          onClick={() => scrollResultsToLatest("smooth")}
          className="absolute bottom-4 left-1/2 z-20 inline-flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-700 shadow-lg shadow-stone-200/60 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-white/10 dark:bg-stone-800/95 dark:text-stone-100 dark:shadow-black/40 dark:hover:bg-stone-700"
          style={{ display: "none" }}
        >
          <ArrowDown className="size-5" />
        </button>
      </div>

      <ImageComposer
        prompt={imagePrompt}
        imageCount={imageCount}
        imageRatio={imageRatio}
        imageTier={imageTier}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        imageQuality={imageQuality}
        imageModel={imageModel}
        imageModels={imageModels}
        activeTaskCount={activeTaskCount}
        referenceImages={referenceImages}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        onPromptChange={setImagePrompt}
        onImageCountChange={(value) =>
          setImageCount(value ? clampImageCount(value) : "")
        }
        onImageRatioChange={setImageRatio}
        onImageTierChange={setImageTier}
        onImageWidthChange={setImageWidth}
        onImageHeightChange={setImageHeight}
        onImageQualityChange={setImageQuality}
        onImageModelChange={setImageModel}
        onSubmit={handleSubmit}
        onPickReferenceImage={() => fileInputRef.current?.click()}
        onReferenceImageChange={handleReferenceImageChange}
        onRemoveReferenceImage={handleRemoveReferenceImage}
      />
    </>
  );

  const sidebarAccountFooter = (
    <div className="flex items-center justify-start gap-2 px-1">
      {session ? (
        <AccountMenu
          session={{ ...session, watermarkLabel, watermarkUnlocked: true }}
          onLogout={handleLogout}
          onSessionUpdate={onSessionUpdate}
          iconOnly={isSidebarCollapsed}
          watermarkLabel={watermarkLabel}
          onSaveWatermarkLabel={handleSaveWatermarkLabel}
          usageStats={accountUsageStats}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 rounded-full border-zinc-200 bg-white text-sm text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
            isSidebarCollapsed ? "w-9 px-0" : "px-3"
          )}
          onClick={() => router.push("/login?next=%2Fimage")}
          title={copy.login}
          aria-label={copy.login}
        >
          <LogIn className="size-4" />
          {isSidebarCollapsed ? null : copy.login}
        </Button>
      )}
    </div>
  );

  const workspaceStyle = {
    "--happytoken-sidebar-track": `${
      isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth
    }px`,
  } as CSSProperties;

  return (
    <>
      <section
        className="happytoken-workspace relative left-1/2 grid h-screen min-h-0 w-screen -translate-x-1/2 grid-cols-1 gap-0 overflow-hidden bg-zinc-50 px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] dark:bg-[#171717] sm:-mt-2 sm:grid-cols-[var(--happytoken-sidebar-track)_minmax(0,1fr)] sm:pb-0"
        style={workspaceStyle}
      >
        <div className="relative hidden h-full min-h-0 border-r border-zinc-200/70 bg-zinc-50 px-2 py-2 dark:border-zinc-800 dark:bg-[#171717] sm:block">
          <ImageSidebar
            conversations={conversations}
            isLoadingHistory={isLoadingHistory}
            selectedConversationId={selectedConversationId}
            activeMode={workspaceMode}
            onCreateDraft={handleCreateDraft}
            onSelectConversation={handleSelectConversation}
            onSelectMode={handleSelectWorkspaceMode}
            onDeleteConversation={openDeleteConversationConfirm}
            onRenameConversation={handleRenameConversation}
            formatConversationTime={formatConversationTime}
            isAdmin={isAdmin}
            accountFooter={sidebarAccountFooter}
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
          />
          {!isSidebarCollapsed ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={copy.resizeSidebar}
              title={copy.dragResizeSidebar}
              onPointerDown={handleSidebarResizeStart}
              className="absolute top-0 right-[-3px] z-30 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-zinc-300/70 dark:hover:bg-zinc-700/80"
            />
          ) : null}
        </div>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="flex h-[min(82dvh,760px)] w-[92vw] max-w-[460px] flex-col overflow-hidden rounded-[32px] border-white/80 bg-white p-0 shadow-[0_32px_110px_-38px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-[#171717] sm:rounded-[36px]">
            <DialogHeader className="px-6 pt-7 pb-4 sm:px-8">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <History className="size-5" />
                历史记录
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-8">
              <ImageSidebar
                conversations={conversations}
                isLoadingHistory={isLoadingHistory}
                selectedConversationId={selectedConversationId}
                activeMode={workspaceMode}
                onCreateDraft={() => {
                  handleCreateDraft();
                  setIsHistoryOpen(false);
                }}
                onSelectConversation={handleSelectConversation}
                onSelectMode={handleSelectWorkspaceMode}
                onDeleteConversation={openDeleteConversationConfirm}
                onRenameConversation={handleRenameConversation}
                formatConversationTime={formatConversationTime}
                hideActionButtons
                isAdmin={isAdmin}
                accountFooter={sidebarAccountFooter}
              />
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-0 flex-col bg-zinc-50 dark:bg-[#171717]">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 bg-zinc-50/95 px-3 py-2 dark:border-zinc-800 dark:bg-[#171717]/95 sm:hidden">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-2xl border-zinc-200 bg-white/90 text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="mr-2 size-4" />
              历史记录 ({conversations.length})
            </Button>
            <Button
              className="h-10 rounded-2xl bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              onClick={handleCreateDraft}
            >
              <Plus className="size-4" />
              新建
            </Button>
          </div>

          {workspaceMode === "compose" ? composeWorkspace : null}
          {workspaceMode === "official_gallery" ? (
            <GalleryBrowser
              embedded
              onUsePrompt={(prompt, title) => {
                loadPromptIntoCleanDraft(
                  prompt,
                  `已载入官方图库提示词${
                    title ? `：${title.slice(0, 24)}` : ""
                  }`,
                  {
                    skipHistoryConversationRestore:
                      loadHistoryInFlightRef.current,
                  }
                );
              }}
            />
          ) : null}
          {workspaceMode === "user_gallery" ? (
            <UserGalleryPanel
              conversations={conversations}
              onUsePrompt={(prompt) => {
                loadPromptIntoCleanDraft(prompt, undefined, {
                  skipHistoryConversationRestore:
                    loadHistoryInFlightRef.current,
                });
              }}
            />
          ) : null}
        </div>
      </section>

      <ImageLightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
      />

      {deleteConfirm ? (
        <Dialog
          open
          onOpenChange={(open) => (!open ? setDeleteConfirm(null) : null)}
        >
          <DialogContent
            showCloseButton={false}
            className="max-w-[390px] rounded-[28px] border-zinc-200 bg-zinc-50 p-5 text-left shadow-xl dark:border-zinc-800 dark:bg-[#171717]"
          >
            <DialogHeader className="gap-1.5">
              <DialogTitle className="text-[20px] font-bold tracking-tight">
                {deleteConfirmTitle}
              </DialogTitle>
              <DialogDescription className="text-sm leading-5">
                {deleteConfirmDescription}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-1 flex-row justify-end gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-9 rounded-full px-4"
                onClick={() => setDeleteConfirm(null)}
              >
                取消
              </Button>
              <Button
                className="h-9 rounded-full bg-rose-600 px-4 text-white hover:bg-rose-700"
                onClick={() => void handleConfirmDelete()}
              >
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export default function ImagePage() {
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null | undefined>(
    undefined
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      const nextSession = await getValidatedAuthSession();
      if (active) {
        setSession(nextSession);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      router.replace("/login?next=%2Fimage");
    }
  }, [router, session]);

  if (session === undefined || session === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <ImagePageContent
      isAdmin={session?.role === "admin"}
      ownerId={session.subjectId}
      session={session}
      onSessionUpdate={setSession}
    />
  );
}

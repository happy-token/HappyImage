import localforage from "localforage";

import { httpRequest, request } from "@/lib/request";
import { getStoredAuthKey } from "@/store/auth";
import type { ImageConversation, ImageTurn } from "@/store/image-conversations";

export type ImageModel = string;
export type AuthRole = "admin" | "user";
export type ImageStorageMode = "local" | "webdav" | "both";
export type NewAPIBindingStatus = "configured" | "pending" | "failed";

export type ImageStorageSettings = {
  enabled: boolean;
  mode: ImageStorageMode;
  webdav_url: string;
  webdav_username: string;
  webdav_password: string;
  webdav_root_path: string;
  public_base_url: string;
};

export type OIDCSettings = {
  enabled: boolean;
  issuer: string;
  client_id: string;
  client_secret?: string;
  client_secret_configured?: boolean;
  scopes: string;
  allowed_email_domains: string;
};

export type ModelGatewaySettings = {
  gateway_api_base_url: string;
  gateway_management_url: string;
  provision_url?: string;
  provision_secret?: string;
  provision_secret_configured?: boolean;
  sql_dsn?: string;
  sql_dsn_configured?: boolean;
  token_name: string;
  enabled?: boolean;
};

export type SetupStatusResponse = {
  ok: boolean;
  setup_required: boolean;
  storage?: Record<string, unknown>;
};

export type SetupPayload = {
  admin_name: string;
  admin_key: string;
  public_app_url: string;
  api_public_url?: string;
  session_secret: string;
  oidc: OIDCSettings;
  model_gateway: ModelGatewaySettings;
};

export type SettingsConfig = {
  base_url?: string;
  frontend_base_url?: string;
  api_base_url?: string;
  public_app_url?: string;
  api_public_url?: string;
  external_api_url?: string;
  cors_origins?: string[];
  session_cookie_name?: string;
  session_max_age_seconds?: number | string;
  session_secret_configured?: boolean;
  global_system_prompt?: string;
  sensitive_words?: string[];
  ai_review?: {
    enabled?: boolean;
    base_url?: string;
    api_key?: string;
    model?: string;
    prompt?: string;
  };
  image_retention_days?: number | string;
  image_poll_timeout_secs?: number | string;
  image_parallel_generation?: boolean;
  image_settle_enabled?: boolean;
  image_check_before_hit_enabled?: boolean;
  image_settle_secs?: number | string;
  log_levels?: string[];
  oidc?: OIDCSettings;
  model_gateway?: ModelGatewaySettings;
  image_storage?: ImageStorageSettings;
  [key: string]: unknown;
};

export type ManagedImage = {
  rel: string;
  path?: string;
  name: string;
  date: string;
  size: number;
  url: string;
  thumbnail_url?: string;
  created_at: string;
  width?: number;
  height?: number;
  tags?: string[];
};

export type SeedGalleryImage = {
  path: string;
  url: string;
  thumbnail_url?: string;
  width?: number | null;
  height?: number | null;
};

export type SeedGalleryItem = {
  id: string;
  case_no?: number;
  title: string;
  category: string;
  source_url: string;
  source_author?: string | null;
  prompt: string;
  negative_prompt?: string | null;
  license: string;
  rights_notes: string;
  watermark_status: string;
  watermark_signals: string[];
  tags: string[];
  images: SeedGalleryImage[];
  source_repo: string;
  source_kind?: "seed" | "candidate";
  review_status?: string;
  model?: string;
};

export type SeedGalleryListResponse = {
  items: SeedGalleryItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type SeedGalleryFacetsResponse = {
  total: number;
  categories: Record<string, number>;
  watermark_statuses: Record<string, number>;
  available: boolean;
  index_file: string;
};

export type ShareDraftStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

export type ShareDraft = {
  id: string;
  source: "user_gallery";
  image_url: string;
  conversation_id: string;
  turn_id: string;
  image_id: string;
  original_prompt: string;
  conversation_summary: string;
  share_prompt: string;
  title: string;
  category?: string;
  tags: string[];
  status: ShareDraftStatus;
  created_at: string;
  updated_at: string;
};

export type SaveShareDraftPayload = Omit<
  ShareDraft,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type GalleryTextPayload = {
  conversation_id: string;
  conversation_title: string;
  original_prompt: string;
  image_url: string;
  model?: string;
  size?: string;
  quality?: string;
  conversation_messages?: Array<{ role: string; content: string }>;
};

export type SystemLog = {
  id: string;
  time: string;
  type: "call" | "account" | string;
  summary?: string;
  detail?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ImageFeedbackVote = "like" | "dislike";

export type ImageFeedbackSummary = {
  vote?: ImageFeedbackVote | null;
  likes?: number;
  dislikes?: number;
  updated_at?: string;
};

export type ImageTask = {
  id: string;
  status: "queued" | "running" | "success" | "error";
  mode: "generate" | "edit";
  prompt?: string;
  model?: ImageModel;
  size?: string;
  quality?: string;
  created_at: string;
  updated_at: string;
  conversation_id?: string;
  client_conversation_id?: string;
  client_turn_id?: string;
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
    feedback?: ImageFeedbackSummary;
  }>;
  error?: string;
  progress?: string;
  elapsed_secs?: number;
  duration_ms?: number;
};

type ImageTaskListResponse = {
  items: ImageTask[];
  missing_ids: string[];
};

type ImageConversationListResponse = {
  items: ImageConversation[];
};

type ImageConversationItemResponse = {
  item: ImageConversation;
};

export type ImageConversationTurnPayload = ImageTurn;
export type ImageConversationTurnPatch = Partial<
  Pick<
    ImageTurn,
    "prompt" | "status" | "error" | "promptDeleted" | "resultsDeleted"
  >
>;
export type ImageConversationResultPatch = {
  taskId?: string;
  status?: "loading" | "success" | "error";
  taskStatus?: "queued" | "running" | null;
  progress?: string | null;
  url?: string | null;
  revised_prompt?: string | null;
  error?: string | null;
  durationMs?: number | null;
  feedback?: ImageFeedbackSummary | null;
};

type LocalApiCacheRecord<T> = {
  createdAt: number;
  data: T;
};

const seedGalleryApiCacheVersion = "v9-simple-gallery-categories";
const seedGalleryLocalCachePrefix = `happytoken:seed-gallery-api-cache:${seedGalleryApiCacheVersion}:`;
const seedGalleryLocalCacheIndexKey = "__index";
const seedGalleryStaticItemsPath = "/seed-gallery/static/items.json";
const seedGalleryListCacheMaxAgeMs = 10 * 60 * 1000;
const seedGalleryDetailCacheMaxAgeMs = 24 * 60 * 60 * 1000;
const seedGalleryFacetCacheMaxAgeMs = 60 * 60 * 1000;
const seedGalleryLocalCacheMaxEntries = 180;
const seedGalleryLocalCacheMaxPayloadLength = 900_000;

const seedGalleryApiCache = localforage.createInstance({
  name: "happytoken",
  storeName: "seed_gallery_api_cache",
});
const seedGalleryMemoryCache = new Map<string, LocalApiCacheRecord<unknown>>();
let seedGalleryStaticItemsPromise: Promise<SeedGalleryItem[] | null> | null =
  null;

function getLocalApiCacheKey(path: string) {
  return `${seedGalleryLocalCachePrefix}${path}`;
}

function appendSeedGalleryCacheVersion(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}gallery_cache=${seedGalleryApiCacheVersion}`;
}

async function readLocalApiCacheIndex() {
  try {
    const value = await seedGalleryApiCache.getItem<string[]>(
      seedGalleryLocalCacheIndexKey
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeLocalApiCacheIndex(keys: string[]) {
  try {
    await seedGalleryApiCache.setItem(
      seedGalleryLocalCacheIndexKey,
      keys.slice(-seedGalleryLocalCacheMaxEntries)
    );
  } catch {
    // Browser storage can be unavailable or full; memory and HTTP caching still cover the request.
  }
}

async function touchLocalApiCacheKey(key: string) {
  const keys = (await readLocalApiCacheIndex()).filter((item) => item !== key);
  keys.push(key);
  const overflow = keys.length - seedGalleryLocalCacheMaxEntries;
  if (overflow > 0) {
    await Promise.allSettled(
      keys.slice(0, overflow).map(async (oldKey) => {
        seedGalleryMemoryCache.delete(oldKey);
        await seedGalleryApiCache.removeItem(oldKey);
      })
    );
  }
  await writeLocalApiCacheIndex(keys);
}

async function readLocalApiCache<T>(
  path: string,
  maxAgeMs: number
): Promise<T | null> {
  const key = getLocalApiCacheKey(path);
  const memoryRecord = seedGalleryMemoryCache.get(key) as
    | LocalApiCacheRecord<T>
    | undefined;
  if (
    memoryRecord &&
    Date.now() - Number(memoryRecord.createdAt || 0) <= maxAgeMs
  ) {
    return memoryRecord.data;
  }

  try {
    const record = await seedGalleryApiCache.getItem<LocalApiCacheRecord<T>>(
      key
    );
    if (!record) {
      return null;
    }
    if (!record || Date.now() - Number(record.createdAt || 0) > maxAgeMs) {
      seedGalleryMemoryCache.delete(key);
      await seedGalleryApiCache.removeItem(key);
      return null;
    }
    seedGalleryMemoryCache.set(key, record);
    await touchLocalApiCacheKey(key);
    return record.data;
  } catch {
    seedGalleryMemoryCache.delete(key);
    await seedGalleryApiCache.removeItem(key).catch(() => {});
    return null;
  }
}

async function writeLocalApiCache<T>(path: string, data: T) {
  const key = getLocalApiCacheKey(path);
  const record = {
    createdAt: Date.now(),
    data,
  } satisfies LocalApiCacheRecord<T>;
  seedGalleryMemoryCache.set(key, record);
  try {
    const value = JSON.stringify(record);
    if (value.length > seedGalleryLocalCacheMaxPayloadLength) {
      return;
    }
    await seedGalleryApiCache.setItem(key, record);
    await touchLocalApiCacheKey(key);
  } catch {
    await seedGalleryApiCache.removeItem(key).catch(() => {});
  }
}

async function cachedSeedGalleryRequest<T>(path: string, maxAgeMs: number) {
  const versionedPath = appendSeedGalleryCacheVersion(path);
  const cached = await readLocalApiCache<T>(versionedPath, maxAgeMs);
  if (cached) {
    return cached;
  }
  const data = await httpRequest<T>(versionedPath);
  void writeLocalApiCache(versionedPath, data);
  return data;
}

async function fetchSeedGalleryStaticItems() {
  if (!seedGalleryStaticItemsPromise) {
    seedGalleryStaticItemsPromise = (async () => {
      try {
        const response = await fetch(
          appendSeedGalleryCacheVersion(seedGalleryStaticItemsPath),
          {
            cache: "force-cache",
          }
        );
        if (!response.ok) {
          return null;
        }
        const payload = (await response.json()) as
          | { items?: unknown }
          | unknown[];
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : [];
        return items.filter((item): item is SeedGalleryItem => {
          return Boolean(
            item &&
              typeof item === "object" &&
              typeof (item as SeedGalleryItem).id === "string"
          );
        });
      } catch {
        return null;
      }
    })();
  }
  return seedGalleryStaticItemsPromise;
}

function filterSeedGalleryItems(
  items: SeedGalleryItem[],
  params: {
    query?: string;
    category?: string;
    watermark_status?: string;
  }
) {
  const query = String(params.query || "")
    .trim()
    .toLowerCase();
  const category = String(params.category || "")
    .trim()
    .toLowerCase();
  const watermark = String(params.watermark_status || "")
    .trim()
    .toLowerCase();
  return items.filter((item) => {
    if (category && item.category.toLowerCase() !== category) {
      return false;
    }
    if (watermark && item.watermark_status.toLowerCase() !== watermark) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(query) ||
      item.prompt.toLowerCase().includes(query) ||
      item.tags.join(" ").toLowerCase().includes(query)
    );
  });
}

function paginateSeedGalleryItems(
  items: SeedGalleryItem[],
  limit = 60,
  offset = 0
): SeedGalleryListResponse {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 60, 1), 240);
  const normalizedOffset = Math.min(
    Math.max(Number(offset) || 0, 0),
    items.length
  );
  return {
    items: items.slice(normalizedOffset, normalizedOffset + normalizedLimit),
    total: items.length,
    limit: normalizedLimit,
    offset: normalizedOffset,
    has_more: normalizedOffset + normalizedLimit < items.length,
  };
}

function buildStaticSeedGalleryFacets(
  items: SeedGalleryItem[]
): SeedGalleryFacetsResponse {
  const categories: Record<string, number> = {};
  const watermark_statuses: Record<string, number> = {};
  for (const item of items) {
    const category = item.category || "uncategorized";
    const watermark = item.watermark_status || "needs_review";
    categories[category] = (categories[category] || 0) + 1;
    watermark_statuses[watermark] = (watermark_statuses[watermark] || 0) + 1;
  }
  return {
    total: items.length,
    categories,
    watermark_statuses,
    available: items.length > 0,
    index_file: seedGalleryStaticItemsPath,
  };
}

export type LoginResponse = {
  ok: boolean;
  version: string;
  role: AuthRole;
  subject_id: string;
  name: string;
  watermark_label?: string;
  watermark_unlocked?: boolean;
  model_provider?: string;
  model_base_url?: string;
  model_api_key_configured?: boolean;
  model_gateway_enabled?: boolean;
  newapi_binding_status?: NewAPIBindingStatus;
  newapi_binding_message?: string;
  newapi_management_url?: string;
  model_providers?: UserModelProvider[];
  preferences?: UserPreferences;
  auth_provider?: string;
  auth_subject?: string;
  email?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number | null;
  user?: {
    id: string;
    name: string;
    role: AuthRole;
    watermark_label?: string;
    watermark_unlocked?: boolean;
    model_provider?: string;
    model_base_url?: string;
    model_api_key_configured?: boolean;
    model_gateway_enabled?: boolean;
    newapi_binding_status?: NewAPIBindingStatus;
    newapi_binding_message?: string;
    newapi_management_url?: string;
    model_providers?: UserModelProvider[];
    preferences?: UserPreferences;
    auth_provider?: string;
    auth_subject?: string;
    email?: string;
  };
};

export type UserPreferences = {
  theme?: "system" | "light" | "dark";
  language?: "system" | "zh-CN" | "en-US";
  image_ratio?: string;
  image_tier?: string;
  image_quality?: string;
  image_model?: string;
  sidebar_collapsed?: boolean;
  sidebar_width?: number;
};

export type UserModelProvider = {
  id: string;
  type: string;
  protocol?: string;
  base_url: string;
  models?: string[];
  api_key_configured?: boolean;
  selected?: boolean;
};

export type UserModelProviderUpdate = {
  id?: string;
  type?: string;
  protocol?: string;
  base_url?: string;
  models?: string[];
  api_key?: string;
  api_key_configured?: boolean;
  selected?: boolean;
};

export type ProviderTestRequest = {
  type: string;
  protocol?: string;
  base_url: string;
  models?: string[];
  api_key: string;
};

export type ProviderTestResponse = {
  ok: boolean;
  models?: string[];
};

export type NewAPIManagementToken = {
  id: number;
  key: string;
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  used_quota: number;
};

export type NewAPIManagementResponse = {
  ok: boolean;
  status: NewAPIBindingStatus;
  message?: string;
  management_url: string;
  newapi_user_id: string;
  tokens: NewAPIManagementToken[];
};

export type UserKey = {
  id: string;
  name: string;
  role: "user";
  enabled: boolean;
  watermark_label?: string;
  watermark_unlocked?: boolean;
  created_at: string | null;
  last_used_at: string | null;
};

export async function loginWithPassword(credentials: {
  email: string;
  password: string;
}) {
  return httpRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
    },
    redirectOnUnauthorized: false,
  });
}

export async function registerWithPassword(credentials: {
  name: string;
  password: string;
  confirmPassword?: string;
}) {
  return httpRequest<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: {
      name: credentials.name,
      password: credentials.password,
      confirm_password: credentials.confirmPassword || "",
    },
    redirectOnUnauthorized: false,
  });
}

export async function fetchSetupStatus() {
  return httpRequest<SetupStatusResponse>("/api/setup/status", {
    redirectOnUnauthorized: false,
  });
}

export async function completeSetup(payload: SetupPayload) {
  return httpRequest<{
    ok: boolean;
    setup_required: boolean;
    config: SettingsConfig;
  }>("/api/setup", {
    method: "POST",
    body: payload,
    redirectOnUnauthorized: false,
  });
}

export async function loginWithAdminKey(key: string) {
  return httpRequest<LoginResponse>("/api/auth/admin-key-login", {
    method: "POST",
    body: { key },
    redirectOnUnauthorized: false,
  });
}

// ── OIDC Web Login ──────────────────────────────────────────────────

export type OIDCStartResponse = {
  authorize_url: string;
  transaction_id: string;
  expires_in: string;
};

export type SessionResponse = {
  ok: boolean;
  role: AuthRole;
  subject_id: string;
  name: string;
  watermark_label?: string;
  watermark_unlocked?: boolean;
  model_provider?: string;
  model_base_url?: string;
  model_api_key_configured?: boolean;
  model_gateway_enabled?: boolean;
  newapi_binding_status?: NewAPIBindingStatus;
  newapi_binding_message?: string;
  newapi_management_url?: string;
  model_providers?: UserModelProvider[];
  preferences?: UserPreferences;
  auth_provider?: string;
  auth_subject?: string;
  email?: string;
  user?: {
    id: string;
    name: string;
    role: AuthRole;
    watermark_label?: string;
    watermark_unlocked?: boolean;
    model_provider?: string;
    model_base_url?: string;
    model_api_key_configured?: boolean;
    model_gateway_enabled?: boolean;
    newapi_binding_status?: NewAPIBindingStatus;
    newapi_binding_message?: string;
    newapi_management_url?: string;
    model_providers?: UserModelProvider[];
    preferences?: UserPreferences;
    auth_provider?: string;
    auth_subject?: string;
    email?: string;
  };
};

export type UserProfileResponse = LoginResponse;

export async function startOIDCLogin(nextPath?: string) {
  return httpRequest<OIDCStartResponse>("/api/auth/oidc/start", {
    method: "POST",
    body: { next_path: nextPath ?? "" },
    redirectOnUnauthorized: false,
  });
}

export async function fetchSession() {
  return httpRequest<SessionResponse>("/api/auth/session", {
    redirectOnUnauthorized: false,
  });
}

export async function fetchUserProfile() {
  return httpRequest<UserProfileResponse>("/api/auth/profile", {
    redirectOnUnauthorized: false,
  });
}

export async function updateUserProfile(updates: {
  watermark_label?: string;
  model_provider?: string;
  model_base_url?: string;
  model_api_key?: string;
  model_providers?: UserModelProviderUpdate[];
  preferences?: UserPreferences;
}) {
  return httpRequest<UserProfileResponse>("/api/auth/profile", {
    method: "PATCH",
    body: updates,
    redirectOnUnauthorized: false,
  });
}

export async function testModelProvider(body: ProviderTestRequest) {
  return httpRequest<ProviderTestResponse>("/api/auth/provider-test", {
    method: "POST",
    body,
    redirectOnUnauthorized: false,
  });
}

export async function fetchNewAPIManagement() {
  return httpRequest<NewAPIManagementResponse>("/api/auth/newapi-management", {
    redirectOnUnauthorized: false,
  });
}

export async function logoutSession() {
  return httpRequest<{ ok: boolean; logout_url?: string }>("/api/auth/logout", {
    method: "POST",
    redirectOnUnauthorized: false,
  });
}

export async function createImageGenerationTask(
  clientTaskId: string,
  prompt: string,
  model?: ImageModel,
  size?: string,
  quality = "auto",
  metadata: { conversationId?: string; turnId?: string; imageId?: string } = {}
) {
  return httpRequest<ImageTask>("/api/image-tasks/generations", {
    method: "POST",
    redirectOnUnauthorized: false,
    body: {
      client_task_id: clientTaskId,
      prompt,
      ...(model ? { model } : {}),
      ...(size ? { size } : {}),
      quality,
      ...(metadata.conversationId
        ? { client_conversation_id: metadata.conversationId }
        : {}),
      ...(metadata.turnId ? { client_turn_id: metadata.turnId } : {}),
      ...(metadata.imageId ? { client_image_id: metadata.imageId } : {}),
    },
  });
}

export async function createImageEditTask(
  clientTaskId: string,
  files: File | File[],
  prompt: string,
  model?: ImageModel,
  size?: string,
  quality = "auto",
  metadata: { conversationId?: string; turnId?: string; imageId?: string } = {}
) {
  const formData = new FormData();
  const uploadFiles = Array.isArray(files) ? files : [files];

  uploadFiles.forEach((file) => {
    formData.append("image", file);
  });
  formData.append("client_task_id", clientTaskId);
  formData.append("prompt", prompt);
  if (model) {
    formData.append("model", model);
  }
  if (size) {
    formData.append("size", size);
  }
  formData.append("quality", quality);
  if (metadata.conversationId) {
    formData.append("client_conversation_id", metadata.conversationId);
  }
  if (metadata.turnId) {
    formData.append("client_turn_id", metadata.turnId);
  }
  if (metadata.imageId) {
    formData.append("client_image_id", metadata.imageId);
  }

  return httpRequest<ImageTask>("/api/image-tasks/edits", {
    method: "POST",
    redirectOnUnauthorized: false,
    body: formData,
  });
}

export async function fetchImageTasks(ids: string[]) {
  const params = new URLSearchParams();
  if (ids.length > 0) {
    params.set("ids", ids.join(","));
  }
  params.set("_t", String(Date.now()));
  return httpRequest<ImageTaskListResponse>(
    `/api/image-tasks?${params.toString()}`,
    {
      redirectOnUnauthorized: false,
    }
  );
}

export async function updateImageTaskFeedback(
  taskId: string,
  imageIndex: number,
  vote: ImageFeedbackVote | null
) {
  return httpRequest<ImageTask>(
    `/api/image-tasks/${encodeURIComponent(taskId)}/feedback`,
    {
      method: "POST",
      redirectOnUnauthorized: false,
      body: {
        image_index: imageIndex,
        vote,
      },
    }
  );
}

export async function fetchImageConversations() {
  return httpRequest<ImageConversationListResponse>(
    `/api/image-conversations?_t=${Date.now()}`,
    {
      redirectOnUnauthorized: false,
    }
  );
}

export async function upsertImageConversation(
  conversationId: string,
  title: string
) {
  return httpRequest<ImageConversationItemResponse>(
    `/api/image-conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PUT",
      redirectOnUnauthorized: false,
      body: { title },
    }
  );
}

export async function createImageConversationTurn(
  conversationId: string,
  turn: ImageConversationTurnPayload
) {
  return httpRequest<ImageConversationItemResponse>(
    `/api/image-conversations/${encodeURIComponent(conversationId)}/turns`,
    {
      method: "POST",
      redirectOnUnauthorized: false,
      body: turn,
    }
  );
}

export async function updateImageConversationTurn(
  conversationId: string,
  turnId: string,
  updates: ImageConversationTurnPatch
) {
  return httpRequest<ImageConversationItemResponse>(
    `/api/image-conversations/${encodeURIComponent(
      conversationId
    )}/turns/${encodeURIComponent(turnId)}`,
    {
      method: "PATCH",
      redirectOnUnauthorized: false,
      body: updates,
    }
  );
}

export async function updateImageConversationResult(
  conversationId: string,
  imageId: string,
  updates: ImageConversationResultPatch
) {
  return httpRequest<ImageConversationItemResponse>(
    `/api/image-conversations/${encodeURIComponent(
      conversationId
    )}/results/${encodeURIComponent(imageId)}`,
    {
      method: "PATCH",
      redirectOnUnauthorized: false,
      body: updates,
    }
  );
}

export async function deleteServerImageConversation(conversationId: string) {
  return httpRequest<{ ok: boolean }>(
    `/api/image-conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "DELETE",
      redirectOnUnauthorized: false,
    }
  );
}

export async function fetchSeedGallery(
  params: {
    query?: string;
    category?: string;
    watermark_status?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const staticItems = await fetchSeedGalleryStaticItems();
  if (staticItems) {
    return paginateSeedGalleryItems(
      filterSeedGalleryItems(staticItems, params),
      params.limit || 60,
      params.offset || 0
    );
  }

  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.category) search.set("category", params.category);
  if (params.watermark_status)
    search.set("watermark_status", params.watermark_status);
  search.set("limit", String(params.limit || 60));
  search.set("offset", String(params.offset || 0));
  return cachedSeedGalleryRequest<SeedGalleryListResponse>(
    `/api/seed-gallery?${search.toString()}`,
    seedGalleryListCacheMaxAgeMs
  );
}

export async function fetchSeedGalleryFacets() {
  const staticItems = await fetchSeedGalleryStaticItems();
  if (staticItems) {
    return buildStaticSeedGalleryFacets(staticItems);
  }

  return cachedSeedGalleryRequest<SeedGalleryFacetsResponse>(
    "/api/seed-gallery/facets",
    seedGalleryFacetCacheMaxAgeMs
  );
}

export async function fetchSeedGalleryItem(id: string) {
  const staticItems = await fetchSeedGalleryStaticItems();
  if (staticItems) {
    const item = staticItems.find((candidate) => candidate.id === id);
    if (!item) {
      throw new Error("图库素材不存在");
    }
    return { item };
  }

  return cachedSeedGalleryRequest<{ item: SeedGalleryItem }>(
    `/api/seed-gallery/${encodeURIComponent(id)}`,
    seedGalleryDetailCacheMaxAgeMs
  );
}

export async function fetchRelatedSeedGalleryItems(id: string, limit = 4) {
  const staticItems = await fetchSeedGalleryStaticItems();
  if (staticItems) {
    const item = staticItems.find((candidate) => candidate.id === id);
    if (!item) {
      return paginateSeedGalleryItems([], limit, 0);
    }
    const itemTags = new Set(item.tags.map((tag) => tag.toLowerCase()));
    const related = staticItems
      .filter((candidate) => candidate.id !== id)
      .map((candidate, index) => {
        const categoryScore = candidate.category === item.category ? 100 : 0;
        const tagScore = candidate.tags.reduce(
          (score, tag) => score + (itemTags.has(tag.toLowerCase()) ? 10 : 0),
          0
        );
        return { item: candidate, index, score: categoryScore + tagScore };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((candidate) => candidate.item);
    return paginateSeedGalleryItems(related, limit, 0);
  }

  const search = new URLSearchParams();
  search.set("limit", String(limit));
  return cachedSeedGalleryRequest<SeedGalleryListResponse>(
    `/api/seed-gallery/${encodeURIComponent(id)}/related?${search.toString()}`,
    seedGalleryDetailCacheMaxAgeMs
  );
}

export async function summarizeUserGalleryItem(payload: GalleryTextPayload) {
  return httpRequest<{ summary: string }>("/api/user-gallery/summarize", {
    method: "POST",
    body: payload,
  });
}

export async function generateUserGallerySharePrompt(
  payload: GalleryTextPayload & { conversation_summary?: string }
) {
  return httpRequest<{ share_prompt: string }>(
    "/api/user-gallery/generate-share-prompt",
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function saveShareDraft(payload: SaveShareDraftPayload) {
  return httpRequest<{ item: ShareDraft }>("/api/share-drafts", {
    method: "POST",
    body: payload,
  });
}

export async function fetchShareDrafts() {
  return httpRequest<{ items: ShareDraft[] }>("/api/share-drafts");
}

export async function fetchSettingsConfig() {
  return httpRequest<{ config: SettingsConfig }>("/api/settings");
}

export async function updateSettingsConfig(settings: SettingsConfig) {
  return httpRequest<{ config: SettingsConfig }>("/api/settings", {
    method: "POST",
    body: settings,
  });
}

export async function testImageStorageConnection() {
  return httpRequest<{
    result: { ok: boolean; status: number; error?: string };
  }>("/api/image-storage/test", {
    method: "POST",
    body: {},
  });
}

export async function syncImageStorage() {
  return httpRequest<{
    result: { uploaded: number; skipped: number; failed: number };
  }>("/api/image-storage/sync", {
    method: "POST",
    body: {},
  });
}

export async function fetchManagedImages(filters: {
  start_date?: string;
  end_date?: string;
}) {
  const params = new URLSearchParams();
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{
    items: ManagedImage[];
    groups: Array<{ date: string; items: ManagedImage[] }>;
  }>(`/api/images${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function deleteManagedImages(body: {
  paths?: string[];
  start_date?: string;
  end_date?: string;
  all_matching?: boolean;
}) {
  return httpRequest<{ removed: number }>("/api/images/delete", {
    method: "POST",
    body,
  });
}

export async function downloadImages(paths: string[]) {
  const downloadToken = await createImageDownloadToken(paths);
  const params = new URLSearchParams();
  paths.forEach((path) => params.append("path", path));
  if (downloadToken) {
    params.set("download_token", downloadToken);
  }
  const href = `/api/images/download?${params.toString()}`;
  if (downloadToken && href.length < 7000) {
    triggerBrowserDownload(href, "images.zip");
    return;
  }

  const response = await request.post(
    "/api/images/download",
    { paths },
    { responseType: "blob" }
  );
  const blob = response.data as Blob;
  triggerBlobDownload(blob, "images.zip");
}

export async function downloadSingleImage(path: string) {
  const downloadToken = await createImageDownloadToken([path]);
  if (downloadToken) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const params = new URLSearchParams({ download_token: downloadToken });
    triggerBrowserDownload(
      `/api/images/download/${encodedPath}?${params.toString()}`,
      path.split("/").pop() || "image.png"
    );
    return;
  }

  const response = await request.get(`/api/images/download/${path}`, {
    responseType: "blob",
  });
  const blob = response.data as Blob;
  triggerBlobDownload(blob, path.split("/").pop() || "image.png");
}

export async function createImageAccessLink(source: string) {
  const data = await httpRequest<{ url: string; path: string }>(
    "/api/images/access-link",
    {
      method: "POST",
      body: { url: source },
      redirectOnUnauthorized: false,
    }
  );
  return String(data.url || "").trim();
}

async function createImageDownloadToken(paths: string[]) {
  const authKey = await getStoredAuthKey();
  if (!authKey || paths.length === 0) {
    return "";
  }
  try {
    const data = await httpRequest<{ token: string }>(
      "/api/images/download-token",
      {
        method: "POST",
        body: { paths },
        redirectOnUnauthorized: false,
      }
    );
    return String(data.token || "").trim();
  } catch {
    return "";
  }
}

function triggerBrowserDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchImageTags() {
  return httpRequest<{ tags: string[] }>("/api/images/tags");
}

export async function setImageTags(path: string, tags: string[]) {
  return httpRequest<{ ok: boolean; tags: string[] }>("/api/images/tags", {
    method: "POST",
    body: { path, tags },
  });
}

export async function deleteImageTag(tag: string) {
  return httpRequest<{ ok: boolean; removed_from: number }>(
    `/api/images/tags/${encodeURIComponent(tag)}`,
    {
      method: "DELETE",
    }
  );
}

export type ImageStorageStats = {
  disk_total_mb: number;
  disk_used_mb: number;
  disk_free_mb: number;
  image_count: number;
  image_size_mb: number;
  image_size_bytes: number;
};

export async function fetchImageStorage() {
  return httpRequest<ImageStorageStats>("/api/images/storage");
}

export async function compressAllImages() {
  return httpRequest<{
    compressed: number;
    saved_bytes: number;
    saved_mb: number;
  }>("/api/images/storage/compress", { method: "POST" });
}

export async function deleteToTarget(targetFreeMb: number) {
  return httpRequest<{ removed: number; freed_mb: number; done: boolean }>(
    `/api/images/storage/cleanup-to-target?target_free_mb=${targetFreeMb}&dry_run=false`,
    { method: "POST" }
  );
}

export async function fetchSystemLogs(filters: {
  type?: string;
  start_date?: string;
  end_date?: string;
}) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{ items: SystemLog[] }>(
    `/api/logs${params.toString() ? `?${params.toString()}` : ""}`
  );
}

export async function deleteSystemLogs(ids: string[]) {
  return httpRequest<{ removed: number }>("/api/logs/delete", {
    method: "POST",
    body: { ids },
  });
}

export async function fetchUserKeys() {
  return httpRequest<{ items: UserKey[] }>("/api/auth/users");
}

export async function createUserKey(name: string) {
  return createUserKeyWithOptions({ name });
}

export async function createUserKeyWithOptions({
  name,
  key,
}: {
  name: string;
  key?: string;
}) {
  return httpRequest<{ item: UserKey; key: string; items: UserKey[] }>(
    "/api/auth/users",
    {
      method: "POST",
      body: { name, key },
    }
  );
}

export async function updateUserKey(
  keyId: string,
  updates: {
    enabled?: boolean;
    name?: string;
    key?: string;
    watermark_unlocked?: boolean;
  }
) {
  return httpRequest<{ item: UserKey; items: UserKey[] }>(
    `/api/auth/users/${keyId}`,
    {
      method: "POST",
      body: updates,
    }
  );
}

export async function deleteUserKey(keyId: string) {
  return httpRequest<{ items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "DELETE",
  });
}

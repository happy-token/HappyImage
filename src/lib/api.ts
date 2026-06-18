import localforage from "localforage";

import { httpRequest, request } from "@/lib/request";

export type AccountType = string;
export type AccountStatus = "正常" | "限流" | "异常" | "禁用";
export type ImageModel = string;
export type AuthRole = "admin" | "user";
export type ImageStorageMode = "local" | "webdav" | "both";

export type ImageStorageSettings = {
  enabled: boolean;
  mode: ImageStorageMode;
  webdav_url: string;
  webdav_username: string;
  webdav_password: string;
  webdav_root_path: string;
  public_base_url: string;
};

export type Account = {
  access_token: string;
  type: AccountType;
  source_type?: string | null;
  status: AccountStatus;
  quota: number;
  image_quota_unknown?: boolean;
  email?: string | null;
  user_id?: string | null;
  limits_progress?: Array<{
    feature_name?: string;
    remaining?: number;
    reset_after?: string;
  }>;
  default_model_slug?: string | null;
  restore_at?: string | null;
  success: number;
  fail: number;
  last_used_at?: string | null;
  proxy?: string | null;
};

export type AccountImportPayload = {
  access_token: string;
  accessToken?: string;
  type?: string;
  export_type?: string;
  source_type?: string;
  [key: string]: unknown;
};

export type Model = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  permission: unknown[];
  root: string;
  parent: string | null;
};

type AccountListResponse = {
  items: Account[];
};

type ModelListResponse = {
  object: string;
  data: Model[];
};

type AccountMutationResponse = {
  items: Account[];
  added?: number;
  skipped?: number;
  removed?: number;
  refreshed?: number;
  relogined?: number;
  errors?: Array<{ access_token: string; error: string }>;
};

export type AccountRefreshResponse = {
  items: Account[];
  refreshed: number;
  relogined?: number;
  errors: Array<{ access_token: string; error: string }>;
};

export type RefreshProgressResponse = {
  total: number;
  processed: number;
  done: boolean;
  error: string | null;
  status_counts?: Record<string, number>;
  total_quota?: number;
  result?: AccountRefreshResponse | null;
  results?: Array<{ token: string; status: string; error?: string | null }>;
};

type AccountUpdateResponse = {
  item: Account;
  items: Account[];
};

export type OIDCSettings = {
  enabled: boolean;
  issuer: string;
  client_id: string;
  client_secret?: string;
  client_secret_configured?: boolean;
  scopes: string;
  allowed_email_domains: string;
  default_image_quota: number | string;
};

export type SettingsConfig = {
  proxy: string;
  base_url?: string;
  frontend_base_url?: string;
  api_base_url?: string;
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
  refresh_account_interval_minute?: number | string;
  image_retention_days?: number | string;
  image_poll_timeout_secs?: number | string;
  image_account_concurrency?: number | string;
  image_parallel_generation?: boolean;
  image_settle_enabled?: boolean;
  image_check_before_hit_enabled?: boolean;
  image_settle_secs?: number | string;
  image_timeout_retry_secs?: number | string;
  auto_remove_invalid_accounts?: boolean;
  auto_remove_rate_limited_accounts?: boolean;
  auto_relogin_after_refresh?: boolean;
  log_levels?: string[];
  oidc?: OIDCSettings;
  image_storage?: ImageStorageSettings;
  backup?: BackupSettings;
  backup_state?: BackupState;
  [key: string]: unknown;
};

export type BackupInclude = {
  config: boolean;
  cpa: boolean;
  sub2api: boolean;
  logs: boolean;
  image_tasks: boolean;
  accounts_snapshot: boolean;
  auth_keys_snapshot: boolean;
  images: boolean;
};

export type BackupSettings = {
  enabled: boolean;
  provider: "cloudflare_r2" | string;
  account_id: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string;
  prefix: string;
  interval_minutes: number | string;
  rotation_keep: number | string;
  encrypt: boolean;
  passphrase: string;
  include: BackupInclude;
};

export type BackupState = {
  running: boolean;
  last_started_at?: string | null;
  last_finished_at?: string | null;
  last_status?: string;
  last_error?: string | null;
  last_object_key?: string | null;
};

export type BackupItem = {
  key: string;
  name: string;
  size: number;
  updated_at?: string | null;
  encrypted: boolean;
};

export type BackupDetail = {
  key: string;
  name: string;
  encrypted: boolean;
  created_at?: string | null;
  trigger?: string | null;
  app_version?: string | null;
  storage_backend?: Record<string, unknown> | null;
  files: Array<{
    name: string;
    exists: boolean;
    content_type?: string;
    size: number;
    sha256?: string;
  }>;
  snapshots: Array<{
    name: string;
    count: number;
  }>;
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

export type ShareDraftStatus = "draft" | "pending_review" | "approved" | "rejected";

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

export type SaveShareDraftPayload = Omit<ShareDraft, "id" | "created_at" | "updated_at"> & {
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

export type UserQuotaLog = {
  id: string;
  time: string;
  type: "user_quota";
  summary?: string;
  detail?: {
    action?: string;
    user_id?: string;
    user_name?: string;
    operator_id?: string;
    operator_name?: string;
    amount?: number | null;
    before_quota?: number | null;
    after_quota?: number | null;
    enabled_before?: boolean;
    enabled_after?: boolean;
  };
};

export type ImageResponse = {
  created: number;
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
};

export type ImageTask = {
  id: string;
  status: "queued" | "running" | "success" | "error";
  mode: "generate" | "edit";
  model?: ImageModel;
  size?: string;
  quality?: string;
  created_at: string;
  updated_at: string;
  conversation_id?: string;
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: string;
  progress?: string;
  elapsed_secs?: number;
  duration_ms?: number;
};

type ImageTaskListResponse = {
  items: ImageTask[];
  missing_ids: string[];
};

type LocalApiCacheRecord<T> = {
  createdAt: number;
  data: T;
};

const seedGalleryApiCacheVersion = "v6-curated-portrait-count-sorted";
const seedGalleryLocalCachePrefix = `happyimage:seed-gallery-api-cache:${seedGalleryApiCacheVersion}:`;
const seedGalleryLocalCacheIndexKey = "__index";
const seedGalleryListCacheMaxAgeMs = 10 * 60 * 1000;
const seedGalleryDetailCacheMaxAgeMs = 24 * 60 * 60 * 1000;
const seedGalleryFacetCacheMaxAgeMs = 60 * 60 * 1000;
const seedGalleryLocalCacheMaxEntries = 180;
const seedGalleryLocalCacheMaxPayloadLength = 900_000;

const seedGalleryApiCache = localforage.createInstance({
  name: "happyimage",
  storeName: "seed_gallery_api_cache",
});
const seedGalleryMemoryCache = new Map<string, LocalApiCacheRecord<unknown>>();

function getLocalApiCacheKey(path: string) {
  return `${seedGalleryLocalCachePrefix}${path}`;
}

function appendSeedGalleryCacheVersion(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}gallery_cache=${seedGalleryApiCacheVersion}`;
}

async function readLocalApiCacheIndex() {
  try {
    const value = await seedGalleryApiCache.getItem<string[]>(seedGalleryLocalCacheIndexKey);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function writeLocalApiCacheIndex(keys: string[]) {
  try {
    await seedGalleryApiCache.setItem(seedGalleryLocalCacheIndexKey, keys.slice(-seedGalleryLocalCacheMaxEntries));
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
      }),
    );
  }
  await writeLocalApiCacheIndex(keys);
}

async function readLocalApiCache<T>(path: string, maxAgeMs: number): Promise<T | null> {
  const key = getLocalApiCacheKey(path);
  const memoryRecord = seedGalleryMemoryCache.get(key) as LocalApiCacheRecord<T> | undefined;
  if (memoryRecord && Date.now() - Number(memoryRecord.createdAt || 0) <= maxAgeMs) {
    return memoryRecord.data;
  }

  try {
    const record = await seedGalleryApiCache.getItem<LocalApiCacheRecord<T>>(key);
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
  const record = { createdAt: Date.now(), data } satisfies LocalApiCacheRecord<T>;
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
    void httpRequest<T>(versionedPath).then((data) => writeLocalApiCache(versionedPath, data)).catch(() => {});
    return cached;
  }
  const data = await httpRequest<T>(versionedPath);
  void writeLocalApiCache(versionedPath, data);
  return data;
}

export type LoginResponse = {
  ok: boolean;
  version: string;
  role: AuthRole;
  subject_id: string;
  name: string;
  image_quota?: number | null;
  access_token?: string;
  token_type?: string;
  expires_in?: number | null;
  user?: {
    id: string;
    name: string;
    role: AuthRole;
    image_quota?: number | null;
  };
};

export type UserKey = {
  id: string;
  name: string;
  role: "user";
  enabled: boolean;
  image_quota?: number | null;
  created_at: string | null;
  last_used_at: string | null;
};

export async function login(authKey: string) {
  return loginWithAccessKey(authKey);
}

export async function loginWithAccessKey(authKey: string) {
  const normalizedAuthKey = String(authKey || "").trim();
  return httpRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { access_key: normalizedAuthKey },
    redirectOnUnauthorized: false,
  });
}

export async function loginWithPassword(credentials: { email: string; password: string }) {
  return httpRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
    },
    redirectOnUnauthorized: false,
  });
}

export async function registerWithPassword(credentials: { name: string; password: string; confirmPassword?: string }) {
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

export async function fetchAccounts() {
  return httpRequest<AccountListResponse>("/api/accounts");
}

export async function fetchModels() {
  return httpRequest<ModelListResponse>("/v1/models");
}

export async function createAccounts(tokens: string[], accounts: AccountImportPayload[] = []) {
  return httpRequest<AccountMutationResponse>("/api/accounts", {
    method: "POST",
    body: { tokens, accounts },
  });
}

export type OAuthLoginStartResponse = {
  session_id: string;
  authorize_url: string;
  expires_in: string;
  redirect_uri_prefix: string;
};

export async function startOAuthLogin(emailHint?: string) {
  return httpRequest<OAuthLoginStartResponse>("/api/accounts/oauth/start", {
    method: "POST",
    body: { email_hint: emailHint ?? "" },
  });
}

export async function finishOAuthLogin(sessionId: string, callback: string) {
  return httpRequest<AccountMutationResponse>("/api/accounts/oauth/finish", {
    method: "POST",
    body: { session_id: sessionId, callback },
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
  image_quota?: number | null;
  user?: {
    id: string;
    name: string;
    role: AuthRole;
    image_quota?: number | null;
  };
};

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

export async function logoutSession() {
  return httpRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    redirectOnUnauthorized: false,
  });
}

export async function deleteAccounts(tokens: string[]) {
  return httpRequest<AccountMutationResponse>("/api/accounts", {
    method: "DELETE",
    body: { tokens },
  });
}

export async function refreshAccounts(accessTokens: string[]) {
  return httpRequest<{ progress_id: string }>("/api/accounts/refresh", {
    method: "POST",
    body: { access_tokens: accessTokens },
  });
}

export async function fetchRefreshProgress(progressId: string) {
  return httpRequest<RefreshProgressResponse>(`/api/accounts/refresh/progress/${progressId}`);
}

export async function reLoginAccounts(accessTokens: string[]) {
  return httpRequest<{ progress_id: string }>("/api/accounts/re-login", {
    method: "POST",
    body: { access_tokens: accessTokens },
  });
}

export async function fetchReLoginProgress(progressId: string) {
  return httpRequest<RefreshProgressResponse>(`/api/accounts/re-login/progress/${progressId}`);
}

export async function updateAccount(
  accessToken: string,
  updates: {
    type?: AccountType;
    status?: AccountStatus;
    quota?: number;
    proxy?: string;
  },
) {
  return httpRequest<AccountUpdateResponse>("/api/accounts/update", {
    method: "POST",
    body: {
      access_token: accessToken,
      ...updates,
    },
  });
}

export async function generateImage(prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  return httpRequest<ImageResponse>(
    "/v1/images/generations",
    {
      method: "POST",
      body: {
        prompt,
        ...(model ? { model } : {}),
        ...(size ? { size } : {}),
        quality,
        n: 1,
        response_format: "b64_json",
      },
    },
  );
}

export async function editImage(files: File | File[], prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  const formData = new FormData();
  const uploadFiles = Array.isArray(files) ? files : [files];

  uploadFiles.forEach((file) => {
    formData.append("image", file);
  });
  formData.append("prompt", prompt);
  if (model) {
    formData.append("model", model);
  }
  if (size) {
    formData.append("size", size);
  }
  formData.append("quality", quality);
  formData.append("n", "1");

  return httpRequest<ImageResponse>(
    "/v1/images/edits",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function createImageGenerationTask(clientTaskId: string, prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  return httpRequest<ImageTask>("/api/image-tasks/generations", {
    method: "POST",
    body: {
      client_task_id: clientTaskId,
      prompt,
      ...(model ? { model } : {}),
      ...(size ? { size } : {}),
      quality,
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

  return httpRequest<ImageTask>("/api/image-tasks/edits", {
    method: "POST",
    body: formData,
  });
}

export async function fetchImageTasks(ids: string[]) {
  const params = new URLSearchParams();
  if (ids.length > 0) {
    params.set("ids", ids.join(","));
  }
  params.set("_t", String(Date.now()));
  return httpRequest<ImageTaskListResponse>(`/api/image-tasks?${params.toString()}`);
}

export async function resumeImagePoll(taskId: string, extraTimeoutSecs = 30) {
  return httpRequest<ImageTask>(`/api/image-tasks/${encodeURIComponent(taskId)}/resume-poll`, {
    method: "POST",
    body: { extra_timeout_secs: extraTimeoutSecs },
  });
}

export async function fetchSeedGallery(params: {
  query?: string;
  category?: string;
  watermark_status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.category) search.set("category", params.category);
  if (params.watermark_status) search.set("watermark_status", params.watermark_status);
  search.set("limit", String(params.limit || 60));
  search.set("offset", String(params.offset || 0));
  return cachedSeedGalleryRequest<SeedGalleryListResponse>(
    `/api/seed-gallery?${search.toString()}`,
    seedGalleryListCacheMaxAgeMs,
  );
}

export async function fetchSeedGalleryFacets() {
  return cachedSeedGalleryRequest<SeedGalleryFacetsResponse>("/api/seed-gallery/facets", seedGalleryFacetCacheMaxAgeMs);
}

export async function fetchSeedGalleryItem(id: string) {
  return cachedSeedGalleryRequest<{ item: SeedGalleryItem }>(
    `/api/seed-gallery/${encodeURIComponent(id)}`,
    seedGalleryDetailCacheMaxAgeMs,
  );
}

export async function fetchRelatedSeedGalleryItems(id: string, limit = 4) {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  return cachedSeedGalleryRequest<SeedGalleryListResponse>(
    `/api/seed-gallery/${encodeURIComponent(id)}/related?${search.toString()}`,
    seedGalleryDetailCacheMaxAgeMs,
  );
}

export async function summarizeUserGalleryItem(payload: GalleryTextPayload) {
  return httpRequest<{ summary: string }>("/api/user-gallery/summarize", {
    method: "POST",
    body: payload,
  });
}

export async function generateUserGallerySharePrompt(payload: GalleryTextPayload & { conversation_summary?: string }) {
  return httpRequest<{ share_prompt: string }>("/api/user-gallery/generate-share-prompt", {
    method: "POST",
    body: payload,
  });
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

export async function testBackupConnection() {
  return httpRequest<{ result: { ok: boolean; status: number } }>("/api/backup/test", {
    method: "POST",
    body: {},
  });
}

export async function testImageStorageConnection() {
  return httpRequest<{ result: { ok: boolean; status: number; error?: string } }>("/api/image-storage/test", {
    method: "POST",
    body: {},
  });
}

export async function syncImageStorage() {
  return httpRequest<{ result: { uploaded: number; skipped: number; failed: number } }>("/api/image-storage/sync", {
    method: "POST",
    body: {},
  });
}

export async function fetchBackups() {
  return httpRequest<{ items: BackupItem[]; state: BackupState; settings: BackupSettings }>("/api/backups");
}

export async function runBackupNow() {
  return httpRequest<{ result: { key: string; size: number; encrypted: boolean } }>("/api/backups/run", {
    method: "POST",
    body: {},
  });
}

export async function deleteBackup(key: string) {
  return httpRequest<{ ok: boolean }>("/api/backups/delete", {
    method: "POST",
    body: { key },
  });
}

export async function fetchBackupDetail(key: string) {
  const params = new URLSearchParams();
  params.set("key", key);
  return httpRequest<{ item: BackupDetail }>(`/api/backups/detail?${params.toString()}`);
}

export function getBackupDownloadUrl(key: string) {
  const params = new URLSearchParams();
  params.set("key", key);
  return `/api/backups/download?${params.toString()}`;
}

export async function fetchManagedImages(filters: { start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{ items: ManagedImage[]; groups: Array<{ date: string; items: ManagedImage[] }> }>(
    `/api/images${params.toString() ? `?${params.toString()}` : ""}`,
  );
}

export async function deleteManagedImages(body: { paths?: string[]; start_date?: string; end_date?: string; all_matching?: boolean }) {
  return httpRequest<{ removed: number }>("/api/images/delete", { method: "POST", body });
}

export async function downloadImages(paths: string[]) {
  const response = await request.post("/api/images/download", { paths }, { responseType: "blob" });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "images.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadSingleImage(path: string) {
  const response = await request.get(`/api/images/download/${path}`, { responseType: "blob" });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop() || "image.png";
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
  return httpRequest<{ ok: boolean; removed_from: number }>(`/api/images/tags/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
}

export type ImageStorageStats = {
  disk_total_mb: number; disk_used_mb: number; disk_free_mb: number;
  image_count: number; image_size_mb: number; image_size_bytes: number;
};

export async function fetchImageStorage() {
  return httpRequest<ImageStorageStats>("/api/images/storage");
}

export async function compressAllImages() {
  return httpRequest<{ compressed: number; saved_bytes: number; saved_mb: number }>("/api/images/storage/compress", { method: "POST" });
}

export async function deleteToTarget(targetFreeMb: number) {
  return httpRequest<{ removed: number; freed_mb: number; done: boolean }>(
    `/api/images/storage/cleanup-to-target?target_free_mb=${targetFreeMb}&dry_run=false`,
    { method: "POST" },
  );
}

export async function fetchSystemLogs(filters: { type?: string; start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{ items: SystemLog[] }>(`/api/logs${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function fetchUserQuotaLogs(filters: { user_id?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  return httpRequest<{ items: UserQuotaLog[] }>(`/api/auth/user-quota-logs${params.toString() ? `?${params.toString()}` : ""}`);
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
  image_quota,
}: {
  name: string;
  key?: string;
  image_quota?: number;
}) {
  return httpRequest<{ item: UserKey; key: string; items: UserKey[] }>("/api/auth/users", {
    method: "POST",
    body: { name, key, image_quota },
  });
}

export async function updateUserKey(keyId: string, updates: { enabled?: boolean; name?: string; key?: string; image_quota?: number }) {
  return httpRequest<{ item: UserKey; items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteUserKey(keyId: string) {
  return httpRequest<{ items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "DELETE",
  });
}

// ── CPA (CLIProxyAPI) ──────────────────────────────────────────────

export type CPAPool = {
  id: string;
  name: string;
  base_url: string;
  import_job?: CPAImportJob | null;
};

export type CPARemoteFile = {
  name: string;
  email: string;
};

export type CPAImportJob = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  total: number;
  completed: number;
  added: number;
  skipped: number;
  refreshed: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
};

export async function fetchCPAPools() {
  return httpRequest<{ pools: CPAPool[] }>("/api/cpa/pools");
}

export async function createCPAPool(pool: { name: string; base_url: string; secret_key: string }) {
  return httpRequest<{ pool: CPAPool; pools: CPAPool[] }>("/api/cpa/pools", {
    method: "POST",
    body: pool,
  });
}

export async function updateCPAPool(
  poolId: string,
  updates: { name?: string; base_url?: string; secret_key?: string },
) {
  return httpRequest<{ pool: CPAPool; pools: CPAPool[] }>(`/api/cpa/pools/${poolId}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteCPAPool(poolId: string) {
  return httpRequest<{ pools: CPAPool[] }>(`/api/cpa/pools/${poolId}`, {
    method: "DELETE",
  });
}

export async function fetchCPAPoolFiles(poolId: string) {
  return httpRequest<{ pool_id: string; files: CPARemoteFile[] }>(`/api/cpa/pools/${poolId}/files`);
}

export async function startCPAImport(poolId: string, names: string[]) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/cpa/pools/${poolId}/import`, {
    method: "POST",
    body: { names },
  });
}

export async function fetchCPAPoolImportJob(poolId: string) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/cpa/pools/${poolId}/import`);
}

// ── Sub2API ────────────────────────────────────────────────────────

export type Sub2APIServer = {
  id: string;
  name: string;
  base_url: string;
  email: string;
  has_api_key: boolean;
  group_id: string;
  import_job?: CPAImportJob | null;
};

export type Sub2APIRemoteAccount = {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  status: string;
  expires_at: string;
  has_refresh_token: boolean;
};

export type Sub2APIRemoteGroup = {
  id: string;
  name: string;
  description: string;
  platform: string;
  status: string;
  account_count: number;
  active_account_count: number;
};

export async function fetchSub2APIServers() {
  return httpRequest<{ servers: Sub2APIServer[] }>("/api/sub2api/servers");
}

export async function createSub2APIServer(server: {
  name: string;
  base_url: string;
  email: string;
  password: string;
  api_key: string;
  group_id: string;
}) {
  return httpRequest<{ server: Sub2APIServer; servers: Sub2APIServer[] }>("/api/sub2api/servers", {
    method: "POST",
    body: server,
  });
}

export async function updateSub2APIServer(
  serverId: string,
  updates: {
    name?: string;
    base_url?: string;
    email?: string;
    password?: string;
    api_key?: string;
    group_id?: string;
  },
) {
  return httpRequest<{ server: Sub2APIServer; servers: Sub2APIServer[] }>(`/api/sub2api/servers/${serverId}`, {
    method: "POST",
    body: updates,
  });
}

export async function fetchSub2APIServerGroups(serverId: string) {
  return httpRequest<{ server_id: string; groups: Sub2APIRemoteGroup[] }>(
    `/api/sub2api/servers/${serverId}/groups`,
  );
}

export async function deleteSub2APIServer(serverId: string) {
  return httpRequest<{ servers: Sub2APIServer[] }>(`/api/sub2api/servers/${serverId}`, {
    method: "DELETE",
  });
}

export async function fetchSub2APIServerAccounts(serverId: string) {
  return httpRequest<{ server_id: string; accounts: Sub2APIRemoteAccount[] }>(
    `/api/sub2api/servers/${serverId}/accounts`,
  );
}

export async function startSub2APIImport(serverId: string, accountIds: string[]) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/sub2api/servers/${serverId}/import`, {
    method: "POST",
    body: { account_ids: accountIds },
  });
}

export async function fetchSub2APIImportJob(serverId: string) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/sub2api/servers/${serverId}/import`);
}

// ── Upstream proxy ────────────────────────────────────────────────

export type ProxySettings = {
  enabled: boolean;
  url: string;
};

export type ProxyTestResult = {
  ok: boolean;
  status: number;
  latency_ms: number;
  error: string | null;
};

export async function fetchProxy() {
  return httpRequest<{ proxy: ProxySettings }>("/api/proxy");
}

export async function updateProxy(updates: { enabled?: boolean; url?: string }) {
  return httpRequest<{ proxy: ProxySettings }>("/api/proxy", {
    method: "POST",
    body: updates,
  });
}

export async function testProxy(url?: string) {
  return httpRequest<{ result: ProxyTestResult }>("/api/proxy/test", {
    method: "POST",
    body: { url: url ?? "" },
  });
}

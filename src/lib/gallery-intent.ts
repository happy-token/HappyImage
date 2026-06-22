export const GALLERY_PROMPT_STORAGE_KEY = "happytoken:seed-gallery:selected-prompt";

export type GalleryPromptSourceKind = "official" | "user" | "seed";

export type GalleryPromptIntent = {
  prompt: string;
  sourceGalleryId: string;
  sourceKind: GalleryPromptSourceKind;
  title?: string;
  imageUrl?: string;
};

function getGalleryPromptStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveGalleryPromptIntent(intent: GalleryPromptIntent) {
  const storage = getGalleryPromptStorage();
  if (!storage) return;

  try {
    storage.setItem(GALLERY_PROMPT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    return;
  }
}

function parseGalleryPromptIntent(raw: string): GalleryPromptIntent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GalleryPromptIntent>;
    const prompt = String(parsed.prompt || "").trim();
    if (!prompt) return null;

    const sourceKind =
      parsed.sourceKind === "official" || parsed.sourceKind === "user" || parsed.sourceKind === "seed"
        ? parsed.sourceKind
        : "seed";

    return {
      prompt,
      sourceGalleryId: String(parsed.sourceGalleryId || "").trim(),
      sourceKind,
      title: parsed.title ? String(parsed.title).trim() : undefined,
      imageUrl: parsed.imageUrl ? String(parsed.imageUrl).trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function loadGalleryPromptIntent(): GalleryPromptIntent | null {
  const storage = getGalleryPromptStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(GALLERY_PROMPT_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;
  return parseGalleryPromptIntent(raw);
}

export function clearGalleryPromptIntent() {
  const storage = getGalleryPromptStorage();
  if (!storage) return;

  try {
    storage.removeItem(GALLERY_PROMPT_STORAGE_KEY);
  } catch {
    return;
  }
}

export function consumeGalleryPromptIntent(): GalleryPromptIntent | null {
  const intent = loadGalleryPromptIntent();
  clearGalleryPromptIntent();
  return intent;
}

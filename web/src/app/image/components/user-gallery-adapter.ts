import type { ImageConversation, ImageTurn, StoredImage } from "@/store/image-conversations";

export type UserGalleryItem = {
  id: string;
  imageUrl: string;
  shareableImageUrl?: string;
  conversationId: string;
  conversationTitle: string;
  turnId: string;
  imageId: string;
  originalPrompt: string;
  revisedPrompt?: string;
  createdAt: string;
  model: string;
  size: string;
  quality: string;
};

const SHAREABLE_IMAGE_URL_MAX_LENGTH = 2048;

function storedImageUrl(image: StoredImage) {
  if (image.url) return image.url;
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`;
  return "";
}

function shareableImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:") || imageUrl.length > SHAREABLE_IMAGE_URL_MAX_LENGTH) {
    return undefined;
  }
  return imageUrl;
}

function toGalleryItems(conversation: ImageConversation, turn: ImageTurn): UserGalleryItem[] {
  if (turn.promptDeleted || turn.resultsDeleted || !turn.prompt.trim()) return [];
  return turn.images.flatMap((image) => {
    if (image.status !== "success") return [];
    const imageUrl = storedImageUrl(image);
    if (!imageUrl) return [];
    return [
      {
        id: `${conversation.id}:${turn.id}:${image.id}`,
        imageUrl,
        shareableImageUrl: shareableImageUrl(imageUrl),
        conversationId: conversation.id,
        conversationTitle: conversation.title || "未命名对话",
        turnId: turn.id,
        imageId: image.id,
        originalPrompt: turn.prompt,
        revisedPrompt: image.revised_prompt,
        createdAt: turn.createdAt || conversation.updatedAt || conversation.createdAt,
        model: turn.model,
        size: turn.size,
        quality: turn.quality,
      },
    ];
  });
}

export function buildUserGalleryItems(conversations: ImageConversation[]): UserGalleryItem[] {
  return conversations
    .flatMap((conversation) => conversation.turns.flatMap((turn) => toGalleryItems(conversation, turn)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

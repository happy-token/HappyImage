export function promptRequiresReferenceImage(prompt: string) {
  const normalized = String(prompt || "").trim();
  return (
    /\b(attached|uploaded|source)\s+(image|photo|picture|face|portrait)\b/i.test(normalized) ||
    /\b(this|that|the)\s+(image|photo|picture)\b/i.test(normalized) ||
    /\b(image|photo|picture|face|portrait)\s+(?:as|for|from|with)\s+(?:a\s+|the\s+)?(?:facial\s+|face\s+|identity\s+)?reference\b/i.test(normalized) ||
    /参考图|上传(?:的)?(?:图片|照片)|源图|原图|这张图|该图片|以.*(?:图片|照片).*参考|参考.*(?:图片|照片)/.test(normalized)
  );
}

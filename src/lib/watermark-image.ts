const DEFAULT_WATERMARK_TEXT = "HappyImage";

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败"));
    };
    image.src = objectUrl;
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function buildWatermarkedFilename(filename: string) {
  const trimmed = filename.trim() || "image.png";
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${trimmed}-watermarked.png`;
  }
  return `${trimmed.slice(0, dotIndex)}-watermarked.png`;
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text: string) {
  const shortSide = Math.max(1, Math.min(width, height));
  const fontSize = Math.max(18, Math.round(shortSide * 0.032));
  const paddingX = Math.max(18, Math.round(fontSize * 0.9));
  const paddingY = Math.max(12, Math.round(fontSize * 0.55));
  const margin = Math.max(18, Math.round(shortSide * 0.035));
  const radius = Math.max(10, Math.round(fontSize * 0.55));
  const safeText = text.trim() || DEFAULT_WATERMARK_TEXT;

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const metrics = ctx.measureText(safeText);
  const boxWidth = Math.min(width - margin * 2, Math.ceil(metrics.width + paddingX * 2));
  const boxHeight = Math.ceil(fontSize + paddingY * 2);
  const boxX = Math.max(margin, width - margin - boxWidth);
  const boxY = Math.max(margin, height - margin - boxHeight);
  const textX = boxX + boxWidth - paddingX;
  const textY = boxY + boxHeight / 2;

  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
  ctx.fillStyle = "rgba(17, 24, 39, 0.58)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.05));
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(safeText, textX, textY);

  ctx.restore();
}

export async function createTextWatermarkedBlob(blob: Blob, text = DEFAULT_WATERMARK_TEXT) {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("浏览器不支持图片水印");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas.width, canvas.height, text.trim() || DEFAULT_WATERMARK_TEXT);

  const outputBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  if (!outputBlob) {
    throw new Error("水印图片生成失败");
  }
  return outputBlob;
}

export async function downloadBlobWithTextWatermark(blob: Blob, filename: string, text = DEFAULT_WATERMARK_TEXT) {
  const outputBlob = await createTextWatermarkedBlob(blob, text);

  const outputFilename = buildWatermarkedFilename(filename);
  triggerBlobDownload(outputBlob, outputFilename);
  return outputFilename;
}

export async function downloadImageUrlWithTextWatermark(src: string, filename: string, text = DEFAULT_WATERMARK_TEXT) {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`图片读取失败：HTTP ${res.status}`);
  }
  const blob = await res.blob();
  return downloadBlobWithTextWatermark(blob, filename, text);
}

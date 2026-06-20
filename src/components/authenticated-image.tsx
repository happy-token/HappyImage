"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

import webConfig from "@/constants/common-env";
import { cn } from "@/lib/utils";
import { getStoredAuthKey } from "@/store/auth";

type AuthenticatedImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  placeholderClassName?: string;
};

function isDirectImageSource(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function normalizeImageUrl(src: string) {
  if (src.startsWith("http://") || src.startsWith("https://") || isDirectImageSource(src)) {
    return src;
  }
  const base = webConfig.apiUrl.replace(/\/$/, "");
  return `${base}${src.startsWith("/") ? src : `/${src}`}`;
}

function stripImageAccessToken(src: string) {
  try {
    const url = new URL(src, window.location.origin);
    if (!url.searchParams.has("image_token")) {
      return "";
    }
    url.searchParams.delete("image_token");
    return url.toString();
  } catch {
    return "";
  }
}

export async function fetchAuthenticatedImageBlob(src: string) {
  const normalizedSrc = normalizeImageUrl(src);
  if (!normalizedSrc) {
    throw new Error("image source is empty");
  }
  const authKey = await getStoredAuthKey();
  const headers: Record<string, string> = {};
  if (authKey) {
    headers.Authorization = `Bearer ${authKey}`;
  }
  let response = await fetch(normalizedSrc, {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const unsignedSrc = stripImageAccessToken(normalizedSrc);
    if (unsignedSrc) {
      response = await fetch(unsignedSrc, {
        credentials: "include",
        headers,
      });
    }
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.blob();
}

export function AuthenticatedImage({
  src,
  alt,
  className,
  loading = "lazy",
  placeholderClassName,
}: AuthenticatedImageProps) {
  const normalizedSrc = normalizeImageUrl(src);
  const directSrc = normalizedSrc && isDirectImageSource(normalizedSrc) ? normalizedSrc : "";
  const [loadedImage, setLoadedImage] = useState({
    src: "",
    resolvedSrc: "",
    hasError: false,
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    if (!normalizedSrc || directSrc) {
      return;
    }

    const loadImage = async () => {
      try {
        const blob = await fetchAuthenticatedImageBlob(normalizedSrc);
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setLoadedImage({ src, resolvedSrc: objectUrl, hasError: false });
        }
      } catch {
        if (!cancelled) {
          setLoadedImage({ src, resolvedSrc: "", hasError: true });
        }
      }
    };

    void loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [directSrc, normalizedSrc, src]);

  const resolvedSrc = directSrc || (loadedImage.src === src ? loadedImage.resolvedSrc : "");
  const hasError = !normalizedSrc || (loadedImage.src === src && loadedImage.hasError);

  if (hasError || !resolvedSrc) {
    return (
      <div className={cn("flex min-h-32 w-full items-center justify-center bg-stone-100 text-stone-400", placeholderClassName)}>
        <ImageIcon className="size-6" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setLoadedImage({ src, resolvedSrc: "", hasError: true })}
    />
  );
}

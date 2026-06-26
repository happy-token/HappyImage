import { seedGalleryIds } from "@/lib/seed-gallery-ids";
import { GalleryDetailClient } from "./gallery-detail-client";

export function generateStaticParams(): Array<{ id: string }> {
  return seedGalleryIds.map((id) => ({ id }));
}

export default function GalleryDetailPage() {
  return <GalleryDetailClient />;
}

import { useState } from 'react'
import type { ConfigItem } from '../../types/skills'
import { getStyleGradient } from '../../lib/screenshots'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'

interface GalleryDetailProps {
  item: ConfigItem
  skillName: string
  dimension: string
  onClose: () => void
}

export default function GalleryDetail({ item, skillName, dimension, onClose }: GalleryDetailProps) {
  const [imgError, setImgError] = useState(false)
  const fallback = getStyleGradient(item.id)

  return (
    <Modal open onClose={onClose} title={`${item.name} — ${skillName}`}>
      <div className="space-y-4">
        <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
          {item.previewImage && !imgError ? (
            <img
              src={item.previewImage}
              alt={`${item.name} preview`}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: fallback }}>
              <span className="text-lg font-medium text-white/80">{item.name}</span>
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge>{dimension}</Badge>
            {item.compatibility && item.compatibility.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map(tag => (
              <span key={tag} className="text-xs text-slate-500 bg-cream-200 rounded-full px-2.5 py-1">{tag}</span>
            ))}
          </div>
        )}
        {item.contentHints && (
          <div className="bg-cream-100 rounded-lg p-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Best for</p>
            <p className="text-sm text-slate-700">{item.contentHints}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

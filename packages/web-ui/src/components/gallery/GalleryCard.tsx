import { useState } from 'react'
import type { ConfigItem } from '../../types/skills'
import { getStyleGradient } from '../../lib/screenshots'

interface GalleryCardProps {
  item: ConfigItem
  skillName: string
  dimension: string
  selected?: boolean
  onClick: () => void
}

export default function GalleryCard({ item, skillName, dimension, selected = false, onClick }: GalleryCardProps) {
  const [imgError, setImgError] = useState(false)
  const fallback = getStyleGradient(item.id)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-xl border bg-cream-50 overflow-hidden transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
        selected
          ? 'ring-2 ring-slate-800 border-slate-800 shadow-md'
          : 'border-slate-200 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300'
      }`}
    >
      <div className="aspect-video relative overflow-hidden bg-slate-100">
        {item.previewImage && !imgError ? (
          <img
            src={item.previewImage}
            alt={`${item.name} preview`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4" style={{ background: fallback }}>
            <span className="text-sm font-medium text-white/80 text-center drop-shadow-sm">{item.name}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-slate-800">{item.name}</h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-slate-400 bg-cream-200 rounded-full px-1.5 py-0.5">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

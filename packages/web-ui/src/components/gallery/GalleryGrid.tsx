import type { ConfigItem } from '../../types/skills'
import GalleryCard from './GalleryCard'

interface GalleryItem {
  item: ConfigItem
  skillId: string
  skillName: string
  dimension: string
}

interface GalleryGridProps {
  items: GalleryItem[]
  onItemClick: (item: GalleryItem) => void
}

export default function GalleryGrid({ items, onItemClick }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-lg">No styles match your current filters.</p>
        <p className="text-slate-400 text-sm mt-1">Try selecting a different skill or dimension.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((gItem) => (
        <GalleryCard
          key={`${gItem.skillId}-${gItem.dimension}-${gItem.item.id}`}
          item={gItem.item}
          skillName={gItem.skillName}
          dimension={gItem.dimension}
          onClick={() => onItemClick(gItem)}
        />
      ))}
    </div>
  )
}

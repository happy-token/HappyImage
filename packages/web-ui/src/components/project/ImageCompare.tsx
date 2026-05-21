interface ImageCompareProps {
  images: Array<{ name: string; path: string; versions: string[] }>
  newImages: string[]
  selectedImage: number | null
  onSelect: (index: number | null) => void
}

export default function ImageCompare({ images, newImages, selectedImage, onSelect }: ImageCompareProps) {
  return (
    <div className="project-images">
      {images.length === 0 && newImages.length === 0 && (
        <div className="studio-empty">此项目还没有图片</div>
      )}
      {images.map((img, i) => {
        const isSelected = selectedImage === i
        const versionCount = img.versions.length
        const latestPath = versionCount > 1
          ? img.path.replace(img.name, img.name.replace(/\.(png|jpe?g|webp|gif)$/i, `.v${versionCount}.$1`))
          : img.path

        return (
          <button
            key={`${img.name}-${i}`}
            type="button"
            className={`project-image-card ${isSelected ? 'project-image-selected' : ''}`}
            onClick={() => onSelect(isSelected ? null : i)}
          >
            <img src={latestPath} alt={img.name} loading="lazy" />
            <div className="project-image-info">
              <span>{img.name}</span>
              {versionCount > 1 && <span className="project-version-badge">v{versionCount}</span>}
            </div>
          </button>
        )
      })}
      {newImages.map((src, i) => (
        <div key={`new-${i}`} className="project-image-card project-image-new">
          <img src={src} alt={`New generation ${i + 1}`} loading="lazy" />
          <div className="project-image-info">
            <span>New</span>
            <span className="project-version-badge">new</span>
          </div>
        </div>
      ))}
    </div>
  )
}

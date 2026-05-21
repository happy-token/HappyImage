import { useParams, Link } from 'react-router-dom'
import { getSkill } from '../data'
import GalleryGrid from '../components/gallery/GalleryGrid'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import BackToStudioButton from '../components/ui/BackToStudioButton'
import type { ConfigItem } from '../types/skills'

export default function SkillDetailPage() {
  const { skill: skillId } = useParams<{ skill: string }>()
  const skill = skillId ? getSkill(skillId) : undefined

  if (!skill) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-display text-slate-800 mb-4">Skill not found</h1>
        <Link to="/gallery" className="text-slate-600 hover:text-slate-800 underline">Back to Gallery</Link>
      </div>
    )
  }

  const allItems: { item: ConfigItem; dimension: string }[] = []
  for (const [dimKey, dim] of Object.entries(skill.dimensions)) {
    for (const item of dim.items) {
      const previewDir = skill.screenshotDirs.find(d => d.dimension === dimKey)
      allItems.push({
        item: { ...item, previewImage: previewDir ? `/screenshots/${previewDir.path}/${item.id}.webp` : undefined },
        dimension: dimKey,
      })
    }
  }

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <BackToStudioButton className="absolute right-4 top-10 sm:right-6 lg:right-8" />
      <div className="mb-8 pr-14">
        <Link to="/gallery" className="text-sm text-slate-500 hover:text-slate-700 mb-3 inline-block">&larr; Back to Gallery</Link>
        <h1 className="text-3xl font-display font-semibold text-slate-800 mb-2">{skill.name}</h1>
        <p className="text-slate-500 max-w-2xl">{skill.longDescription}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2 space-y-8">
          {Object.entries(skill.dimensions).map(([dimKey, dim]) => (
            <section key={dimKey}>
              <h2 className="text-xl font-display font-semibold text-slate-700 mb-4">{dim.label}</h2>
              <GalleryGrid
                items={dim.items.map(item => ({
                  item: { ...item, previewImage: skill.screenshotDirs.find(d => d.dimension === dimKey) ? `/screenshots/${skill.screenshotDirs.find(d => d.dimension === dimKey)!.path}/${item.id}.webp` : undefined },
                  skillId: skill.id,
                  skillName: skill.name,
                  dimension: dimKey,
                }))}
                onItemClick={() => {}}
              />
            </section>
          ))}
        </div>

        <aside className="space-y-6">
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Best For</h3>
            <div className="flex flex-wrap gap-1.5">
              {skill.bestFor.map(t => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </Card>

          {skill.presets.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3">Presets ({skill.presets.length})</h3>
              <div className="space-y-2">
                {skill.presets.slice(0, 10).map(p => (
                  <div key={p.id} className="text-sm">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-slate-400 ml-1">— {p.bestFor}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {skill.recommendations.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3">Recommendations</h3>
              <div className="space-y-2">
                {skill.recommendations.slice(0, 8).map((r, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-slate-500">{r.content}</span>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      {Object.entries(r.dimensionMap).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Link
            to={`/wizard/${skill.id}`}
            className="block w-full text-center px-4 py-3 rounded-xl bg-slate-800 text-cream-100 font-medium hover:bg-slate-700 transition-colors no-underline"
          >
            Start Creating with {skill.name}
          </Link>
        </aside>
      </div>
    </div>
  )
}

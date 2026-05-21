import { useState } from 'react'
import type { SkillDefinition } from '../../types/skills'
import GalleryCard from '../gallery/GalleryCard'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

interface StepStyleSelectProps {
  skill: SkillDefinition
  content: string
  selections: Record<string, string>
  onSelect: (dim: string, value: string) => void
  onSelectAll: (dims: Record<string, string>) => void
  onAcceptRecommendation: () => void
}

type Path = 'auto' | 'custom' | 'detailed' | null

function matchRecommendations(skill: SkillDefinition, content: string): Record<string, string> | null {
  if (!content || !skill.recommendations.length) return null
  const lower = content.toLowerCase()
  for (const r of skill.recommendations) {
    const keywords = r.content.split(/,\s*/)
    if (keywords.some(k => lower.includes(k.toLowerCase()))) {
      return r.dimensionMap
    }
  }
  if (skill.presets.length > 0) {
    const found = skill.presets.find(p => lower.includes(p.bestFor.toLowerCase()))
    if (found) return found.dimensionMap
  }
  return null
}

function resolveItem(skill: SkillDefinition, dimKey: string, itemId: string): string {
  const dim = skill.dimensions[dimKey]
  if (!dim) return itemId
  const item = dim.items.find(i => i.id === itemId)
  return item?.name || itemId
}

export default function StepStyleSelect({ skill, content, selections, onSelect, onSelectAll, onAcceptRecommendation }: StepStyleSelectProps) {
  const [path, setPath] = useState<Path>(null)
  const recommendation = matchRecommendations(skill, content)

  const previewDir = (dimKey: string) => skill.screenshotDirs.find(d => d.dimension === dimKey)

  const selectRecommended = () => {
    if (recommendation) {
      onSelectAll(recommendation)
      onAcceptRecommendation()
    }
  }

  if (!path) {
    return (
      <div>
        <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">智能推荐 🎯</h2>
        <p className="text-slate-500 mb-6">根据你的内容，推荐最佳风格组合。选择一个方式继续：</p>

        {recommendation ? (
          <Card className="mb-6 border-amber-200 bg-amber-50/50">
            <h3 className="font-semibold text-amber-800 mb-3">推荐方案</h3>
            <div className="space-y-2 mb-4">
              {Object.entries(recommendation).map(([dim, val]) => (
                <div key={dim} className="flex items-center gap-2 text-sm">
                  <span className="text-amber-600 font-medium min-w-[80px]">{dim}:</span>
                  <Badge variant="accent">{resolveItem(skill, dim, val)}</Badge>
                </div>
              ))}
            </div>
            <Button onClick={selectRecommended} size="lg">✅ 确认，直接生成（推荐）</Button>
          </Card>
        ) : (
          <Card className="mb-6">
            <p className="text-sm text-slate-500">没有匹配到特定推荐，请手动选择。</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card hover onClick={() => setPath('custom')} className="cursor-pointer text-center">
            <span className="text-2xl mb-2 block">🎛️</span>
            <h3 className="font-semibold text-slate-800 mb-1">自定义调整</h3>
            <p className="text-xs text-slate-500">逐个选择样式、布局、配色、数量</p>
          </Card>
          <Card hover onClick={() => setPath('detailed')} className="cursor-pointer text-center">
            <span className="text-2xl mb-2 block">📋</span>
            <h3 className="font-semibold text-slate-800 mb-1">浏览所有选项</h3>
            <p className="text-xs text-slate-500">看到全部风格再决定，含预览图</p>
          </Card>
        </div>

        {recommendation && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <p className="text-xs text-slate-400 w-full mb-1">其他推荐组合：</p>
            {skill.recommendations.slice(0, 6).map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onSelectAll(r.dimensionMap); onAcceptRecommendation() }}
                className="text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full px-3 py-1 transition-colors cursor-pointer"
              >
                {r.content}: {Object.entries(r.dimensionMap).map(([k, v]) => `${v}`).join('+')}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // PATH: custom - guided questions one dimension at a time
  if (path === 'custom') {
    const dims = Object.entries(skill.dimensions)
    const unselected = dims.filter(([, dim]) => dim.isRequired && !selections[dim.name])
    const nextDim = unselected.length > 0 ? unselected[0] : dims[0]
    const [dimKey, dim] = nextDim

    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setPath(null)} className="text-sm text-slate-400 hover:text-slate-600">&larr; Back</button>
          <Badge>{dims.filter(([, d]) => selections[d.name]).length}/{dims.filter(([, d]) => d.isRequired).length} selected</Badge>
        </div>
        <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">自定义：{dim.label}</h2>
        <p className="text-slate-500 mb-4">{dim.isRequired ? 'Required' : 'Optional'} — 当前：{selections[dimKey] ? resolveItem(skill, dimKey, selections[dimKey]) : (recommendation?.[dimKey] ? `${resolveItem(skill, dimKey, recommendation[dimKey])}（推荐）` : '未选择')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {dim.items.map(item => {
            const pd = previewDir(dimKey)
            const isSelected = selections[dimKey] === item.id
            const isRecommended = recommendation?.[dimKey] === item.id
            return (
              <div key={item.id} className="relative">
                {isRecommended && !isSelected && (
                  <span className="absolute -top-1 -right-1 z-10 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 border border-amber-200">推荐</span>
                )}
                <GalleryCard
                  item={{ ...item, previewImage: pd ? `/screenshots/${pd.path}/${item.id}.webp` : undefined }}
                  skillName={skill.name}
                  dimension={dimKey}
                  selected={isSelected}
                  onClick={() => onSelect(dimKey, item.id)}
                />
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          {unselected.length > 1 && (
            <Button variant="ghost" onClick={() => {
              const next = unselected[1]?.[0]; if (next) {
                const sv = recommendation?.[next] || skill.dimensions[next].defaultItem
                if (sv) onSelect(next, sv)
              }
            }}>Skip</Button>
          )}
          <Button onClick={() => {
            const allRequired = dims.filter(([, d]) => d.isRequired)
            const allDone = allRequired.every(([k]) => selections[k])
            if (allDone) onAcceptRecommendation()
          }}>
            {dims.filter(([k, d]) => d.isRequired && !selections[k]).length > 0 ? 'Next Dimension' : 'Done'}
          </Button>
        </div>
      </div>
    )
  }

  // PATH: detailed - show all dimensions with all options
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setPath(null)} className="text-sm text-slate-400 hover:text-slate-600">&larr; Back</button>
      </div>
      <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">浏览所有选项</h2>
      <p className="text-slate-500 mb-6">查看每个维度的所有选择。</p>

      {Object.entries(skill.dimensions).map(([dimKey, dim]) => (
        <section key={dimKey} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-slate-700">{dim.label}</h3>
            {dim.isRequired && <Badge>Required</Badge>}
            {selections[dimKey] && <span className="text-sm text-green-600">→ {resolveItem(skill, dimKey, selections[dimKey])}</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {dim.items.map(item => {
              const pd = previewDir(dimKey)
              return (
                <div key={item.id} className="relative">
                  {recommendation?.[dimKey] === item.id && !selections[dimKey] && (
                    <span className="absolute -top-1 -right-1 z-10 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 border border-amber-200">推荐</span>
                  )}
                  <GalleryCard
                    item={{ ...item, previewImage: pd ? `/screenshots/${pd.path}/${item.id}.webp` : undefined }}
                    skillName={skill.name}
                    dimension={dimKey}
                    selected={selections[dimKey] === item.id}
                    onClick={() => onSelect(dimKey, item.id)}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <Button size="lg" onClick={onAcceptRecommendation}>Done — Go to Review</Button>
    </div>
  )
}

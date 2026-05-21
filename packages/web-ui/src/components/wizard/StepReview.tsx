import type { SkillDefinition } from '../../types/skills'
import type { WizardState } from '../../types/skills'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

interface StepReviewProps {
  skill: SkillDefinition
  state: WizardState
  onEditStep: (step: number) => void
}

export default function StepReview({ skill, state, onEditStep }: StepReviewProps) {
  const selectedItems = Object.entries(state.selections).map(([dimKey, itemId]) => {
    const dim = skill.dimensions[dimKey]
    const item = dim?.items.find(i => i.id === itemId)
    return { dimension: dim?.label || dimKey, item: item?.name || itemId }
  })

  return (
    <div>
      <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">Review your configuration</h2>
      <p className="text-slate-500 mb-8">Check your selections before generating or exporting. You can edit any section.</p>

      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Skill</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>Edit</Button>
          </div>
          <p className="text-sm text-slate-700">{skill.name} — {skill.description}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Style Selections</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>Edit</Button>
          </div>
          <div className="space-y-2">
            {selectedItems.map(({ dimension, item }) => (
              <div key={dimension} className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 min-w-[100px]">{dimension}</span>
                <Badge variant="accent">{item}</Badge>
              </div>
            ))}
            {selectedItems.length === 0 && (
              <p className="text-sm text-slate-400">Auto-detect based on content</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Content & Parameters</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>Edit</Button>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-400">Language:</span> {state.language}</div>
            <div><span className="text-slate-400">Aspect Ratio:</span> {state.aspectRatio}</div>
            {skill.outputType === 'images' && <div><span className="text-slate-400">Image Count:</span> {state.imageCount}</div>}
            <div className="pt-2">
              <span className="text-slate-400">Content:</span>
              <p className="text-slate-600 mt-1 text-xs leading-relaxed bg-cream-100 rounded-lg p-3 max-h-32 overflow-auto">
                {state.content.slice(0, 500) || '(No content entered)'}
                {state.content.length > 500 && '...'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

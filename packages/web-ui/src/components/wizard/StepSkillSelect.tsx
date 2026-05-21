import type { SkillDefinition } from '../../types/skills'
import Card from '../ui/Card'
import Badge from '../ui/Badge'

const categoryIcons: Record<string, string> = {
  'image-cards': '🃏', infographic: '📊', cover: '🎨',
  presentation: '📽️', comic: '💬', illustration: '🖼️', diagram: '🔷',
}

interface StepSkillSelectProps {
  skills: SkillDefinition[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function StepSkillSelect({ skills, selectedId, onSelect }: StepSkillSelectProps) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">What would you like to create?</h2>
      <p className="text-slate-500 mb-8">Choose a content skill to get started. Each skill has its own style system and best-use scenarios.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map(skill => (
          <Card
            key={skill.id}
            hover
            onClick={() => onSelect(skill.id)}
            className={selectedId === skill.id ? 'ring-2 ring-slate-800 border-slate-800' : ''}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{categoryIcons[skill.category]}</span>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">{skill.name}</h3>
                <span className="text-xs text-slate-400">{skill.nameZh}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{skill.description}</p>
            <div className="flex flex-wrap gap-1">
              {skill.bestFor.slice(0, 3).map(t => (
                <span key={t} className="text-[10px] text-slate-400 bg-cream-200 rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>
            <div className="flex gap-1.5 mt-3">
              <Badge>{Object.keys(skill.dimensions).length} dimensions</Badge>
              {skill.hasCLI && <Badge variant="accent">Direct Generation</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

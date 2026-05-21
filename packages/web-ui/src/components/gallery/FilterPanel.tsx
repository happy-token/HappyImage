import type { SkillDefinition } from '../../types/skills'
import Tag from '../ui/Tag'

interface FilterPanelProps {
  skills: SkillDefinition[]
  dimensions: string[]
  selectedSkill: string
  selectedDimension: string
  onSkillChange: (skillId: string) => void
  onDimensionChange: (dim: string) => void
}

export default function FilterPanel({ skills, dimensions, selectedSkill, selectedDimension, onSkillChange, onDimensionChange }: FilterPanelProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Skill</label>
        <div className="flex flex-wrap gap-1.5">
          <Tag active={selectedSkill === 'all'} onClick={() => onSkillChange('all')}>All Skills</Tag>
          {skills.map(s => (
            <Tag key={s.id} active={selectedSkill === s.id} onClick={() => onSkillChange(s.id)}>
              {s.name}
            </Tag>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Dimension</label>
        <div className="flex flex-wrap gap-1.5">
          <Tag active={selectedDimension === 'all'} onClick={() => onDimensionChange('all')}>All</Tag>
          {dimensions.map(d => (
            <Tag key={d} active={selectedDimension === d} onClick={() => onDimensionChange(d)}>
              {d}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  )
}

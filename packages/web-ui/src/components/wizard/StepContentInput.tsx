import type { SkillDefinition } from '../../types/skills'
import Select from '../ui/Select'

interface StepContentInputProps {
  skill: SkillDefinition
  content: string
  language: string
  aspectRatio: string
  imageCount: number
  onContentChange: (content: string) => void
  onParamChange: (key: string, value: string) => void
}

export default function StepContentInput({ skill, content, language, aspectRatio, imageCount, onContentChange, onParamChange }: StepContentInputProps) {
  return (
    <div>
      <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">Enter your content</h2>
      <p className="text-slate-500 mb-8">
        Paste your article, outline, or topic. The AI will analyze it and generate matching visuals.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Content <span className="text-slate-400">({content.length} chars)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={skill.parameters.find(p => p.type === 'textarea')?.placeholder || 'Paste your content here...'}
            rows={10}
            className="w-full rounded-xl border border-slate-200 bg-cream-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all resize-y"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Select
            label="Language"
            value={language}
            options={[
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
              { value: 'ko', label: '한국어' },
            ]}
            onChange={(v) => onParamChange('lang', v)}
          />
          <Select
            label="Aspect Ratio"
            value={aspectRatio}
            options={[
              { value: '16:9', label: 'Landscape (16:9)' },
              { value: '9:16', label: 'Portrait (9:16)' },
              { value: '4:3', label: 'Standard (4:3)' },
              { value: '3:4', label: 'Portrait (3:4)' },
              { value: '1:1', label: 'Square (1:1)' },
              { value: '2.35:1', label: 'Cinema (2.35:1)' },
            ]}
            onChange={(v) => onParamChange('aspect', v)}
          />
          {skill.outputType === 'images' && (
            <Select
              label="Image Count"
              value={String(imageCount)}
              options={[1, 2, 3, 4, 5, 6, 8, 10].map(n => ({ value: String(n), label: String(n) }))}
              onChange={(v) => onParamChange('count', v)}
            />
          )}
          {skill.parameters
            .filter(p => p.type === 'select' && !['language', 'aspectRatio', 'content', 'imageCount'].includes(p.name))
            .map(p => (
              <Select
                key={p.name}
                label={p.label}
                value={String(p.defaultValue)}
                options={p.options || []}
                onChange={(v) => onParamChange(p.name, v)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

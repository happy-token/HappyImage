import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { skills } from '../data'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const categoryLabels: Record<string, string> = {
  'image-cards': 'Image Cards',
  'infographic': 'Infographic',
  'cover': 'Cover Image',
  'presentation': 'Slide Deck',
  'comic': 'Comic',
  'illustration': 'Illustration',
  'diagram': 'Diagram',
}

const categoryIcons: Record<string, string> = {
  'image-cards': '🃏',
  'infographic': '📊',
  'cover': '🎨',
  'presentation': '📽️',
  'comic': '💬',
  'illustration': '🖼️',
  'diagram': '🔷',
}

function BentoCard({ skill, size = 'md' }: { skill: typeof skills[0]; size?: 'lg' | 'md' | 'sm' }) {
  const dimCount = Object.keys(skill.dimensions).length
  const presetCount = skill.presets.length

  const sizeClasses: Record<string, string> = {
    lg: 'col-span-2 row-span-2',
    md: 'col-span-1 row-span-1',
    sm: 'col-span-1 row-span-1',
  }

  return (
    <Link to={`/wizard/${skill.id}`} className={`block ${sizeClasses[size]} no-underline`}>
      <Card hover className="h-full flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{categoryIcons[skill.category]}</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 font-sans">{skill.name}</h3>
              <span className="text-xs text-slate-400">{skill.nameZh}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">{skill.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{dimCount} dimensions</Badge>
          {presetCount > 0 && <Badge variant="accent">{presetCount} presets</Badge>}
          {skill.hasCLI && <Badge variant="outline">Direct Generation</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {skill.bestFor.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs text-slate-400 bg-cream-200 rounded-full px-2 py-0.5">{tag}</span>
          ))}
        </div>
      </Card>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold text-slate-800 mb-6 animate-fade-in">
          Design beautiful content<br />
          <span className="text-slate-400">with AI-powered style systems</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 animate-fade-in stagger-1">
          Browse 100+ visual styles across 7 content skills. Pair the perfect layout with your copy — from social media cards to technical diagrams.
        </p>
        <div className="flex items-center justify-center gap-4 animate-fade-in stagger-2">
          <Link to="/wizard" className="px-6 py-3 rounded-xl bg-slate-800 text-cream-100 font-medium hover:bg-slate-700 transition-colors no-underline">
            Start Creating
          </Link>
          <Link to="/gallery" className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-cream-200 transition-colors no-underline">
            Browse Gallery
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-2xl font-display font-semibold text-slate-700 mb-8">Choose your skill</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
          <BentoCard skill={skills[0]} size="md" />
          <BentoCard skill={skills[1]} size="lg" />
          <BentoCard skill={skills[2]} size="md" />
          <BentoCard skill={skills[3]} size="md" />
          <BentoCard skill={skills[4]} size="md" />
          <BentoCard skill={skills[5]} size="md" />
          <BentoCard skill={skills[6]} size="sm" />
        </div>
      </section>

      <section className="border-t border-slate-200 bg-cream-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { title: '100+ Visual Styles', desc: 'From cute kawaii to cyberpunk neon, find the perfect aesthetic for your content.' },
              { title: '7 Content Skills', desc: 'Image cards, infographics, covers, slides, comics, illustrations, and diagrams.' },
              { title: 'Smart Recommendations', desc: 'Tell us your content type, and we\'ll suggest the best style and layout.' },
            ].map(feat => (
              <div key={feat.title}>
                <h3 className="font-semibold text-slate-800 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

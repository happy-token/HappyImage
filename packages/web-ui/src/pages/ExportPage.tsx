import { useParams, Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import BackToStudioButton from '../components/ui/BackToStudioButton'

export default function ExportPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <BackToStudioButton className="absolute right-4 top-10 sm:right-6 lg:right-8" />
      <h1 className="text-3xl font-display font-semibold text-slate-800 mb-4">Configuration Exported</h1>
      <p className="text-slate-500 mb-8">
        Your configuration has been exported. Use it with Claude Code to generate your content.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link to="/wizard"><Button variant="secondary">Start New</Button></Link>
        <Link to="/gallery"><Button variant="ghost">Back to Gallery</Button></Link>
      </div>
    </div>
  )
}

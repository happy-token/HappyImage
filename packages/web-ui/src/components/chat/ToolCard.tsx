import { Wrench, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface ToolCardProps {
  name: string
  status: 'started' | 'progress' | 'succeeded' | 'failed'
  message?: string
  input?: unknown
}

export default function ToolCard({ name, status, message, input }: ToolCardProps) {
  const [expanded, setExpanded] = useState(status === 'started' || status === 'progress')

  const toolLabel = name
    .replace(/^baoyu-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div
      className={`ml-2 border-l-2 pl-3 py-2 my-1 rounded-r-lg transition-all ${
        status === 'failed'
          ? 'border-l-red-500 bg-red-950/10'
          : status === 'succeeded'
          ? 'border-l-emerald-500 bg-emerald-950/10'
          : 'border-l-indigo-500 bg-indigo-950/10'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
        )}

        <Wrench className={`h-3.5 w-3.5 shrink-0 ${
          status === 'failed' ? 'text-red-400' :
          status === 'succeeded' ? 'text-emerald-400' :
          'text-indigo-400'
        }`} />

        <span className="text-xs font-medium text-zinc-300">{toolLabel}</span>

        {status === 'started' && <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />}
        {status === 'progress' && <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />}
        {status === 'succeeded' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        {status === 'failed' && <XCircle className="h-3 w-3 text-red-400" />}

        <span className={`text-xxs ${
          status === 'failed' ? 'text-red-400' :
          status === 'succeeded' ? 'text-emerald-400' :
          'text-indigo-400'
        }`}>
          {status === 'started' ? 'Starting' :
           status === 'progress' ? 'Running' :
           status === 'succeeded' ? 'Done' : 'Failed'}
        </span>
      </button>

      {expanded && (
        <div className="mt-1.5 pl-5 text-xs text-zinc-400 space-y-1">
          {message && <p className="leading-relaxed">{message}</p>}
          {input != null && typeof input === 'object' && Object.keys(input as Record<string, unknown>).length > 0 && (
            <pre className="text-xxs text-zinc-500 font-mono bg-zinc-950/50 rounded p-1.5 overflow-x-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {status === 'progress' && !message && (
            <span className="text-indigo-400 inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
              Working...
            </span>
          )}
        </div>
      )}
    </div>
  )
}

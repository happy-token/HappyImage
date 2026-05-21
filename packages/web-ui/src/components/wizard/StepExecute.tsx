import type { SkillDefinition, WizardState } from '../../types/skills'
import { buildExportConfig, downloadConfig, downloadMarkdown } from '../../lib/export-config'
import { useSSE } from '../../hooks/useSSE'
import Card from '../ui/Card'
import Button from '../ui/Button'

interface StepExecuteProps {
  skill: SkillDefinition
  state: WizardState
}

export default function StepExecute({ skill, state }: StepExecuteProps) {
  const { start, stop, isStreaming, log, images, error } = useSSE()
  const config = buildExportConfig(state)

  const handleGenerate = () => {
    start(skill.id, state.content, state.selections)
  }

  return (
    <div>
      <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">生成或导出</h2>
      <p className="text-slate-500 mb-8">通过 Anthropic SDK 流式生成，完整技能流程：分析内容 → prompt 工程 → 生成图片。</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="flex flex-col items-center text-center p-8">
          <span className="text-3xl mb-3">🤖</span>
          <h3 className="font-semibold text-slate-800 mb-2">Anthropic SDK 流式生成</h3>
          <p className="text-sm text-slate-500 mb-6">加载 SKILL.md 上下文，Claude 分析内容、撰写 prompt、调用图片生成。</p>
          <div className="flex gap-2">
            {!isStreaming ? (
              <Button onClick={handleGenerate} size="lg">开始生成</Button>
            ) : (
              <Button onClick={stop} variant="secondary" size="lg">停止</Button>
            )}
          </div>
        </Card>

        <Card className="flex flex-col items-center text-center p-8">
          <span className="text-3xl mb-3">📋</span>
          <h3 className="font-semibold text-slate-800 mb-2">导出命令</h3>
          <p className="text-sm text-slate-500 mb-6">复制斜杠命令到终端手动执行。</p>
          <div className="flex flex-col gap-2 w-full">
            <Button variant="secondary" onClick={() => config && downloadConfig(config)}>Download JSON</Button>
            <Button variant="ghost" onClick={() => config && downloadMarkdown(config)}>Download .md</Button>
          </div>
        </Card>
      </div>

      {isStreaming && (
        <Card className="p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            <p className="text-slate-600 text-sm">Claude 正在执行技能流程...</p>
          </div>
          <div className="bg-slate-800 text-cream-100 rounded-lg p-4 font-mono text-xs max-h-64 overflow-y-auto whitespace-pre-wrap">
            {log.length === 0 && <span className="text-slate-400">Connecting...</span>}
            {log.join('')}
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-6 mb-6 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700 mb-1">生成失败</p>
          <p className="text-sm text-red-600 font-mono whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {images.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">已生成 {images.length} 张图片</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {images.map((url, i) => (
              <Card key={url} className="overflow-hidden p-0">
                <img src={url} alt={`Card ${i + 1}`} className="w-full h-auto" />
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">Card {i + 1}</span>
                  <a href={url} download className="text-xs text-slate-600 hover:text-slate-800 underline">Download</a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {config && (
        <Card>
          <h3 className="font-semibold text-slate-800 mb-2">斜杠命令</h3>
          <div className="bg-slate-800 text-cream-100 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
            {config.claudeCommand}
          </div>
          <Button size="sm" className="mt-3" onClick={() => navigator.clipboard.writeText(config.claudeCommand)}>
            Copy Command
          </Button>
        </Card>
      )}
    </div>
  )
}

import { useState, useCallback } from 'react'
import type { WizardState, ExportConfig } from '../types/skills'
import { buildExportConfig, downloadConfig, downloadMarkdown } from '../lib/export-config'

export function useExport(state: WizardState) {
  const [exporting, setExporting] = useState(false)
  const config = buildExportConfig(state)

  const exportJSON = useCallback(() => {
    if (!config) return
    setExporting(true)
    downloadConfig(config)
    setExporting(false)
  }, [config])

  const exportMarkdown = useCallback(() => {
    if (!config) return
    setExporting(true)
    downloadMarkdown(config)
    setExporting(false)
  }, [config])

  return { config, exporting, exportJSON, exportMarkdown }
}

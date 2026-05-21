import type { ReactNode } from 'react'
import DependencyStatus from '../system/DependencyStatus'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <DependencyStatus />
      {children}
    </div>
  )
}

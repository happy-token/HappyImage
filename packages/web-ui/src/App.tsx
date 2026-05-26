import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import StudioPage from './pages/StudioPage'
import GalleryPage from './pages/GalleryPage'
import SkillDetailPage from './pages/SkillDetailPage'
import WizardPage from './pages/WizardPage'
import ExportPage from './pages/ExportPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import GuidePage from './pages/GuidePage'
import { applyAccent } from './lib/accent'
import { applyTheme } from './lib/theme'
import DashboardLayout from './components/layout/DashboardLayout'

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    const page = location.pathname === '/' || location.pathname.startsWith('/projects/')
      ? 'studio' : location.pathname.startsWith('/settings')
      ? 'settings' : location.pathname.startsWith('/guide')
      ? 'guide' : 'gallery'
    document.documentElement.dataset.page = page
  }, [location.pathname])
  return null
}

function AppRoutes() {
  return (
    <>
      <PageTracker />
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<StudioPage />} />
          <Route path="/projects/:id" element={<StudioPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:skill" element={<SkillDetailPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/guide/:doc" element={<GuidePage />} />
        </Route>
        <Route path="/wizard" element={<WizardPage />} />
        <Route path="/wizard/:skill" element={<WizardPage />} />
        <Route path="/export/:id" element={<ExportPage />} />
      </Routes>
    </>
  )
}


export default function App() {
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(settings => {
        if (settings.THEME_MODE) applyTheme(settings.THEME_MODE)
        if (settings.THEME_COLOR) applyAccent(settings.THEME_COLOR)
      })
      .catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  )
}

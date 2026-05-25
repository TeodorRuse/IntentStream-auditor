import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useIntentStream } from './hooks/useIntentStream'
import { useChainsBootstrap } from './hooks/useChainsBootstrap'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import StatsBar from './components/StatsBar'
import CommandPalette from './components/CommandPalette'
import LiveView from './views/LiveView'
import BoardView from './views/BoardView'
import ChainsView from './views/chains/ChainsView'
import StatsView from './views/StatsView'
import SearchView from './views/SearchView'
import ExportView from './views/ExportView'
import SettingsView, { loadPrefs, applyPrefsToDom } from './views/SettingsView'

export default function App() {
  // Apply saved prefs as early as possible
  useEffect(() => { applyPrefsToDom(loadPrefs()) }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  )
}

function AppShell() {
  useIntentStream()
  useChainsBootstrap()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPaletteOpen(o => !o); return
      }
      if (mod && e.key === '1') { e.preventDefault(); navigate('/'); return }
      if (mod && e.key === '2') { e.preventDefault(); navigate('/board'); return }
      if (mod && e.key === '3') { e.preventDefault(); navigate('/chains'); return }
      if (mod && e.key === '4') { e.preventDefault(); navigate('/stats'); return }
      if (mod && e.key === '5') { e.preventDefault(); navigate('/search'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        minWidth: 0, overflow: 'hidden',
      }}>
        <StatsBar />
        <Routes>
          <Route path="/"         element={<LiveView />} />
          <Route path="/board"    element={<BoardView />} />
          <Route path="/chains"   element={<ChainsView />} />
          <Route path="/stats"    element={<StatsView />} />
          <Route path="/search"   element={<SearchView />} />
          <Route path="/export"   element={<ExportView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

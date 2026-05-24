import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useIntentStream } from './hooks/useIntentStream'
import { useChainsBootstrap } from './hooks/useChainsBootstrap'
import Sidebar from './components/Sidebar'
import StatsBar from './components/StatsBar'
import LiveView from './views/LiveView'
import BoardView from './views/BoardView'
import Placeholder from './views/Placeholder'

export default function App() {
  // Start the live stream + load saved chains
  useIntentStream()
  useChainsBootstrap()

  return (
    <BrowserRouter>
      <div style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg)',
      }}>
        <Sidebar />
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <StatsBar />
          <Routes>
            <Route path="/"        element={<LiveView />} />
            <Route path="/board"   element={<BoardView />} />
            <Route path="/chains"  element={
              <Placeholder
                name="Chains"
                blurb="Browse, edit, and replay your saved intent chains. Reorder steps with drag-and-drop, annotate each one, and open any chain back on the board to refine it."
                hints={[
                  'Sidebar of all saved chains with search and sort',
                  'Detail view: ordered steps with delta times between intents',
                  'Drag to reorder · inline rename · delete with cascade',
                  'Open in Board to continue editing visually',
                ]}
              />
            } />
            <Route path="/stats" element={
              <Placeholder
                name="Stats"
                blurb="Top actions and senders, broken down across all captured intents. Charts powered by the backend's existing /stats endpoints."
                hints={[
                  'Top 20 actions (bar chart) — find dominant event types',
                  'Top 20 sender packages (bar chart) — who is talking most',
                  'System vs 3rd-party split (donut chart)',
                  'Time-of-day heatmap of intent activity',
                ]}
              />
            } />
            <Route path="/search" element={
              <Placeholder
                name="Search"
                blurb="Full-history search across action, sender, target component, extras, date range, and flag values. Results stream back from the backend, not just what is already in memory."
                hints={[
                  'Filter by any combination of action / package / component / extras',
                  'Date-range picker (ISO 8601, calendar widget)',
                  'Exact-match flag value search (e.g. 0x60000010)',
                  '"Add to Board" button on every result row',
                ]}
              />
            } />
            <Route path="/export" element={
              <Placeholder
                name="Export"
                blurb="Download the feed or any chain as CSV or JSON for offline analysis."
                hints={[
                  'Export current feed (filtered) as CSV',
                  'Export full chain (intents + positions + labels) as JSON',
                  'Optional: include / exclude extras_raw column',
                ]}
              />
            } />
            <Route path="/settings" element={
              <Placeholder
                name="Settings"
                blurb="Configure connection target, poll interval, and theme tweaks."
                hints={[
                  'Backend URL override (for remote captures)',
                  'Color preferences and density',
                  'Keyboard shortcuts reference',
                ]}
              />
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

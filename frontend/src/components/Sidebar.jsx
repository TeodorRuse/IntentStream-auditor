import React from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Network, Link2, BarChart3, Search, Download, Settings } from 'lucide-react'
import { useStore } from '../store'

const styles = {
  root: {
    width: 'var(--sidebar-w)',
    flexShrink: 0,
    background: 'var(--bg)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  brand: {
    padding: '18px 16px 16px',
    borderBottom: '1px solid var(--line)',
  },
  brandLogo: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    color: 'var(--pink)',
    textShadow: '1.5px 1.5px 0 var(--teal-dim), 0 0 8px rgba(255,61,143,0.4)',
    letterSpacing: '0.05em',
    lineHeight: 1.1,
  },
  brandSub: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--ink-faint)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginTop: 7,
  },
  nav: {
    padding: '14px 0',
    flex: 1,
    overflowY: 'auto',
  },
  navSection: {
    fontFamily: 'var(--font-display)',
    fontSize: 9,
    color: 'var(--ink-faint)',
    letterSpacing: '0.1em',
    padding: '10px 16px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navSectionLine: {
    flex: 1,
    height: 1,
    background: 'var(--line)',
    opacity: 0.6,
  },
  status: {
    borderTop: '1px solid var(--line)',
    padding: '12px 16px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.08em',
    marginBottom: 4,
  },
  statusMeta: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--ink-faint)',
  },
}

const ITEM_BASE = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px 8px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-dim)',
  borderLeft: '2px solid transparent',
  cursor: 'pointer',
  gap: 10,
  textDecoration: 'none',
  transition: 'all var(--transition)',
  position: 'relative',
}
const ITEM_ACTIVE = {
  color: 'var(--pink)',
  background: 'var(--pink-fog)',
  borderLeftColor: 'var(--pink)',
  textShadow: 'var(--text-glow-pink)',
}

function NavItem({ to, icon: Icon, label, count }) {
  return (
    <NavLink to={to} style={({ isActive }) => isActive ? { ...ITEM_BASE, ...ITEM_ACTIVE } : ITEM_BASE}>
      {({ isActive }) => (
        <>
          <Icon size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{label}</span>
          {count !== undefined && count !== null && (
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 9,
              letterSpacing: '0.05em',
              background: isActive ? 'var(--pink)' : 'var(--paper)',
              color:      isActive ? 'var(--bg)'  : 'var(--ink-faint)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: isActive ? 'var(--glow-pink-sm)' : 'none',
              transition: 'all var(--transition)',
            }}>{count}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Section({ children }) {
  return (
    <div style={styles.navSection}>
      <span>{children}</span>
      <span style={styles.navSectionLine} />
    </div>
  )
}

export default function Sidebar() {
  const intents    = useStore(s => s.intents)
  const boardNodes = useStore(s => s.boardNodes)
  const chains     = useStore(s => s.chains)
  const streaming  = useStore(s => s.streaming)
  const ips        = useStore(s => s.ips)
  const lastId     = intents.length ? intents[intents.length - 1].id : null

  return (
    <aside style={styles.root}>
      <div style={styles.brand}>
        <div style={styles.brandLogo}>INTENT<br/>STREAM</div>
        <div style={styles.brandSub}>v1.0 · audit</div>
      </div>

      <nav style={styles.nav}>
        <Section>VIEWS</Section>
        <NavItem to="/"        icon={Activity} label="Live"   count={intents.length || null} />
        <NavItem to="/board"   icon={Network}  label="Board"  count={boardNodes.length || null} />
        <NavItem to="/chains"  icon={Link2}    label="Chains" count={chains.length || null} />
        <NavItem to="/stats"   icon={BarChart3} label="Stats" />
        <NavItem to="/search"  icon={Search}   label="Search" />

        <Section>QUICK</Section>
        <NavItem to="/export"   icon={Download}  label="Export" />
        <NavItem to="/settings" icon={Settings}  label="Settings" />
      </nav>

      <div style={styles.status}>
        <div style={{
          ...styles.statusRow,
          color: streaming ? 'var(--teal)' : 'var(--ink-faint)',
          textShadow: streaming ? 'var(--text-glow-teal)' : 'none',
        }}>
          <span className={streaming ? 'live-dot' : 'live-dot off'} />
          <span>{streaming ? 'STREAMING' : 'OFFLINE'}</span>
        </div>
        <div style={styles.statusMeta}>
          {streaming
            ? <>{ips} ips{lastId !== null ? ` · last #${lastId}` : ''}</>
            : <>reconnecting…</>
          }
        </div>
      </div>
    </aside>
  )
}

import React from 'react'
import { useStore } from '../store'

export default function StatsBar() {
  const intents     = useStore(s => s.intents)
  const ips         = useStore(s => s.ips)
  const ipsHistory  = useStore(s => s.ipsHistory)
  const boardNodes  = useStore(s => s.boardNodes)
  const chains      = useStore(s => s.chains)

  const systemCount = intents.filter(i => {
    const pkg = i.sender_package || ''
    return !pkg || pkg.startsWith('system_server') || pkg.startsWith('UID:') ||
           pkg.startsWith('com.android') || pkg.startsWith('android')
  }).length
  const thirdParty = intents.length - systemCount

  return (
    <div style={{
      height: 'var(--statsbar-h)',
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid var(--line)',
      background: 'var(--bg-2)',
      flexShrink: 0,
    }}>
      <Stat label="TOTAL"     value={intents.length} />
      <Stat label="SYSTEM"    value={systemCount} />
      <Stat label="3RD PARTY" value={thirdParty} color="teal" />
      <IpsStat ips={ips} history={ipsHistory} />
      <Stat label="BOARD"     value={boardNodes.length} color="orange" />
      <Stat label="CHAINS"    value={chains.length}     color="pink" />
    </div>
  )
}

function Stat({ label, value, color }) {
  const valColor = color === 'pink'   ? 'var(--pink)'
                 : color === 'teal'   ? 'var(--teal)'
                 : color === 'orange' ? 'var(--orange)'
                 : 'var(--ink)'
  const glow = color === 'pink' ? 'var(--text-glow-pink)'
             : color === 'teal' ? 'var(--text-glow-teal)'
             : 'none'
  return (
    <div style={{
      padding: '8px 18px',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 4,
      minWidth: 92,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        color: 'var(--ink-faint)',
        letterSpacing: '0.05em',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 500,
        color: valColor,
        textShadow: glow,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>{formatN(value)}</div>
    </div>
  )
}

function IpsStat({ ips, history }) {
  const max = Math.max(1, ...history)
  return (
    <div style={{
      padding: '8px 18px',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 4,
      minWidth: 130,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        color: 'var(--ink-faint)',
        letterSpacing: '0.05em',
      }}>IPS · 60S</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--pink)',
          textShadow: 'var(--text-glow-pink)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          minWidth: 22,
        }}>{ips}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 18, flex: 1 }}>
          {history.slice(-30).map((v, i) => (
            <div key={i} style={{
              width: 2.5,
              height: `${Math.max(2, (v / max) * 100)}%`,
              background: v > 0 ? 'var(--pink)' : 'var(--ink-trace)',
              opacity: v > 0 ? 0.7 : 0.4,
              boxShadow: v > 0 ? 'var(--glow-pink-sm)' : 'none',
              transition: 'height 200ms',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function formatN(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString('en')
}

import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { Intents } from '../lib/api'
import { useStore } from '../store'
import { shortAction, isSystemIntent } from '../utils'

const COLORS = {
  pink:   '#ff3d8f',
  teal:   '#00e5ff',
  orange: '#ff8c42',
  yellow: '#ffd23f',
  pink2:  '#ff5fa3',
  teal2:  '#4df0ff',
}

export default function StatsView() {
  const intents = useStore(s => s.intents)
  const [actions, setActions]   = useState([])
  const [senders, setSenders]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [a, s] = await Promise.all([
        Intents.statsActions(15),
        Intents.statsSenders(15),
      ])
      setActions(a || []); setSenders(s || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  // Local stats from in-memory feed (instant)
  const sys = intents.filter(isSystemIntent).length
  const thirdParty = intents.length - sys

  // Hourly histogram from feed
  const hourly = (() => {
    const buckets = Array(24).fill(0)
    for (const i of intents) {
      const ts = i.enqueue_time || i.poll_time
      if (!ts) continue
      const hr = parseInt(ts.slice(11, 13), 10)
      if (!isNaN(hr)) buckets[hr]++
    }
    return buckets.map((count, hr) => ({
      hour: `${String(hr).padStart(2, '0')}h`,
      count,
    }))
  })()

  const actionsData = actions.map(r => ({
    name: shortAction(r.action),
    full: r.action,
    count: r.count,
  }))
  const sendersData = senders.map(r => ({
    name: (r.sender_package || '(none)').replace('com.', ''),
    full: r.sender_package || '(none)',
    count: r.count,
  }))
  const splitData = [
    { name: 'SYSTEM',    value: sys,        color: COLORS.orange },
    { name: '3RD PARTY', value: thirdParty, color: COLORS.teal },
  ]

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 20,
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at top right, rgba(255,61,143,0.04), transparent 60%)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          color: 'var(--pink)',
          textShadow: '2px 2px 0 var(--teal-dim), 0 0 16px rgba(255,61,143,0.4)',
          letterSpacing: '0.04em',
          fontWeight: 400,
        }}>STATS</h1>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-dim)',
        }}>
          live counts from {intents.length.toLocaleString()} intents · backend stats refreshed on demand
        </span>
        <button onClick={load} disabled={loading} style={{
          marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={11} strokeWidth={2}
            style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          {loading ? 'LOADING…' : 'REFRESH'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          border: '1px solid var(--red)',
          color: 'var(--red)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          background: 'rgba(255,77,109,0.06)',
        }}>
          Failed to load backend stats: {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 16,
      }}>
        <ChartCard title="TOP ACTIONS" subtitle={`from backend · top ${actions.length}`}>
          {actionsData.length === 0
            ? <EmptyChart loading={loading} />
            : (
              <ResponsiveContainer width="100%" height={Math.max(260, actionsData.length * 22)}>
                <BarChart data={actionsData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    width={180} />
                  <Tooltip content={<NeonTooltip />} cursor={{ fill: 'rgba(255,61,143,0.08)' }} />
                  <Bar dataKey="count" fill={COLORS.pink}
                    radius={[0, 2, 2, 0]}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(255,61,143,0.5))' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        <ChartCard title="TOP SENDERS" subtitle={`from backend · top ${senders.length}`}>
          {sendersData.length === 0
            ? <EmptyChart loading={loading} />
            : (
              <ResponsiveContainer width="100%" height={Math.max(260, sendersData.length * 22)}>
                <BarChart data={sendersData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    width={180} />
                  <Tooltip content={<NeonTooltip />} cursor={{ fill: 'rgba(0,229,255,0.08)' }} />
                  <Bar dataKey="count" fill={COLORS.teal}
                    radius={[0, 2, 2, 0]}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.5))' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        <ChartCard title="SYSTEM vs 3RD PARTY" subtitle={`from feed · ${intents.length} intents in memory`}>
          {intents.length === 0
            ? <EmptyChart loading={false} message="No intents in feed yet." />
            : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={splitData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={3}
                    label={({ name, value, percent }) =>
                      `${name} · ${value} (${(percent * 100).toFixed(1)}%)`}
                    labelLine={false}>
                    {splitData.map((s, i) => (
                      <Cell key={i} fill={s.color}
                        style={{ filter: `drop-shadow(0 0 6px ${s.color})` }} />
                    ))}
                  </Pie>
                  <Tooltip content={<NeonTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        <ChartCard title="HOURLY ACTIVITY" subtitle={`from feed · ${intents.length} intents`}>
          {intents.length === 0
            ? <EmptyChart loading={false} message="No intents in feed yet." />
            : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourly} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    interval={1} />
                  <YAxis stroke="var(--ink-faint)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }} />
                  <Tooltip content={<NeonTooltip />} cursor={{ fill: 'rgba(255,140,66,0.08)' }} />
                  <Bar dataKey="count" fill={COLORS.orange}
                    radius={[2, 2, 0, 0]}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(255,140,66,0.5))' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        color: 'var(--pink)',
        textShadow: '1px 1px 0 var(--teal-dim), var(--text-glow-pink)',
        letterSpacing: '0.06em',
        marginBottom: 2,
      }}>{title}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-faint)',
        marginBottom: 12,
      }}>{subtitle}</div>
      {children}
    </div>
  )
}

function EmptyChart({ loading, message }) {
  return (
    <div style={{
      height: 220,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-faint)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      {loading ? 'loading…' : (message || 'no data.')}
    </div>
  )
}

function NeonTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0]
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--pink-dim)',
      boxShadow: 'var(--glow-pink-sm)',
      padding: '6px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--ink)',
    }}>
      <div style={{ color: 'var(--ink-dim)' }}>{item.payload.full || label}</div>
      <div style={{ color: 'var(--pink)', marginTop: 2 }}>
        <span style={{ color: 'var(--ink-faint)' }}>count: </span>
        <span style={{ textShadow: 'var(--text-glow-pink)' }}>{item.value.toLocaleString()}</span>
      </div>
    </div>
  )
}

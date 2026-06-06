'use client'

import { useState } from 'react'

type Creator = {
  id: string; name: string; email: string
  tiktok_handle: string | null; instagram_handle: string | null
  status: string; created_at: string
}
type Submission = {
  id: string; creator_id: string; video_url: string; platform: string
  status: string; views: number; paid: boolean; reward_amount: number; created_at: string
}

const STATUS = ['pending', 'approved', 'rejected', 'paid']

const statusColor: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: '#fef3c7', fg: '#92400e' },
  approved: { bg: '#dbeafe', fg: '#1e40af' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  paid:     { bg: '#dcfce7', fg: '#166534' },
}

const fmtDate = (s: string) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return s }
}
const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const call = async (payload: object) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  const load = async () => {
    const data = await call({ action: 'list' })
    setCreators(data.creators ?? [])
    setSubmissions(data.submissions ?? [])
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await load(); setAuthed(true) }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const refresh = async () => {
    setError('')
    try { await load() } catch (err: any) { setError(err.message) }
  }

  const update = async (id: string, patch: Partial<Submission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try { await call({ action: 'update', id, patch }) }
    catch (err: any) { setError(err.message) }
  }

  const creatorFor = (cid: string) => creators.find((c) => c.id === cid)

  // ---------- styles ----------
  const page: React.CSSProperties = { minHeight: '100vh', background: '#f6f7f9', color: '#111827', fontFamily: 'system-ui, -apple-system, sans-serif' }
  const wrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '24px 20px 64px' }
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6b7280', padding: '12px 14px', borderBottom: '1px solid #eef0f2', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #f1f3f5', fontSize: 14, verticalAlign: 'middle' }
  const inputS: React.CSSProperties = { width: 72, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }
  const pill = (s: string): React.CSSProperties => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: (statusColor[s] || statusColor.pending).bg, color: (statusColor[s] || statusColor.pending).fg })

  // ---------- login ----------
  if (!authed) {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...card, width: 360, padding: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Mad Rewards Admin</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Enter your admin password.</p>
          <form onSubmit={login}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              style={{ width: '100%', padding: '11px 12px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, marginBottom: 12, boxSizing: 'border-box' }} />
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>
          {error && <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    )
  }

  // ---------- stats ----------
  const pending = submissions.filter((s) => s.status === 'pending').length
  const approved = submissions.filter((s) => s.status === 'approved').length
  const paidCount = submissions.filter((s) => s.paid).length
  const paidOut = submissions.filter((s) => s.paid).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)
  const owed = submissions.filter((s) => !s.paid).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)

  const stats = [
    { label: 'Creators', value: creators.length },
    { label: 'Submissions', value: submissions.length },
    { label: 'Pending', value: pending },
    { label: 'Approved', value: approved },
    { label: 'Paid out', value: money(paidOut) },
    { label: 'Owed', value: money(owed) },
  ]

  return (
    <div style={page}>
      <div style={wrap}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Mad Rewards Admin</h1>
          <button onClick={refresh}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</p>}

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* creators */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Creators ({creators.length})</h2>
        <div style={{ ...card, overflowX: 'auto', marginBottom: 36 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>TikTok</th><th style={th}>Instagram</th><th style={th}>Status</th><th style={th}>Joined</th></tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                  <td style={td}>{c.email}</td>
                  <td style={td}>{c.tiktok_handle || '—'}</td>
                  <td style={td}>{c.instagram_handle || '—'}</td>
                  <td style={td}><span style={pill(c.status)}>{c.status}</span></td>
                  <td style={{ ...td, color: '#6b7280' }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
              {creators.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: '#9ca3af' }} colSpan={6}>No creators yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* submissions */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Video submissions ({submissions.length})</h2>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Creator</th><th style={th}>Video</th><th style={th}>Platform</th>
                <th style={th}>Submitted</th><th style={th}>Views</th><th style={th}>Status</th>
                <th style={th}>Reward</th><th style={th}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const c = creatorFor(s.creator_id)
                return (
                  <tr key={s.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{c?.name || '—'}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{c?.email || s.creator_id.slice(0, 8)}</div>
                    </td>
                    <td style={{ ...td, maxWidth: 200 }}>
                      <a href={s.video_url} target="_blank" rel="noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.video_url}
                      </a>
                    </td>
                    <td style={{ ...td, textTransform: 'capitalize', color: '#6b7280' }}>{s.platform}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{fmtDate(s.created_at)}</td>
                    <td style={td}>
                      <input type="number" defaultValue={s.views} style={inputS}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== s.views) update(s.id, { views: v }) }} />
                    </td>
                    <td style={td}>
                      <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })}
                        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textTransform: 'capitalize' }}>
                        {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#6b7280' }}>$</span>
                        <input type="number" defaultValue={s.reward_amount} style={inputS}
                          onBlur={(e) => { const v = Number(e.target.value); if (v !== s.reward_amount) update(s.id, { reward_amount: v }) }} />
                      </div>
                    </td>
                    <td style={td}>
                      <input type="checkbox" checked={s.paid} onChange={(e) => update(s.id, { paid: e.target.checked })}
                        style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    </td>
                  </tr>
                )
              })}
              {submissions.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: '#9ca3af' }} colSpan={8}>No submissions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

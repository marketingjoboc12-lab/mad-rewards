'use client'

import { useState } from 'react'

type Creator = { id: string; name: string; email: string; status: string }
type Submission = {
  id: string; creator_id: string; video_url: string; platform: string
  status: string; views: number; paid: boolean; reward_amount: number
}

const STATUS = ['pending', 'approved', 'rejected', 'paid']

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

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await call({ action: 'list' })
      setCreators(data.creators ?? [])
      setSubmissions(data.submissions ?? [])
      setAuthed(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const update = async (id: string, patch: Partial<Submission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))) // optimistic
    try {
      await call({ action: 'update', id, patch })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const emailFor = (cid: string) => creators.find((c) => c.id === cid)?.email ?? '—'

  if (!authed) {
    return (
      <main style={{ maxWidth: 360, margin: '120px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Admin</h1>
        <form onSubmit={login}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 10 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 10, borderRadius: 8, background: '#000', color: '#fff', fontWeight: 600 }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
        {error && <p style={{ color: 'crimson', fontSize: 14, marginTop: 10 }}>{error}</p>}
      </main>
    )
  }

  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: 14 }
  const head: React.CSSProperties = { ...cell, textAlign: 'left', fontSize: 12, color: '#666', textTransform: 'uppercase' }

  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      {error && <p style={{ color: 'crimson', fontSize: 14 }}>{error}</p>}

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Creators ({creators.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Name</th><th style={head}>Email</th><th style={head}>Status</th></tr></thead>
        <tbody>
          {creators.map((c) => (
            <tr key={c.id}>
              <td style={cell}>{c.name}</td><td style={cell}>{c.email}</td><td style={cell}>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '32px 0 12px' }}>Submissions ({submissions.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={head}>Creator</th><th style={head}>Video</th><th style={head}>Views</th>
            <th style={head}>Status</th><th style={head}>Reward $</th><th style={head}>Paid</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td style={cell}>{emailFor(s.creator_id)}</td>
              <td style={{ ...cell, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <a href={s.video_url} target="_blank" rel="noreferrer">{s.video_url}</a>
              </td>
              <td style={cell}>
                <input type="number" defaultValue={s.views}
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== s.views) update(s.id, { views: v }) }}
                  style={{ width: 80, padding: 4 }} />
              </td>
              <td style={cell}>
                <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })}>
                  {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td style={cell}>
                <input type="number" defaultValue={s.reward_amount}
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== s.reward_amount) update(s.id, { reward_amount: v }) }}
                  style={{ width: 80, padding: 4 }} />
              </td>
              <td style={cell}>
                <input type="checkbox" checked={s.paid} onChange={(e) => update(s.id, { paid: e.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

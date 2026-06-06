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
type Tier = { videos: number | null; views: number; reward_label: string; reward_amount: number }
type Campaign = {
  id?: string; title: string; active: boolean; cadence: string
  starts_at: string; tiers: Tier[]; examples: string[]
}

const STATUS = ['pending', 'approved', 'rejected', 'paid']

// Your proposed ladder, used as the starting point for a new campaign.
const DEFAULT_TIERS: Tier[] = [
  { videos: 20, views: 50000, reward_label: 'Re-up (more product)', reward_amount: 0 },
  { videos: 30, views: 100000, reward_label: '$100', reward_amount: 100 },
  { videos: 40, views: 200000, reward_label: '$200', reward_amount: 200 },
  { videos: null, views: 500000, reward_label: '$300', reward_amount: 300 },
  { videos: null, views: 700000, reward_label: '$350 + duffle bag', reward_amount: 350 },
  { videos: null, views: 1000000, reward_label: '$350 + Mega device', reward_amount: 350 },
]

const statusColor: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' }, approved: { bg: '#dbeafe', fg: '#1e40af' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' }, paid: { bg: '#dcfce7', fg: '#166534' },
}
const fmtDate = (s: string) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return s } }
const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const toUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const call = async (payload: object) => {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    setCampaigns(data.campaigns ?? [])
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await load(); setAuthed(true) } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }
  const refresh = async () => { setError(''); try { await load() } catch (err: any) { setError(err.message) } }

  const update = async (id: string, patch: Partial<Submission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try { await call({ action: 'update', id, patch }) } catch (err: any) { setError(err.message) }
  }

  // ----- campaign editing -----
  const newCampaign = () => setEditing({
    title: 'This Week', active: true, cadence: 'weekly',
    starts_at: new Date().toISOString().slice(0, 10),
    tiers: DEFAULT_TIERS.map((t) => ({ ...t })), examples: [],
  })
  const editCampaign = (c: Campaign) => setEditing({
    ...c, starts_at: (c.starts_at || '').slice(0, 10),
    tiers: (c.tiers || []).map((t) => ({ ...t })), examples: [...(c.examples || [])],
  })
  const saveCampaign = async () => {
    if (!editing) return
    setSaving(true); setError('')
    try { await call({ action: 'campaign_save', campaign: editing }); await load(); setEditing(null) }
    catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }
  const deleteCampaign = async () => {
    if (!editing?.id) { setEditing(null); return }
    if (!confirm('Delete this campaign?')) return
    setSaving(true)
    try { await call({ action: 'campaign_delete', id: editing.id }); await load(); setEditing(null) }
    catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }
  const setTier = (i: number, patch: Partial<Tier>) =>
    setEditing((e) => e ? { ...e, tiers: e.tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t) } : e)
  const addTier = () => setEditing((e) => e ? { ...e, tiers: [...e.tiers, { videos: null, views: 0, reward_label: '', reward_amount: 0 }] } : e)
  const removeTier = (i: number) => setEditing((e) => e ? { ...e, tiers: e.tiers.filter((_, idx) => idx !== i) } : e)
  const setExample = (i: number, v: string) => setEditing((e) => e ? { ...e, examples: e.examples.map((x, idx) => idx === i ? v : x) } : e)
  const addExample = () => setEditing((e) => e ? { ...e, examples: [...e.examples, ''] } : e)
  const removeExample = (i: number) => setEditing((e) => e ? { ...e, examples: e.examples.filter((_, idx) => idx !== i) } : e)

  const creatorFor = (cid: string) => creators.find((c) => c.id === cid)

  // ---------- styles ----------
  const page: React.CSSProperties = { minHeight: '100vh', background: '#f6f7f9', color: '#111827', fontFamily: 'system-ui, -apple-system, sans-serif' }
  const wrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '24px 20px 64px' }
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6b7280', padding: '12px 14px', borderBottom: '1px solid #eef0f2', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #f1f3f5', fontSize: 14, verticalAlign: 'middle' }
  const inputS: React.CSSProperties = { width: 72, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }
  const fieldS: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
  const btnDark: React.CSSProperties = { ...btn, background: '#111827', color: '#fff', border: 'none' }
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
            <button type="submit" disabled={loading} style={{ ...btnDark, width: '100%', padding: 11, fontSize: 15 }}>
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>
          {error && <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    )
  }

  const pending = submissions.filter((s) => s.status === 'pending').length
  const approved = submissions.filter((s) => s.status === 'approved').length
  const paidOut = submissions.filter((s) => s.paid).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)
  const owed = submissions.filter((s) => !s.paid).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)
  const stats = [
    { label: 'Creators', value: creators.length }, { label: 'Submissions', value: submissions.length },
    { label: 'Pending', value: pending }, { label: 'Approved', value: approved },
    { label: 'Paid out', value: money(paidOut) }, { label: 'Owed', value: money(owed) },
  ]

  return (
    <div style={page}>
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Mad Rewards Admin</h1>
          <button onClick={refresh} style={btn}>Refresh</button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</p>}

        {/* ---------- CAMPAIGN MANAGER ---------- */}
        <div style={{ ...card, padding: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Weekly Campaign</h2>
            {!editing && <button onClick={newCampaign} style={btnDark}>+ New campaign</button>}
          </div>

          {!editing && (
            <div>
              {campaigns.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No campaigns yet. Create one to set this week's reward tiers.</p>}
              {campaigns.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f3f5' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.title}</span>
                    <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 10 }}>{c.cadence} · {(c.tiers || []).length} tiers · from {fmtDate(c.starts_at)}</span>
                    {c.active && <span style={{ ...pill('paid'), marginLeft: 10 }}>active</span>}
                  </div>
                  <button onClick={() => editCampaign(c)} style={btn}>Edit</button>
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <label style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Title</div>
                  <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ ...fieldS, width: '100%', boxSizing: 'border-box' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cadence</div>
                  <select value={editing.cadence} onChange={(e) => setEditing({ ...editing, cadence: e.target.value })} style={fieldS}>
                    <option value="weekly">weekly</option><option value="monthly">monthly</option>
                  </select>
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Starts</div>
                  <input type="date" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} style={fieldS} />
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 8 }}>
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 14 }}>Active (shown to creators)</span>
                </label>
              </div>

              {/* tiers */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Reward tiers</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead><tr>
                    <th style={th}>Videos / week</th><th style={th}>Or views</th><th style={th}>Reward label</th><th style={th}>$ amount</th><th style={th}></th>
                  </tr></thead>
                  <tbody>
                    {editing.tiers.map((t, i) => (
                      <tr key={i}>
                        <td style={td}>
                          <input type="number" value={t.videos ?? ''} placeholder="—"
                            onChange={(e) => setTier(i, { videos: e.target.value === '' ? null : Number(e.target.value) })} style={inputS} />
                        </td>
                        <td style={td}><input type="number" value={t.views} onChange={(e) => setTier(i, { views: Number(e.target.value) })} style={{ ...inputS, width: 110 }} /></td>
                        <td style={td}><input value={t.reward_label} onChange={(e) => setTier(i, { reward_label: e.target.value })} style={{ ...fieldS, width: 180 }} /></td>
                        <td style={td}><input type="number" value={t.reward_amount} onChange={(e) => setTier(i, { reward_amount: Number(e.target.value) })} style={inputS} /></td>
                        <td style={td}><button onClick={() => removeTier(i)} style={{ ...btn, padding: '4px 10px', color: '#dc2626' }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={addTier} style={{ ...btn, marginTop: 8 }}>+ Add tier</button>

              {/* examples */}
              <div style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px' }}>Example video links</div>
              {editing.examples.map((x, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={x} placeholder="https://www.tiktok.com/@..." onChange={(e) => setExample(i, e.target.value)} style={{ ...fieldS, flex: 1 }} />
                  <button onClick={() => removeExample(i)} style={{ ...btn, color: '#dc2626' }}>Remove</button>
                </div>
              ))}
              <button onClick={addExample} style={btn}>+ Add example</button>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={saveCampaign} disabled={saving} style={btnDark}>{saving ? 'Saving…' : 'Save campaign'}</button>
                <button onClick={() => setEditing(null)} style={btn}>Cancel</button>
                {editing.id && <button onClick={deleteCampaign} style={{ ...btn, color: '#dc2626', marginLeft: 'auto' }}>Delete</button>}
              </div>
            </div>
          )}
        </div>

        {/* ---------- STATS ---------- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ---------- CREATORS ---------- */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Creators ({creators.length})</h2>
        <div style={{ ...card, overflowX: 'auto', marginBottom: 36 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>TikTok</th><th style={th}>Instagram</th><th style={th}>Status</th><th style={th}>Joined</th></tr></thead>
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

        {/* ---------- SUBMISSIONS ---------- */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Video submissions ({submissions.length})</h2>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>
              <th style={th}>Creator</th><th style={th}>Video</th><th style={th}>Platform</th>
              <th style={th}>Submitted</th><th style={th}>Views</th><th style={th}>Status</th><th style={th}>Reward</th><th style={th}>Paid</th>
            </tr></thead>
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
                      <a href={toUrl(s.video_url)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.video_url}</a>
                    </td>
                    <td style={{ ...td, textTransform: 'capitalize', color: '#6b7280' }}>{s.platform}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{fmtDate(s.created_at)}</td>
                    <td style={td}><input type="number" defaultValue={s.views} style={inputS} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.views) update(s.id, { views: v }) }} /></td>
                    <td style={td}>
                      <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textTransform: 'capitalize' }}>
                        {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#6b7280' }}>$</span>
                        <input type="number" defaultValue={s.reward_amount} style={inputS} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.reward_amount) update(s.id, { reward_amount: v }) }} />
                      </div>
                    </td>
                    <td style={td}><input type="checkbox" checked={s.paid} onChange={(e) => update(s.id, { paid: e.target.checked })} style={{ width: 18, height: 18, cursor: 'pointer' }} /></td>
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

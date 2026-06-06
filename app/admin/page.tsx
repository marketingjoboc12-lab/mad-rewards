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

const fmtDate = (s: string) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return s } }
const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const num = (n: number) => (Number(n) || 0).toLocaleString()
const toUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

// tiny inline icons (no external deps)
const Ico = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7a3 3 0 1 0-3-3c0 1.66 1.34 3 3 3zM12 7a3 3 0 1 1 3-3c0 1.66-1.34 3-3 3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  film: 'M2 4h20v16H2zM7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  spark: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z',
}
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  )
}

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState<'overview' | 'campaign' | 'creators' | 'submissions'>('overview')

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
  const newCampaign = () => { setEditing({
    title: 'This Week', active: true, cadence: 'weekly',
    starts_at: new Date().toISOString().slice(0, 10),
    tiers: DEFAULT_TIERS.map((t) => ({ ...t })), examples: [],
  }); setTab('campaign') }
  const editCampaign = (c: Campaign) => { setEditing({
    ...c, starts_at: (c.starts_at || '').slice(0, 10),
    tiers: (c.tiers || []).map((t) => ({ ...t })), examples: [...(c.examples || [])],
  }); setTab('campaign') }
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

  const dark = theme === 'dark'
  const vars: any = dark ? {
    '--bg': '#0a0a0b', '--bg2': '#0f0f11', '--panel': '#141417', '--panel2': '#1b1b1f',
    '--border': '#262629', '--border2': '#34343b', '--text': '#f4f4f5', '--dim': '#9b9ba3',
    '--faint': '#6b6b73', '--accent': '#c6f24e', '--accent-ink': '#0d0f08', '--accent-soft': 'rgba(198,242,78,0.12)',
    '--shadow': '0 1px 0 rgba(255,255,255,0.03), 0 8px 30px -12px rgba(0,0,0,0.6)',
  } : {
    '--bg': '#f4f5f7', '--bg2': '#eef0f3', '--panel': '#ffffff', '--panel2': '#f6f7f9',
    '--border': '#e6e8ec', '--border2': '#d4d7dd', '--text': '#0e1116', '--dim': '#5b6470',
    '--faint': '#9aa2ad', '--accent': '#5b8f00', '--accent-ink': '#ffffff', '--accent-soft': 'rgba(91,143,0,0.10)',
    '--shadow': '0 1px 2px rgba(16,24,40,0.04), 0 12px 28px -16px rgba(16,24,40,0.18)',
  }

  // ---------- login ----------
  if (!authed) {
    return (
      <div className="madx madx-center" style={vars}>
        <style>{CSS}</style>
        <div className="card login">
          <div className="brand login-brand"><span className="brand-mark" />MAD <b>REWARDS</b></div>
          <h1 className="login-h1">Admin access</h1>
          <p className="muted">Enter your admin password to continue.</p>
          <form onSubmit={login} style={{ marginTop: 18 }}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input" style={{ width: '100%' }} />
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}>
              {loading ? 'Checking…' : 'Enter dashboard'}
            </button>
          </form>
          {error && <p className="err">{error}</p>}
        </div>
      </div>
    )
  }

  const pending = submissions.filter((s) => s.status === 'pending').length
  const approved = submissions.filter((s) => s.status === 'approved').length
  const paidOut = submissions.filter((s) => s.paid).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)
  const owed = submissions.filter((s) => !s.paid && (s.status === 'approved' || s.status === 'paid')).reduce((a, s) => a + (Number(s.reward_amount) || 0), 0)
  const activeCampaign = campaigns.find((c) => c.active)

  const nav = [
    { id: 'overview', label: 'Overview', d: Ico.grid },
    { id: 'campaign', label: 'Campaign', d: Ico.gift, badge: campaigns.length || undefined },
    { id: 'creators', label: 'Creators', d: Ico.users, badge: creators.length || undefined },
    { id: 'submissions', label: 'Submissions', d: Ico.film, badge: pending || undefined },
  ] as const

  const titleFor: Record<string, string> = { overview: 'Overview', campaign: 'Campaign', creators: 'Creators', submissions: 'Video submissions' }

  return (
    <div className="madx" style={vars}>
      <style>{CSS}</style>

      {/* ---------- SIDEBAR ---------- */}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" />MAD <b>REWARDS</b></div>
        <nav className="nav">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id as any)} className={`navbtn${tab === n.id ? ' active' : ''}`}>
              <Icon d={n.d} size={18} />
              <span>{n.label}</span>
              {n.badge ? <span className="navbadge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="navbtn" onClick={() => setTheme(dark ? 'light' : 'dark')}>
            <Icon d={dark ? Ico.sun : Ico.moon} size={18} /><span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="navbtn danger" onClick={() => { setAuthed(false); setPassword('') }}>
            <Icon d={Ico.logout} size={18} /><span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ---------- MAIN ---------- */}
      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{fmtDate(new Date().toISOString())}</div>
            <h1 className="page-title">{titleFor[tab]}</h1>
          </div>
          <div className="top-actions">
            <button className="iconbtn only-mobile" onClick={() => setTheme(dark ? 'light' : 'dark')} title="Toggle theme">
              <Icon d={dark ? Ico.sun : Ico.moon} />
            </button>
            <button className="btn btn-ghost" onClick={refresh}><Icon d={Ico.refresh} size={16} />Refresh</button>
          </div>
        </header>

        {error && <div className="banner">{error}</div>}

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (
          <>
            {/* hero */}
            <div className="hero">
              <div className="hero-blob b1" />
              <div className="hero-blob b2" />
              <div className="hero-ico"><Icon d={Ico.trophy} size={150} /></div>
              <div className="hero-inner">
                <div className="hero-kick">Mad Rewards · Control room</div>
                <h2 className="hero-h">Welcome back.</h2>
                <p className="hero-sub">
                  {activeCampaign
                    ? <>“{activeCampaign.title}” is live — {(activeCampaign.tiers || []).length} tiers, {activeCampaign.cadence}, since {fmtDate(activeCampaign.starts_at)}.</>
                    : <>No campaign is live. Creators see nothing until you launch one.</>}
                </p>
                <div className="hero-cta">
                  <button className="btn btn-primary" onClick={() => setTab('campaign')}>{activeCampaign ? 'Manage campaign' : 'Launch a campaign'}</button>
                  <button className="btn btn-ghost glassy" onClick={() => setTab('submissions')}>Review submissions{pending ? ` (${pending})` : ''}</button>
                </div>
              </div>
            </div>

            {/* gradient feature cards */}
            <div className="feature-grid">
              <div className="feature feat-lime">
                <div className="feat-top">
                  <span className="feat-label">Paid to creators</span>
                  <Icon d={Ico.wallet} size={20} />
                </div>
                <div className="bar"><span style={{ width: `${paidOut + owed > 0 ? Math.round((paidOut / (paidOut + owed)) * 100) : 0}%` }} /></div>
                <div className="feat-figs">
                  <div><div className="feat-big">{money(paidOut)}</div><div className="feat-cap">paid out</div></div>
                  <div className="right"><div className="feat-big">{money(owed)}</div><div className="feat-cap">still owed</div></div>
                </div>
              </div>

              <div className="feature feat-violet">
                <div className="feat-top">
                  <span className="feat-label">Submissions pipeline</span>
                  <Icon d={Ico.film} size={20} />
                </div>
                <div className="bar light"><span style={{ width: `${submissions.length > 0 ? Math.round((approved / submissions.length) * 100) : 0}%` }} /></div>
                <div className="feat-figs">
                  <div><div className="feat-big">{approved}</div><div className="feat-cap">approved</div></div>
                  <div className="right"><div className="feat-big">{pending}</div><div className="feat-cap">pending review</div></div>
                </div>
              </div>
            </div>

            {/* icon tiles */}
            <div className="tile-grid">
              <div className="card tile">
                <span className="tile-ico ic-lime"><Icon d={Ico.users} size={20} /></span>
                <div><div className="tile-val">{creators.length}</div><div className="tile-lab">Creators</div></div>
              </div>
              <div className="card tile">
                <span className="tile-ico ic-sky"><Icon d={Ico.film} size={20} /></span>
                <div><div className="tile-val">{submissions.length}</div><div className="tile-lab">Submissions</div></div>
              </div>
              <div className="card tile">
                <span className="tile-ico ic-amber"><Icon d={Ico.clock} size={20} /></span>
                <div><div className="tile-val">{pending}</div><div className="tile-lab">Pending review</div></div>
              </div>
              <div className="card tile">
                <span className="tile-ico ic-violet"><Icon d={Ico.check} size={20} /></span>
                <div><div className="tile-val">{approved}</div><div className="tile-lab">Approved</div></div>
              </div>
            </div>

            {pending > 0 && (
              <div className="card pad nudge" style={{ marginTop: 16 }}>
                <div><b>{pending}</b> submission{pending > 1 ? 's' : ''} waiting for a decision.</div>
                <button className="btn btn-ghost" onClick={() => setTab('submissions')}>Review now</button>
              </div>
            )}
          </>
        )}

        {/* ===== CAMPAIGN ===== */}
        {tab === 'campaign' && (
          <div className="card pad">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <div className="card-h">Reward campaign</div>
              {!editing && <button onClick={newCampaign} className="btn btn-primary">+ New campaign</button>}
            </div>

            {!editing && (
              <div>
                {campaigns.length === 0 && <p className="muted">No campaigns yet. Create one to set the reward tiers creators see.</p>}
                {campaigns.map((c) => (
                  <div key={c.id} className="list-row">
                    <div>
                      <span style={{ fontWeight: 700 }}>{c.title}</span>
                      <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>{c.cadence} · {(c.tiers || []).length} tiers · from {fmtDate(c.starts_at)}</span>
                      {c.active && <span className="pill paid" style={{ marginLeft: 10 }}>active</span>}
                    </div>
                    <button onClick={() => editCampaign(c)} className="btn btn-ghost">Edit</button>
                  </div>
                ))}
              </div>
            )}

            {editing && (
              <div>
                <div className="form-row">
                  <label className="field" style={{ flex: '1 1 220px' }}>
                    <span className="flabel">Title</span>
                    <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="input" style={{ width: '100%' }} />
                  </label>
                  <label className="field">
                    <span className="flabel">Cadence</span>
                    <select value={editing.cadence} onChange={(e) => setEditing({ ...editing, cadence: e.target.value })} className="input">
                      <option value="weekly">weekly</option><option value="monthly">monthly</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="flabel">Starts</span>
                    <input type="date" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} className="input" />
                  </label>
                  <label className="field check">
                    <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                    <span>Active (shown to creators)</span>
                  </label>
                </div>

                <div className="flabel" style={{ marginTop: 18, marginBottom: 8 }}>Reward tiers</div>
                <div className="table-scroll">
                  <table className="tbl tiers">
                    <thead><tr>
                      <th>Videos / week</th><th>Or views</th><th>Reward label</th><th>$ amount</th><th></th>
                    </tr></thead>
                    <tbody>
                      {editing.tiers.map((t, i) => (
                        <tr key={i}>
                          <td><input type="number" value={t.videos ?? ''} placeholder="—" onChange={(e) => setTier(i, { videos: e.target.value === '' ? null : Number(e.target.value) })} className="input sm" /></td>
                          <td><input type="number" value={t.views} onChange={(e) => setTier(i, { views: Number(e.target.value) })} className="input" style={{ width: 120 }} /></td>
                          <td><input value={t.reward_label} onChange={(e) => setTier(i, { reward_label: e.target.value })} className="input" style={{ width: 190 }} /></td>
                          <td><input type="number" value={t.reward_amount} onChange={(e) => setTier(i, { reward_amount: Number(e.target.value) })} className="input sm" /></td>
                          <td><button onClick={() => removeTier(i)} className="btn btn-ghost danger sm">Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={addTier} className="btn btn-ghost" style={{ marginTop: 10 }}>+ Add tier</button>

                <div className="flabel" style={{ marginTop: 22, marginBottom: 8 }}>Example video links</div>
                {editing.examples.map((x, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={x} placeholder="https://www.tiktok.com/@..." onChange={(e) => setExample(i, e.target.value)} className="input" style={{ flex: 1 }} />
                    <button onClick={() => removeExample(i)} className="btn btn-ghost danger">Remove</button>
                  </div>
                ))}
                <button onClick={addExample} className="btn btn-ghost">+ Add example</button>

                <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'center' }}>
                  <button onClick={saveCampaign} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save campaign'}</button>
                  <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
                  {editing.id && <button onClick={deleteCampaign} className="btn btn-ghost danger" style={{ marginLeft: 'auto' }}>Delete</button>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== CREATORS ===== */}
        {tab === 'creators' && (
          <div className="card table-scroll">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>TikTok</th><th>Instagram</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="muted">{c.email}</td>
                    <td>{c.tiktok_handle || '—'}</td>
                    <td>{c.instagram_handle || '—'}</td>
                    <td><span className={`pill ${c.status}`}>{c.status}</span></td>
                    <td className="muted">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
                {creators.length === 0 && <tr><td className="empty" colSpan={6}>No creators yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== SUBMISSIONS ===== */}
        {tab === 'submissions' && (
          <div className="card table-scroll">
            <table className="tbl">
              <thead><tr>
                <th>Creator</th><th>Video</th><th>Platform</th><th>Submitted</th><th>Views</th><th>Status</th><th>Reward</th><th>Paid</th>
              </tr></thead>
              <tbody>
                {submissions.map((s) => {
                  const c = creatorFor(s.creator_id)
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c?.name || '—'}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{c?.email || s.creator_id.slice(0, 8)}</div>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <a href={toUrl(s.video_url)} target="_blank" rel="noreferrer" className="link ellipsis">{s.video_url}</a>
                      </td>
                      <td className="muted" style={{ textTransform: 'capitalize' }}>{s.platform}</td>
                      <td className="muted">{fmtDate(s.created_at)}</td>
                      <td><input type="number" defaultValue={s.views} className="input sm" onBlur={(e) => { const v = Number(e.target.value); if (v !== s.views) update(s.id, { views: v }) }} /></td>
                      <td>
                        <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })} className={`input statussel ${s.status}`} style={{ textTransform: 'capitalize' }}>
                          {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="muted">$</span>
                          <input type="number" defaultValue={s.reward_amount} className="input sm" onBlur={(e) => { const v = Number(e.target.value); if (v !== s.reward_amount) update(s.id, { reward_amount: v }) }} />
                        </div>
                      </td>
                      <td><input type="checkbox" checked={s.paid} onChange={(e) => update(s.id, { paid: e.target.checked })} className="chk" /></td>
                    </tr>
                  )
                })}
                {submissions.length === 0 && <tr><td className="empty" colSpan={8}>No submissions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap');
.madx *{box-sizing:border-box}
.madx{min-height:100vh;display:flex;background:var(--bg);color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.madx-center{align-items:center;justify-content:center;padding:24px}
.madx button{font-family:inherit}
.muted{color:var(--dim)}
.err{color:#ef4444;font-size:14px;margin-top:12px}

/* brand */
.brand{display:flex;align-items:center;gap:9px;font-weight:600;letter-spacing:.18em;font-size:15px;
  font-family:'Fredoka',ui-sans-serif,system-ui,sans-serif}
.brand b{font-weight:800}
.brand-mark{width:16px;height:16px;border-radius:5px;background:var(--accent);
  box-shadow:0 0 0 3px var(--accent-soft)}

/* login */
.login{width:380px;max-width:100%;padding:30px}
.login-brand{margin-bottom:22px}
.login-h1{font-family:'Fredoka',sans-serif;font-size:26px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em}

/* sidebar */
.sidebar{width:240px;flex-shrink:0;border-right:1px solid var(--border);background:var(--bg2);
  padding:22px 16px;display:flex;flex-direction:column;gap:8px;position:sticky;top:0;height:100vh}
.sidebar .brand{padding:0 8px 14px}
.nav{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.side-foot{margin-top:auto;display:flex;flex-direction:column;gap:3px;padding-top:12px;border-top:1px solid var(--border)}
.navbtn{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border-radius:11px;
  border:1px solid transparent;background:transparent;color:var(--dim);font-size:14px;font-weight:600;
  cursor:pointer;text-align:left;transition:all .15s ease}
.navbtn:hover{background:var(--panel);color:var(--text)}
.navbtn.active{background:var(--panel);color:var(--text);border-color:var(--border2);box-shadow:var(--shadow)}
.navbtn.active svg{color:var(--accent)}
.navbtn.danger:hover{color:#ef4444}
.navbadge{margin-left:auto;font-size:11px;font-weight:700;background:var(--accent-soft);color:var(--accent);
  padding:2px 8px;border-radius:999px;min-width:22px;text-align:center}

/* main */
.main{flex:1;min-width:0;padding:26px 30px 70px;max-width:1180px}
.topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:24px}
.crumb{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);font-weight:600}
.page-title{font-family:'Fredoka',sans-serif;font-size:30px;font-weight:800;margin:4px 0 0;letter-spacing:-.02em}
.top-actions{display:flex;gap:10px;align-items:center}

/* buttons */
.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:11px;font-size:14px;
  font-weight:700;cursor:pointer;border:1px solid var(--border2);background:var(--panel);color:var(--text);
  transition:all .15s ease}
.btn:hover{border-color:var(--accent);transform:translateY(-1px)}
.btn:disabled{opacity:.55;cursor:default;transform:none}
.btn-primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn-primary:hover{filter:brightness(1.06);border-color:var(--accent)}
.btn-ghost{background:var(--panel)}
.btn.danger{color:#ef4444;border-color:transparent;background:transparent}
.btn.danger:hover{border-color:#ef4444;transform:none}
.btn.sm{padding:5px 11px;font-size:13px;border-radius:9px}
.iconbtn{display:none;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;
  border:1px solid var(--border2);background:var(--panel);color:var(--text);cursor:pointer}

/* cards */
.card{background:var(--panel);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
.card.pad{padding:22px}
.card-h{font-family:'Fredoka',sans-serif;font-size:18px;font-weight:800;letter-spacing:-.01em}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}

/* stats */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:14px}
.stat{padding:18px 18px 16px}
.stat-label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);font-weight:600}
.stat-value{font-family:'Fredoka',sans-serif;font-size:30px;font-weight:800;margin-top:8px;letter-spacing:-.02em}
.stat-value.good{color:var(--accent)}
.stat-value.warn{color:#f59e0b}
.stat-hint{font-size:12px;color:var(--faint);margin-top:3px}

.nudge{display:flex;align-items:center;justify-content:space-between;gap:14px;
  border-color:var(--accent);background:var(--accent-soft)}

/* list rows */
.list-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid var(--border)}
.list-row:last-child{border-bottom:none}

/* forms */
.form-row{display:flex;flex-wrap:wrap;gap:14px}
.field{display:flex;flex-direction:column;gap:6px}
.field.check{flex-direction:row;align-items:center;gap:8px;align-self:flex-end;padding-bottom:9px}
.flabel{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}
.input{padding:9px 11px;border:1px solid var(--border2);border-radius:10px;font-size:14px;
  background:var(--panel2);color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s}
.input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.input.sm{width:78px}
select.input{cursor:pointer}
.check input,.chk{width:18px;height:18px;cursor:pointer;accent-color:var(--accent)}

/* tables */
.table-scroll{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;min-width:680px}
.tbl.tiers{min-width:640px}
.tbl th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);
  font-weight:700;padding:13px 16px;border-bottom:1px solid var(--border);white-space:nowrap}
.tbl td{padding:13px 16px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:middle}
.tbl tbody tr:last-child td{border-bottom:none}
.tbl tbody tr{transition:background .12s}
.tbl tbody tr:hover{background:var(--panel2)}
.empty{text-align:center;color:var(--faint);padding:34px!important}
.link{color:var(--accent);text-decoration:none;font-weight:600}
.link:hover{text-decoration:underline}
.ellipsis{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* pills */
.pill{display:inline-block;padding:3px 11px;border-radius:999px;font-size:12px;font-weight:700;text-transform:capitalize}
.pill.pending{background:rgba(245,158,11,.16);color:#f59e0b}
.pill.approved{background:rgba(59,130,246,.16);color:#3b82f6}
.pill.rejected{background:rgba(239,68,68,.16);color:#ef4444}
.pill.paid{background:var(--accent-soft);color:var(--accent)}
.statussel.pending{color:#f59e0b}
.statussel.approved{color:#3b82f6}
.statussel.rejected{color:#ef4444}
.statussel.paid{color:var(--accent)}

/* banner */
.banner{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);
  padding:11px 15px;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:18px}

.only-mobile{display:none}

/* hero */
.hero{position:relative;overflow:hidden;border-radius:22px;padding:34px 34px 30px;margin-bottom:22px;
  border:1px solid var(--border);
  background:
    radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 45%),
    radial-gradient(120% 160% at 0% 120%, rgba(124,58,237,.16) 0%, transparent 50%),
    var(--panel)}
.hero-inner{position:relative;z-index:2;max-width:640px}
.hero-kick{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.hero-h{font-family:'Fredoka',sans-serif;font-size:38px;font-weight:700;letter-spacing:-.01em;margin:8px 0 6px;line-height:1.02}
.hero-sub{color:var(--dim);font-size:15px;line-height:1.5;margin:0 0 20px;max-width:520px}
.hero-cta{display:flex;gap:10px;flex-wrap:wrap}
.btn.glassy{background:var(--panel2);border-color:var(--border2)}
.hero-blob{position:absolute;border-radius:50%;filter:blur(8px);opacity:.5;z-index:1;pointer-events:none}
.hero-blob.b1{width:240px;height:240px;top:-90px;right:-40px;background:radial-gradient(circle,var(--accent) 0%,transparent 70%);opacity:.22}
.hero-blob.b2{width:200px;height:200px;bottom:-100px;left:30%;background:radial-gradient(circle,#7c3aed 0%,transparent 70%);opacity:.20}
.hero-ico{position:absolute;right:26px;top:50%;transform:translateY(-50%) rotate(-8deg);color:var(--accent);
  opacity:.14;z-index:1;pointer-events:none}

/* feature cards */
.feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.feature{border-radius:20px;padding:22px 24px;color:#0b1400;position:relative;overflow:hidden;
  box-shadow:0 14px 32px -16px rgba(0,0,0,.5)}
.feat-lime{background:linear-gradient(135deg,#bef264 0%,#84cc16 45%,#4d9b0f 100%);color:#10240a}
.feat-violet{background:linear-gradient(135deg,#a78bfa 0%,#7c3aed 50%,#5b21b6 100%);color:#fff}
.feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.feat-label{font-weight:700;font-size:14px;letter-spacing:.01em;opacity:.92}
.feat-top svg{opacity:.8}
.bar{height:8px;border-radius:999px;background:rgba(0,0,0,.16);overflow:hidden;margin-bottom:16px}
.bar.light{background:rgba(255,255,255,.28)}
.bar span{display:block;height:100%;border-radius:999px;background:rgba(0,0,0,.55);transition:width .5s ease}
.bar.light span{background:#fff}
.feat-figs{display:flex;justify-content:space-between;align-items:flex-end}
.feat-figs .right{text-align:right}
.feat-big{font-family:'Fredoka',sans-serif;font-size:30px;font-weight:700;line-height:1}
.feat-cap{font-size:12px;font-weight:600;opacity:.78;margin-top:4px}

/* icon tiles */
.tile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.tile{display:flex;align-items:center;gap:14px;padding:16px 18px}
.tile-ico{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  color:#fff;flex-shrink:0;box-shadow:0 6px 16px -6px rgba(0,0,0,.4)}
.ic-lime{background:linear-gradient(135deg,#a3e635,#4d7c0f);color:#10240a}
.ic-violet{background:linear-gradient(135deg,#a78bfa,#6d28d9)}
.ic-amber{background:linear-gradient(135deg,#fcd34d,#d97706);color:#3a1d00}
.ic-sky{background:linear-gradient(135deg,#7dd3fc,#0284c7)}
.tile-val{font-family:'Fredoka',sans-serif;font-size:26px;font-weight:700;line-height:1}
.tile-lab{font-size:13px;color:var(--dim);margin-top:3px;font-weight:600}

@media (max-width:760px){ .feature-grid{grid-template-columns:1fr} .hero-ico{display:none} .hero-h{font-size:30px} }

@media (max-width:860px){
  .madx{flex-direction:column}
  .sidebar{width:100%;height:auto;position:static;flex-direction:row;flex-wrap:wrap;align-items:center;
    gap:6px;padding:12px 14px;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar .brand{padding:0 8px 0 4px;border:none}
  .nav{flex-direction:row;flex:1;margin:0;flex-wrap:wrap}
  .navbtn{width:auto;padding:8px 12px}
  .navbtn span:not(.navbadge){display:none}
  .side-foot{flex-direction:row;border:none;padding:0;margin-left:auto}
  .side-foot .navbtn span{display:none}
  .main{padding:20px 16px 60px}
  .page-title{font-size:24px}
  .iconbtn{display:none}
}
`

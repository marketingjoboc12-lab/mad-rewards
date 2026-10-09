'use client'

import { useEffect, useState } from 'react'
import {
  RATE_BANDS, WEEKLY_CAP, CAP_VIEWS, LOGO_PFP_BONUS, REUP_VIDEOS, MILESTONES, MONTHLY_PRIZES,
  computeWeek, computeMonth, computeReup, lifetimeViews, milestonesReached, payForViews, lastClosedWeek, weekStart, monthStart, addDays,
  weekLabel, monthLabel, todayLocal, type SubLike,
} from '@/lib/rewards'

type Creator = {
  id: string; name: string; email: string
  phone: string | null; cashapp: string | null
  tiktok_handle: string | null; instagram_handle: string | null
  status: string; created_at: string
}
type Submission = {
  id: string; creator_id: string; video_url: string; platform: string
  status: string; views: number; paid: boolean; reward_amount: number; created_at: string
  posted_at?: string | null; claimed_views?: number
}
type Campaign = {
  id?: string; title: string; active: boolean; cadence: string
  starts_at: string; tiers: any[]; examples: string[]
}
type Payout = { id: string; creator_id: string; period: 'week' | 'month'; period_start: string; amount: number; label: string | null; details: any; paid_at: string }
type Invite = { id: string; code: string; note: string | null; used: boolean; used_email: string | null; created_at: string; used_at: string | null }
type ReqRow = { id: string; name: string; email: string; tiktok_handle: string | null; instagram_handle: string | null; note: string | null; status: string; invite_code: string | null; created_at: string }

const STATUS = ['pending', 'approved', 'rejected']

const posted = (s: Submission) => (s.posted_at || s.created_at || '').slice(0, 10)
const toSubLike = (s: Submission): SubLike => ({ posted: posted(s), status: s.status, views: s.views, claimedViews: s.claimed_views || 0 })

const fmtDate = (s: string) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return s } }
const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const num = (n: number) => (Number(n) || 0).toLocaleString()
const parseV = (raw: string) => {
  if (raw == null) return 0
  let s = String(raw).trim().toLowerCase().replace(/,/g, '').replace(/\s/g, '')
  if (!s) return 0
  let mult = 1
  if (s.endsWith('m')) { mult = 1_000_000; s = s.slice(0, -1) }
  else if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1) }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n * mult)
}
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
  ticket: 'M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM13 5v2M13 17v2M13 11v2',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  copy: 'M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  chev: 'M9 18l6-6-6-6',
}
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  )
}

export default function AdminPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [requests, setRequests] = useState<ReqRow[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payWeek, setPayWeek] = useState(() => lastClosedWeek())
  const [payMonth, setPayMonth] = useState(() => monthStart(addDays(monthStart(todayLocal()), -1)))
  const [subWeek, setSubWeek] = useState<string>('all')
  const [pfp, setPfp] = useState<Record<string, boolean>>({})
  const [paying, setPaying] = useState('')
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState<'overview' | 'payouts' | 'campaign' | 'creators' | 'submissions' | 'invites' | 'requests'>('overview')
  const [copied, setCopied] = useState('')
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})

  const call = async (payload: object) => {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.loggedOut) setAuthed(false)
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  const load = async () => {
    const data = await call({ action: 'list' })
    setCreators(data.creators ?? [])
    setSubmissions(data.submissions ?? [])
    setCampaigns(data.campaigns ?? [])
    setInvites(data.invites ?? [])
    setRequests(data.requests ?? [])
    setPayouts(data.payouts ?? [])
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await call({ action: 'login', username, password })
      await load(); setAuthed(true); setPassword('')
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }
  const logout = async () => {
    try { await call({ action: 'logout' }) } catch {}
    setAuthed(false); setUsername(''); setPassword('')
  }

  // Already logged in on this browser? Skip the login screen.
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    load().then(() => setAuthed(true)).catch(() => {}).finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const refresh = async () => { setError(''); try { await load() } catch (err: any) { setError(err.message) } }

  const update = async (id: string, patch: Partial<Submission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try { await call({ action: 'update', id, patch }) } catch (err: any) { setError(err.message) }
  }

  // ----- payouts -----
  const markPaid = async (payload: { creator_id: string; period: 'week' | 'month'; period_start: string; amount: number; label: string; details?: any }) => {
    setError(''); setPaying(payload.creator_id + payload.period)
    try { await call({ action: 'mark_paid', ...payload }); await load() } catch (err: any) { setError(err.message) } finally { setPaying('') }
  }
  const unmarkPaid = async (id: string) => {
    if (!confirm('Undo this payment? The videos go back to "approved".')) return
    setError('')
    try { await call({ action: 'unmark_paid', id }); await load() } catch (err: any) { setError(err.message) }
  }

  // ----- deletes -----
  const deleteCreator = async (c: Creator) => {
    const typed = prompt(`Delete ${c.name} (${c.email})?\n\nThis removes their login, all their videos and payout history. It can't be undone.\n\nType DELETE to confirm:`)
    if (typed !== 'DELETE') return
    setError('')
    try { await call({ action: 'creator_delete', id: c.id }); await load() } catch (err: any) { setError(err.message) }
  }
  const deleteSubmission = async (s: Submission) => {
    if (s.status === 'paid') { alert('This video is already paid. Undo the payment in Weekly pay first.'); return }
    if (!confirm(`Delete this video submission?\n\n${s.video_url}`)) return
    setError('')
    try { await call({ action: 'submission_delete', id: s.id }); await load() } catch (err: any) { setError(err.message) }
  }

  // ----- campaign editing (title + example videos; reward numbers live in lib/rewards.ts) -----
  const newCampaign = () => { setEditing({
    title: 'Mad Rewards', active: true, cadence: 'weekly',
    starts_at: new Date().toISOString().slice(0, 10),
    tiers: [], examples: [],
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
  const setExample = (i: number, v: string) => setEditing((e) => e ? { ...e, examples: e.examples.map((x, idx) => idx === i ? v : x) } : e)
  const addExample = () => setEditing((e) => e ? { ...e, examples: [...e.examples, ''] } : e)
  const removeExample = (i: number) => setEditing((e) => e ? { ...e, examples: e.examples.filter((_, idx) => idx !== i) } : e)

  const creatorFor = (cid: string) => creators.find((c) => c.id === cid)

  // ----- invites & requests -----
  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1500) } catch {}
  }
  const genInvite = async () => {
    setError('')
    try { await call({ action: 'invite_create' }); await load() } catch (err: any) { setError(err.message) }
  }
  const delInvite = async (id: string) => {
    setError('')
    try { await call({ action: 'invite_delete', id }); await load() } catch (err: any) { setError(err.message) }
  }
  const approveReq = async (id: string) => {
    setError('')
    try { const r = await call({ action: 'request_approve', id }); await load(); if (r.code) { copy(r.code); alert(`Approved. Invite code copied:\n\n${r.code}\n\nSend it to them directly.`) } }
    catch (err: any) { setError(err.message) }
  }
  const declineReq = async (id: string) => {
    if (!confirm('Decline this request?')) return
    setError('')
    try { await call({ action: 'request_decline', id }); await load() } catch (err: any) { setError(err.message) }
  }

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
  if (!authed && checking) {
    return <div className="madx madx-center" style={vars}><style>{CSS}</style><p className="muted">Loading…</p></div>
  }
  if (!authed) {
    return (
      <div className="madx madx-center" style={vars}>
        <style>{CSS}</style>
        <div className="card login">
          <div className="brand login-brand"><span className="brand-mark" />MAD <b>REWARDS</b></div>
          <h1 className="login-h1">Admin access</h1>
          <p className="muted">Sign in to continue.</p>
          <form onSubmit={login} style={{ marginTop: 18 }}>
            <input type="text" autoComplete="username" autoCapitalize="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="input" style={{ width: '100%', marginBottom: 10 }} />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input" style={{ width: '100%' }} />
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
  const activeCampaign = campaigns.find((c) => c.active)

  // ----- weekly pay sheet -----
  const subsBy = (cid: string) => submissions.filter((s) => s.creator_id === cid).map(toSubLike)
  const paidRow = (cid: string, period: 'week' | 'month', start: string) =>
    payouts.find((p) => p.creator_id === cid && p.period === period && p.period_start === start)
  // merch already handed out (recorded on earlier weekly payouts)
  const given = (cid: string, key: string) =>
    payouts.some((p) => p.creator_id === cid && p.period_start !== payWeek && (p.details?.[key] === true || (p.details?.milestones || []).includes(key)))
  const weekRows = creators.map((c) => {
    const subs = subsBy(c.id)
    const w = computeWeek(subs, payWeek)
    const logo = !!pfp[c.id + payWeek]
    const r = computeReup(subs, payWeek)
    // re-up is handed out on the 2nd week of each 2-week period
    const reup = r.earned && addDays(r.start, 7) === payWeek && !given(c.id, 'reup_' + r.start)
    const merch = milestonesReached(lifetimeViews(subs, addDays(payWeek, 6))).filter((m) => !given(c.id, m.label))
    return { c, w, logo, reup, reupKey: 'reup_' + r.start, merch, total: w.pay + (logo && w.videos > 0 ? LOGO_PFP_BONUS : 0), paid: paidRow(c.id, 'week', payWeek) }
  }).filter((r) => r.w.videos > 0 || r.w.pending > 0 || r.paid)
  const weekTotal = weekRows.reduce((a, r) => a + (r.paid ? Number(r.paid.amount) : r.total), 0)
  const weekPendingVideos = weekRows.reduce((a, r) => a + r.w.pending, 0)
  const monthRows = creators.map((c) => ({ c, m: computeMonth(subsBy(c.id), payMonth), paid: paidRow(c.id, 'month', payMonth) }))
    .filter((r) => r.m.views > 0).sort((a, b) => b.m.views - a.m.views)

  const paidOut = payouts.reduce((a, p) => a + (Number(p.amount) || 0), 0)
  const lastWeek = lastClosedWeek()
  const owed = creators.reduce((a, c) => paidRow(c.id, 'week', lastWeek) ? a : a + computeWeek(subsBy(c.id), lastWeek).pay, 0)

  const subsShown = subWeek === 'all' ? submissions : submissions.filter((s) => weekStart(posted(s)) === subWeek)
  const weekOptions = Array.from(new Set(submissions.map((s) => weekStart(posted(s))).filter(Boolean))).sort().reverse()

  // group submissions by creator + compute stats
  const dayKey = (s: Submission) => (s.posted_at || s.created_at || '').slice(0, 10)
  const subGroups = (() => {
    const map = new Map<string, Submission[]>()
    for (const s of subsShown) {
      const arr = map.get(s.creator_id) || []
      arr.push(s); map.set(s.creator_id, arr)
    }
    const groups = Array.from(map.entries()).map(([cid, entries]) => {
      const sorted = [...entries].sort((a, b) => dayKey(b).localeCompare(dayKey(a)))
      const totalClaimed = entries.reduce((a, s) => a + (Number(s.claimed_views) || 0), 0)
      const days = new Set(entries.map(dayKey).filter(Boolean))
      const distinctDays = days.size
      const dates = entries.map((s) => new Date(s.posted_at || s.created_at).getTime()).filter((t) => !isNaN(t))
      const first = dates.length ? Math.min(...dates) : Date.now()
      const daysSinceFirst = Math.max(0, Math.floor((Date.now() - first) / 86400000))
      const c = creators.find((x) => x.id === cid)
      return { cid, c, entries: sorted, count: entries.length, totalClaimed, distinctDays, daysSinceFirst }
    })
    // creators with most recent activity first
    return groups.sort((a, b) => dayKey(b.entries[0]).localeCompare(dayKey(a.entries[0])))
  })()

  const pendingReqs = requests.filter((r) => r.status === 'pending').length
  const unusedInvites = invites.filter((i) => !i.used).length

  const nav = [
    { id: 'overview', label: 'Overview', d: Ico.grid, badge: undefined },
    { id: 'submissions', label: 'Submissions', d: Ico.film, badge: pending || undefined },
    { id: 'payouts', label: 'Weekly pay', d: Ico.wallet, badge: undefined },
    { id: 'campaign', label: 'Rewards', d: Ico.gift, badge: undefined },
    { id: 'requests', label: 'Requests', d: Ico.inbox, badge: pendingReqs || undefined },
    { id: 'invites', label: 'Invites', d: Ico.ticket, badge: unusedInvites || undefined },
    { id: 'creators', label: 'Creators', d: Ico.users, badge: creators.length || undefined },
  ] as const

  const titleFor: Record<string, string> = { overview: 'Overview', payouts: 'Weekly pay', campaign: 'Rewards', creators: 'Creators', submissions: 'Video submissions', invites: 'Invite codes', requests: 'Signup requests' }

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
          <button className="navbtn danger" onClick={logout}>
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
                  Week closes Saturday 11:59pm (Sunday is a grace day). Verify views Monday, then pay from the Weekly pay tab.
                </p>
                <div className="hero-cta">
                  <button className="btn btn-primary" onClick={() => setTab('submissions')}>Review submissions{pending ? ` (${pending})` : ''}</button>
                  <button className="btn btn-ghost glassy" onClick={() => setTab('payouts')}>Weekly pay</button>
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
                  <div className="right"><div className="feat-big">{money(owed)}</div><div className="feat-cap">owed for {weekLabel(lastWeek)}</div></div>
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

        {/* ===== REWARDS (read-only rules + example videos) ===== */}
        {tab === 'campaign' && (
          <>
            <div className="card pad" style={{ marginBottom: 16 }}>
              <div className="card-h">Reward rules</div>
              <p className="muted" style={{ marginTop: 4 }}>These numbers live in <code>lib/rewards.ts</code>. Creators see the same ones.</p>
              <div className="rules-grid">
                <div>
                  <div className="flabel">Weekly pay (each band at its own rate)</div>
                  {RATE_BANDS.map((b, i) => (
                    <div key={i} className="rule-row">
                      <span>{i === 0 ? `First ${num(b.upTo)}` : b.upTo === Infinity ? `Over ${num(RATE_BANDS[i - 1].upTo)}` : `${num(RATE_BANDS[i - 1].upTo)} → ${num(b.upTo)}`} views</span>
                      <b>${b.per10k} per 10K</b>
                    </div>
                  ))}
                  <div className="rule-row"><span>Weekly cap (hit at {num(CAP_VIEWS)} views)</span><b>{money(WEEKLY_CAP)}</b></div>
                  {[100_000, 500_000, 1_000_000].map((v) => <div key={v} className="rule-row"><span>e.g. {num(v)} views</span><b>{money(payForViews(v))}</b></div>)}
                </div>
                <div>
                  <div className="flabel">Extras</div>
                  <div className="rule-row"><span>Mad Labs logo as profile pic</span><b>+{money(LOGO_PFP_BONUS)}/week</b></div>
                  <div className="rule-row"><span>{REUP_VIDEOS} videos in a 2-week period</span><b>Product re-up</b></div>
                  {MILESTONES.map((m) => <div key={m.views} className="rule-row"><span>{num(m.views)} total views</span><b>{m.emoji} {m.label}</b></div>)}
                  <div className="flabel" style={{ marginTop: 16 }}>Monthly prizes</div>
                  {MONTHLY_PRIZES.map((p) => <div key={p.views} className="rule-row"><span>{num(p.views)} views in a month</span><b>{p.emoji} {p.label}</b></div>)}
                </div>
              </div>
            </div>

            <div className="card pad">
              <div className="row-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="card-h">Example videos</div>
                  <div className="muted" style={{ marginTop: 4 }}>Shown on every creator's dashboard.</div>
                </div>
                {!editing && <button onClick={() => (activeCampaign ? editCampaign(activeCampaign) : newCampaign())} className="btn btn-primary">Edit examples</button>}
              </div>
              {!editing && (activeCampaign?.examples?.length
                ? activeCampaign.examples.map((x, i) => <div key={i} className="list-row"><a href={toUrl(x)} target="_blank" rel="noreferrer" className="link ellipsis">{x}</a></div>)
                : <p className="muted">No example videos yet.</p>)}
              {editing && (
                <div>
                  {editing.examples.map((x, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={x} placeholder="https://www.tiktok.com/@..." onChange={(e) => setExample(i, e.target.value)} className="input" style={{ flex: 1 }} />
                      <button onClick={() => removeExample(i)} className="btn btn-ghost danger">Remove</button>
                    </div>
                  ))}
                  <button onClick={addExample} className="btn btn-ghost">+ Add example</button>
                  <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'center' }}>
                    <button onClick={saveCampaign} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== WEEKLY PAY ===== */}
        {tab === 'payouts' && (
          <>
            <div className="card pad" style={{ marginBottom: 16 }}>
              <div className="row-between">
                <div>
                  <div className="card-h">Week of {weekLabel(payWeek)}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Only verified (approved) views count. "Also send" = product to ship. Total this week: <b style={{ color: 'var(--text)' }}>{money(weekTotal)}</b>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost sm" onClick={() => setPayWeek(addDays(payWeek, -7))}>← Prev</button>
                  <button className="btn btn-ghost sm" onClick={() => setPayWeek(lastClosedWeek())}>Last week</button>
                  <button className="btn btn-ghost sm" onClick={() => setPayWeek(addDays(payWeek, 7))}>Next →</button>
                </div>
              </div>
              {weekPendingVideos > 0 && (
                <div className="banner" style={{ marginTop: 14, marginBottom: 0 }}>
                  {weekPendingVideos} video{weekPendingVideos > 1 ? 's' : ''} from this week still pending. Review them in Submissions before paying.
                </div>
              )}
            </div>

            <div className="card table-scroll" style={{ marginBottom: 24 }}>
              <table className="tbl">
                <thead><tr>
                  <th>Creator</th><th>Videos</th><th>Verified views</th><th>View pay</th><th>Logo pfp</th><th>Also send</th><th>Total</th><th>Cash App</th><th></th>
                </tr></thead>
                <tbody>
                  {weekRows.map(({ c, w, logo, reup, reupKey, merch, total, paid }) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}{w.pending > 0 && <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{w.pending} pending</div>}</td>
                      <td>{w.videos}</td>
                      <td>{num(w.views)}</td>
                      <td>{money(w.pay)}{w.capped && <div className="muted" style={{ fontSize: 12 }}>capped</div>}</td>
                      <td>
                        {paid
                          ? (paid.details?.logo_pfp ? '✓' : <span className="muted">—</span>)
                          : <input type="checkbox" className="chk" checked={logo} onChange={(e) => setPfp((p) => ({ ...p, [c.id + payWeek]: e.target.checked }))} title={`+${money(LOGO_PFP_BONUS)} if their profile pic is the Mad Labs logo`} />}
                      </td>
                      <td>
                        {paid
                          ? ([paid.details?.[reupKey] && '🎁 Re-up', ...(paid.details?.milestones || [])].filter(Boolean).join(', ') || <span className="muted">—</span>)
                          : ([reup && '🎁 Re-up', ...merch.map((m) => `${m.emoji} ${m.label}`)].filter(Boolean).join(', ') || <span className="muted">—</span>)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{money(paid ? Number(paid.amount) : total)}</td>
                      <td>{c.cashapp || <span className="muted">—</span>}</td>
                      <td>
                        {paid ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="pill paid">paid {fmtDate(paid.paid_at)}</span>
                            <button className="btn btn-ghost sm" onClick={() => unmarkPaid(paid.id)}>Undo</button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-primary sm"
                            disabled={w.pending > 0 || paying === c.id + 'week'}
                            title={w.pending > 0 ? 'Review the pending videos first' : ''}
                            onClick={() => {
                              if (!confirm(`Mark ${c.name} paid ${money(total)} for ${weekLabel(payWeek)}?`)) return
                              markPaid({
                                creator_id: c.id, period: 'week', period_start: payWeek, amount: total,
                                label: [`views ${money(w.pay)}`, logo && `logo +${money(LOGO_PFP_BONUS)}`, reup && 're-up', ...merch.map((m) => m.label)].filter(Boolean).join(' + '),
                                details: { views: w.views, videos: w.videos, view_pay: w.pay, logo_pfp: logo, [reupKey]: reup, milestones: merch.map((m) => m.label) },
                              })
                            }}
                          >Mark paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {weekRows.length === 0 && <tr><td className="empty" colSpan={9}>No videos posted this week.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="card pad" style={{ marginBottom: 16 }}>
              <div className="row-between">
                <div>
                  <div className="card-h">Monthly prizes · {monthLabel(payMonth)}</div>
                  <div className="muted" style={{ marginTop: 4 }}>{MONTHLY_PRIZES.map((p) => `${num(p.views)} views → ${p.label}`).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost sm" onClick={() => setPayMonth(monthStart(addDays(payMonth, -1)))}>← Prev</button>
                  <button className="btn btn-ghost sm" onClick={() => setPayMonth(monthStart(addDays(payMonth, 32)))}>Next →</button>
                </div>
              </div>
            </div>
            <div className="card table-scroll">
              <table className="tbl">
                <thead><tr><th>Creator</th><th>Verified views</th><th>Prize</th><th>Next prize</th><th></th></tr></thead>
                <tbody>
                  {monthRows.map(({ c, m, paid }) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{num(m.views)}</td>
                      <td>{m.prize ? <b>{m.prize.label}</b> : <span className="muted">—</span>}</td>
                      <td className="muted">{m.next ? `${num(m.next.views - m.views)} views to ${m.next.label}` : 'Top prize'}</td>
                      <td>
                        {paid ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="pill paid">given {fmtDate(paid.paid_at)}</span>
                            <button className="btn btn-ghost sm" onClick={() => unmarkPaid(paid.id)}>Undo</button>
                          </div>
                        ) : m.prize ? (
                          <button className="btn btn-primary sm" disabled={paying === c.id + 'month'}
                            onClick={() => { if (confirm(`Mark "${m.prize!.label}" as given to ${c.name}?`)) markPaid({ creator_id: c.id, period: 'month', period_start: payMonth, amount: 0, label: m.prize!.label, details: { views: m.views } }) }}
                          >Mark given</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {monthRows.length === 0 && <tr><td className="empty" colSpan={5}>No verified views this month yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== CREATORS ===== */}
        {tab === 'creators' && (
          <div className="card table-scroll">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Cash App</th><th>TikTok</th><th>Instagram</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="muted">{c.email}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.cashapp || '—'}</td>
                    <td>{c.tiktok_handle || '—'}</td>
                    <td>{c.instagram_handle || '—'}</td>
                    <td className="muted">{fmtDate(c.created_at)}</td>
                    <td><button className="btn btn-ghost danger sm" onClick={() => deleteCreator(c)}>Delete</button></td>
                  </tr>
                ))}
                {creators.length === 0 && <tr><td className="empty" colSpan={8}>No creators yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== SUBMISSIONS (grouped by creator) ===== */}
        {tab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card pad row-between">
              <div className="muted">Type the real views from the video, then set it to Approved (or Rejected if it's down / off-brand).</div>
              <select value={subWeek} onChange={(e) => setSubWeek(e.target.value)} className="input">
                <option value="all">All weeks</option>
                {weekOptions.map((w) => <option key={w} value={w}>Week of {weekLabel(w)}</option>)}
              </select>
            </div>
            {subGroups.map((g) => {
              const open = !!openSubs[g.cid]
              return (
                <div key={g.cid} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* creator summary row */}
                  <button
                    onClick={() => setOpenSubs((p) => ({ ...p, [g.cid]: !p[g.cid] }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
                  >
                    <span style={{ transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-flex', color: 'var(--accent)' }}><Icon d={Ico.chev} size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{g.c?.name || 'Unknown creator'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{g.c?.email || g.cid.slice(0, 8)}</div>
                    </div>
                    <span className="pill approved" style={{ flexShrink: 0 }}>+{g.count} {g.count === 1 ? 'entry' : 'entries'}</span>
                    <div className="sub-stats">
                      <div><div className="ss-val">{num(g.totalClaimed)}</div><div className="ss-lab">Claimed views</div></div>
                      <div><div className="ss-val">{g.distinctDays}</div><div className="ss-lab">Days posted</div></div>
                      <div><div className="ss-val">{g.daysSinceFirst}</div><div className="ss-lab">Days in</div></div>
                    </div>
                  </button>

                  {/* expanded entries */}
                  {open && (
                    <div className="table-scroll" style={{ borderTop: '1px solid var(--line)' }}>
                      <table className="tbl">
                        <thead><tr>
                          <th>Video</th><th>Platform</th><th>Posted</th><th>Submitted</th><th>Claimed</th><th>Views (verified)</th><th>Status</th><th></th>
                        </tr></thead>
                        <tbody>
                          {g.entries.map((s) => (
                            <tr key={s.id}>
                              <td style={{ maxWidth: 200 }}>
                                <a href={toUrl(s.video_url)} target="_blank" rel="noreferrer" className="link ellipsis">{s.video_url}</a>
                              </td>
                              <td className="muted" style={{ textTransform: 'capitalize' }}>{s.platform}</td>
                              <td className="muted">{s.posted_at ? fmtDate(s.posted_at) : '—'}</td>
                              <td className="muted">{fmtDate(s.created_at)}</td>
                              <td className="muted">{num(s.claimed_views || 0)}</td>
                              <td><input type="text" inputMode="decimal" defaultValue={s.views ? String(s.views) : ''} placeholder="e.g. 1.2m" disabled={s.status === 'paid'} className="input sm" onBlur={(e) => { const v = parseV(e.target.value); if (v !== s.views) update(s.id, { views: v }) }} /></td>
                              <td>
                                {s.status === 'paid'
                                  ? <span className="pill paid">paid</span>
                                  : <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })} className={`input statussel ${s.status}`} style={{ textTransform: 'capitalize' }}>
                                      {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>}
                              </td>
                              <td><button className="btn btn-ghost danger sm" onClick={() => deleteSubmission(s)} title="Delete this submission">Delete</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            {subGroups.length === 0 && <div className="card"><div className="empty">No submissions {subWeek === 'all' ? 'yet' : 'this week'}.</div></div>}
          </div>
        )}

        {/* ===== REQUESTS ===== */}
        {tab === 'requests' && (
          <div className="card table-scroll">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>TikTok</th><th>Instagram</th><th>Pitch</th><th>Status</th><th>Requested</th><th></th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="muted">{r.email}</td>
                    <td>{r.tiktok_handle || '—'}</td>
                    <td>{r.instagram_handle || '—'}</td>
                    <td className="muted" style={{ maxWidth: 240 }}><span className="ellipsis" title={r.note || ''}>{r.note || '—'}</span></td>
                    <td>
                      <span className={`pill ${r.status === 'approved' ? 'paid' : r.status === 'declined' ? 'rejected' : 'pending'}`}>{r.status}</span>
                      {r.status === 'approved' && r.invite_code && (
                        <button className="codechip" onClick={() => copy(r.invite_code!)} title="Copy code">{copied === r.invite_code ? 'Copied!' : r.invite_code}</button>
                      )}
                    </td>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary sm" onClick={() => approveReq(r.id)}>Approve</button>
                          <button className="btn btn-ghost danger sm" onClick={() => declineReq(r.id)}>Decline</button>
                        </div>
                      ) : <span className="muted" style={{ fontSize: 13 }}>—</span>}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && <tr><td className="empty" colSpan={8}>No signup requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== INVITES ===== */}
        {tab === 'invites' && (
          <>
            <div className="card pad" style={{ marginBottom: 16 }}>
              <div className="row-between">
                <div>
                  <div className="card-h">One-time invite codes</div>
                  <div className="muted" style={{ marginTop: 4 }}>Generate a code and send it to one creator. Each works once.</div>
                </div>
                <button className="btn btn-primary" onClick={genInvite}><Icon d={Ico.ticket} size={16} />Generate code</button>
              </div>
            </div>
            <div className="card table-scroll">
              <table className="tbl">
                <thead><tr><th>Code</th><th>For</th><th>Status</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td><span className="codemono">{i.code}</span></td>
                      <td className="muted">{i.note || '—'}</td>
                      <td>{i.used ? <span className="pill approved">used{i.used_email ? ` · ${i.used_email}` : ''}</span> : <span className="pill paid">available</span>}</td>
                      <td className="muted">{fmtDate(i.created_at)}</td>
                      <td>
                        {!i.used ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost sm" onClick={() => copy(i.code)}><Icon d={Ico.copy} size={14} />{copied === i.code ? 'Copied!' : 'Copy'}</button>
                            <button className="btn btn-ghost danger sm" onClick={() => delInvite(i.id)}>Delete</button>
                          </div>
                        ) : <span className="muted" style={{ fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                  {invites.length === 0 && <tr><td className="empty" colSpan={5}>No codes yet. Generate one above.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const CSS = `
.rules-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin-top:18px}
.rule-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);font-size:14px}
.rule-row span{color:var(--dim)}
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

/* invite codes */
.codemono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;letter-spacing:.04em;
  background:var(--accent-soft);color:var(--accent);padding:5px 11px;border-radius:9px;font-size:14px;white-space:nowrap}
.codechip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:12px;margin-left:8px;
  background:var(--accent-soft);color:var(--accent);padding:3px 9px;border-radius:8px;border:none;cursor:pointer}
.codechip:hover{filter:brightness(1.1)}

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
.sub-stats{display:flex;gap:26px;flex-shrink:0;padding-left:8px}
.sub-stats > div{text-align:right;min-width:74px}
.ss-val{font-family:'Fredoka',sans-serif;font-size:20px;font-weight:700;line-height:1;color:var(--accent)}
.ss-lab{font-size:11px;color:var(--dim);margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}

@media (max-width:760px){ .feature-grid{grid-template-columns:1fr} .hero-ico{display:none} .hero-h{font-size:30px} .sub-stats{gap:14px} .sub-stats > div{min-width:0} .ss-lab{display:none} }

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

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { sendEmail, SITE_URL } from '@/lib/email'

// Server-only. Service key never reaches the browser; it bypasses RLS for admin edits.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

// ---- "remember me" session cookie (httpOnly, 7 days) ----
// Signed with the admin password + service key, so changing the password logs everyone out.
const COOKIE = 'mr_admin'
const SESSION_DAYS = 7
const sign = (exp: string) =>
  createHmac('sha256', `${(ADMIN_PASSWORD || '').trim()}|${serviceKey}`).update(`admin|${exp}`).digest('hex')
const makeSession = () => {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000)
  return `${exp}.${sign(exp)}`
}
const hasValidSession = (req: Request) => {
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))
  if (!raw) return false
  const [exp, sig] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const want = Buffer.from(sign(exp)), got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
const sessionCookie = (value: string, maxAge: number) =>
  `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`

// Generate a friendly one-time code like MAD-7K2P-9QX4
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing 0/O/1/I
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `MAD-${block()}-${block()}`
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Trim stray spaces/newlines pasted into Vercel; username isn't case-sensitive.
  const wantUser = (ADMIN_USERNAME || '').trim().toLowerCase()
  const wantPass = (ADMIN_PASSWORD || '').trim()
  if (!wantUser || !wantPass) {
    return NextResponse.json({ error: `Admin login isn't set up: add ${!wantUser ? 'ADMIN_USERNAME' : 'ADMIN_PASSWORD'} in Vercel, then redeploy.` }, { status: 500 })
  }

  if (body.action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', sessionCookie('', 0))
    return res
  }

  // Log in with username + password -> get a 7-day session cookie.
  if (body.action === 'login') {
    if (String(body.username || '').trim().toLowerCase() !== wantUser || String(body.password || '').trim() !== wantPass) {
      return NextResponse.json({ error: 'Wrong username or password' }, { status: 401 })
    }
    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', sessionCookie(makeSession(), SESSION_DAYS * 86_400))
    return res
  }

  // Every other action needs a valid session.
  if (!hasValidSession(req)) {
    return NextResponse.json({ error: 'Session expired. Please log in again.', loggedOut: true }, { status: 401 })
  }

  // ---- list everything ----
  if (body.action === 'list') {
    const [creators, submissions, campaigns, invites, requests, payouts] = await Promise.all([
      admin.from('creators').select('*').order('created_at', { ascending: false }),
      admin.from('video_submissions').select('*').order('created_at', { ascending: false }),
      admin.from('campaigns').select('*').order('created_at', { ascending: false }),
      admin.from('invite_codes').select('*').order('created_at', { ascending: false }),
      admin.from('signup_requests').select('*').order('created_at', { ascending: false }),
      admin.from('payouts').select('*').order('paid_at', { ascending: false }),
    ])
    const err = creators.error || submissions.error || campaigns.error || invites.error || requests.error || payouts.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({
      creators: creators.data,
      submissions: submissions.data,
      campaigns: campaigns.data,
      invites: invites.data,
      requests: requests.data,
      payouts: payouts.data,
    })
  }

  // ---- update one submission (verified views / status) ----
  if (body.action === 'update') {
    const { id, patch } = body
    if (!id || !patch) return NextResponse.json({ error: 'Missing id/patch' }, { status: 400 })
    const allowed: Record<string, unknown> = {}
    for (const k of ['views', 'status']) {
      if (k in patch) allowed[k] = patch[k]
    }
    const { data, error } = await admin
      .from('video_submissions')
      .update(allowed)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submission: data })
  }

  // ---- mark a creator's week (or monthly prize) as paid ----
  // Records the payout and flips that week's approved videos to "paid".
  if (body.action === 'mark_paid') {
    const { creator_id, period, period_start, amount, label, details } = body
    if (!creator_id || !['week', 'month'].includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(period_start || '')) {
      return NextResponse.json({ error: 'Missing creator/period' }, { status: 400 })
    }
    const ins = await admin.from('payouts').insert({
      creator_id, period, period_start,
      amount: Number(amount) || 0, label: label || null, details: details || null,
    }).select().maybeSingle()
    if (ins.error) {
      const msg = ins.error.code === '23505' ? 'Already marked paid.' : ins.error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (period === 'week') {
      const end = new Date(Date.parse(period_start + 'T00:00:00Z') + 6 * 86400000).toISOString().slice(0, 10)
      const upd = await admin.from('video_submissions')
        .update({ status: 'paid', paid: true })
        .eq('creator_id', creator_id).eq('status', 'approved')
        .gte('posted_at', period_start).lte('posted_at', end + 'T23:59:59')
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }
    return NextResponse.json({ payout: ins.data })
  }

  // ---- undo a payout (mistakes happen) ----
  if (body.action === 'unmark_paid') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const row = await admin.from('payouts').select('*').eq('id', body.id).maybeSingle()
    if (row.error || !row.data) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    const p = row.data
    if (p.period === 'week') {
      const end = new Date(Date.parse(p.period_start + 'T00:00:00Z') + 6 * 86400000).toISOString().slice(0, 10)
      await admin.from('video_submissions')
        .update({ status: 'approved', paid: false })
        .eq('creator_id', p.creator_id).eq('status', 'paid')
        .gte('posted_at', p.period_start).lte('posted_at', end + 'T23:59:59')
    }
    const { error } = await admin.from('payouts').delete().eq('id', p.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ---- delete creators (one or many): their videos, payouts, profile, and login ----
  if (body.action === 'creator_delete') {
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []
    if (!ids.length) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    for (const t of ['payouts', 'video_submissions']) {
      const r = await admin.from(t).delete().in('creator_id', ids)
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    }
    const c = await admin.from('creators').delete().in('id', ids)
    if (c.error) return NextResponse.json({ error: c.error.message }, { status: 500 })
    for (const id of ids) {
      const u = await admin.auth.admin.deleteUser(id)
      if (u.error && !/not found/i.test(u.error.message)) return NextResponse.json({ error: u.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deleted: ids.length })
  }

  // ---- delete one video submission ----
  if (body.action === 'submission_delete') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await admin.from('video_submissions').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ---- create / update a campaign ----
  if (body.action === 'campaign_save') {
    const c = body.campaign
    if (!c || !c.title) return NextResponse.json({ error: 'Missing campaign title' }, { status: 400 })

    if (c.active) {
      await admin.from('campaigns').update({ active: false })
        .neq('id', c.id || '00000000-0000-0000-0000-000000000000')
    }

    const row = {
      title: c.title,
      active: !!c.active,
      cadence: c.cadence || 'weekly',
      starts_at: c.starts_at || new Date().toISOString(),
      tiers: Array.isArray(c.tiers) ? c.tiers : [],
      examples: Array.isArray(c.examples) ? c.examples : [],
    }

    const result = c.id
      ? await admin.from('campaigns').update(row).eq('id', c.id).select().maybeSingle()
      : await admin.from('campaigns').insert(row).select().maybeSingle()

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json({ campaign: result.data })
  }

  // ---- delete a campaign ----
  if (body.action === 'campaign_delete') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await admin.from('campaigns').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ---- generate a new one-time invite code ----
  if (body.action === 'invite_create') {
    let code = makeCode()
    // extremely unlikely collision; retry a couple times just in case
    for (let i = 0; i < 3; i++) {
      const existing = await admin.from('invite_codes').select('id').eq('code', code).maybeSingle()
      if (!existing.data) break
      code = makeCode()
    }
    const { data, error } = await admin
      .from('invite_codes')
      .insert({ code, note: body.note || null })
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data })
  }

  // ---- delete an invite code (only if unused) ----
  if (body.action === 'invite_delete') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await admin.from('invite_codes').delete().eq('id', body.id).eq('used', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ---- approve a signup request -> generate a code, attach it, return it ----
  if (body.action === 'request_approve') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const reqRow = await admin.from('signup_requests').select('*').eq('id', body.id).maybeSingle()
    if (reqRow.error || !reqRow.data) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    let code = makeCode()
    for (let i = 0; i < 3; i++) {
      const existing = await admin.from('invite_codes').select('id').eq('code', code).maybeSingle()
      if (!existing.data) break
      code = makeCode()
    }
    const inv = await admin.from('invite_codes')
      .insert({ code, note: `${reqRow.data.name} (${reqRow.data.email})` })
      .select().maybeSingle()
    if (inv.error) return NextResponse.json({ error: inv.error.message }, { status: 500 })

    await admin.from('signup_requests')
      .update({ status: 'approved', invite_code: code })
      .eq('id', body.id)

    // Email them a link that opens sign-up with the code filled in.
    const link = `${SITE_URL}/?invite=${encodeURIComponent(code)}`
    const first = String(reqRow.data.name || '').trim().split(/\s+/)[0] || 'there'
    const emailed = reqRow.data.email
      ? await sendEmail(
          reqRow.data.email,
          "You're invited to Mad Rewards",
          `<p>Hi ${first.replace(/[<>&]/g, '')},</p>
           <p>Your request was approved. Use the link below to create your account:</p>
           <p><a href="${link}">${link}</a></p>
           <p>Your one-time invite code is <b>${code}</b>. Please don't share it.</p>
           <p>Mad Rewards</p>`,
        )
      : false

    return NextResponse.json({ ok: true, code, emailed, email: reqRow.data.email })
  }

  // ---- decline a signup request ----
  if (body.action === 'request_decline') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await admin.from('signup_requests').update({ status: 'declined' }).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

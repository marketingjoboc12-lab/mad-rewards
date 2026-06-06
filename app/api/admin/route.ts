import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Server-only. Service key never reaches the browser; it bypasses RLS for admin edits.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

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

  if (!ADMIN_PASSWORD || body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  // ---- list everything ----
  if (body.action === 'list') {
    const [creators, submissions, campaigns, invites, requests] = await Promise.all([
      admin.from('creators').select('*').order('created_at', { ascending: false }),
      admin.from('video_submissions').select('*').order('created_at', { ascending: false }),
      admin.from('campaigns').select('*').order('created_at', { ascending: false }),
      admin.from('invite_codes').select('*').order('created_at', { ascending: false }),
      admin.from('signup_requests').select('*').order('created_at', { ascending: false }),
    ])
    const err = creators.error || submissions.error || campaigns.error || invites.error || requests.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({
      creators: creators.data,
      submissions: submissions.data,
      campaigns: campaigns.data,
      invites: invites.data,
      requests: requests.data,
    })
  }

  // ---- update one submission (views/status/reward/paid) ----
  if (body.action === 'update') {
    const { id, patch } = body
    if (!id || !patch) return NextResponse.json({ error: 'Missing id/patch' }, { status: 400 })
    const allowed: Record<string, unknown> = {}
    for (const k of ['views', 'status', 'reward_amount', 'paid']) {
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

    return NextResponse.json({ ok: true, code })
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

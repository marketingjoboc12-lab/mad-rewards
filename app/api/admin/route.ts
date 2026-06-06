import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Server-only. Service key never reaches the browser; it bypasses RLS for admin edits.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

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
    const [creators, submissions, campaigns] = await Promise.all([
      admin.from('creators').select('*').order('created_at', { ascending: false }),
      admin.from('video_submissions').select('*').order('created_at', { ascending: false }),
      admin.from('campaigns').select('*').order('created_at', { ascending: false }),
    ])
    const err = creators.error || submissions.error || campaigns.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({
      creators: creators.data,
      submissions: submissions.data,
      campaigns: campaigns.data,
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
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submission: data })
  }

  // ---- create / update a campaign ----
  if (body.action === 'campaign_save') {
    const c = body.campaign
    if (!c || !c.title) return NextResponse.json({ error: 'Missing campaign title' }, { status: 400 })

    // Only one active campaign at a time: deactivate the others first.
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
      ? await admin.from('campaigns').update(row).eq('id', c.id).select().single()
      : await admin.from('campaigns').insert(row).select().single()

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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

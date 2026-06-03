import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This file runs ONLY on the server. The service key never reaches the
// browser, so it can safely bypass row-level security to do admin edits.
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

  // Password check on every call.
  if (!ADMIN_PASSWORD || body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  // List all creators + submissions.
  if (body.action === 'list') {
    const [creators, submissions] = await Promise.all([
      admin.from('creators').select('*').order('created_at', { ascending: false }),
      admin.from('video_submissions').select('*').order('created_at', { ascending: false }),
    ])
    const err = creators.error || submissions.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ creators: creators.data, submissions: submissions.data })
  }

  // Update one submission. Only these four fields are allowed.
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

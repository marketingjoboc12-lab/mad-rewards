import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public endpoint (no admin password). Gated by a valid one-time invite code.
// Uses the service key to read invite_codes (which are not public-readable),
// create the auth account, and write the creator row.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const clean = (s: string) => (s || '').trim()

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const code = clean(body.code).toUpperCase()

  // ---- check a code is valid + unused ----
  if (body.action === 'check') {
    if (!code) return NextResponse.json({ valid: false, error: 'Enter a code.' }, { status: 400 })
    const { data, error } = await admin.from('invite_codes').select('id, used').eq('code', code).maybeSingle()
    if (error) return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ valid: false, error: 'That code does not exist.' }, { status: 404 })
    if (data.used) return NextResponse.json({ valid: false, error: 'That code has already been used.' }, { status: 409 })
    return NextResponse.json({ valid: true })
  }

  // ---- redeem: create the account and consume the code ----
  if (body.action === 'redeem') {
    const email = clean(body.email).toLowerCase()
    const password = body.password || ''
    const name = clean(body.name)
    if (!code || !email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    // 1. code must exist and be unused
    const inv = await admin.from('invite_codes').select('id, used').eq('code', code).maybeSingle()
    if (inv.error) return NextResponse.json({ error: inv.error.message }, { status: 500 })
    if (!inv.data) return NextResponse.json({ error: 'That code does not exist.' }, { status: 404 })
    if (inv.data.used) return NextResponse.json({ error: 'That code has already been used.' }, { status: 409 })

    // 2. create the auth user (confirmed so they can log in immediately)
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (created.error) {
      const msg = /already/i.test(created.error.message) ? 'That email already has an account. Try logging in.' : created.error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const uid = created.data.user?.id
    if (!uid) return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })

    // 3. creator profile row, keyed to the auth user id
    const crow = await admin.from('creators').insert({
      id: uid,
      name,
      email,
      tiktok_handle: clean(body.tiktok) || null,
      instagram_handle: clean(body.instagram) || null,
    }).select().maybeSingle()
    if (crow.error) {
      // roll back the auth user so they can retry cleanly
      await admin.auth.admin.deleteUser(uid).catch(() => {})
      const msg = crow.error.code === '23505' ? 'That email is already registered.' : crow.error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // 4. burn the code
    await admin.from('invite_codes')
      .update({ used: true, used_email: email, used_at: new Date().toISOString() })
      .eq('id', inv.data.id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

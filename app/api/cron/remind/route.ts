import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { todayLocal, weekStart, addDays, weekLabel } from '@/lib/rewards'

// Sunday reminder. Vercel Cron calls this every Sunday morning (see vercel.json).
// Emails every creator who hasn't submitted any video for the week that just
// ended, telling them they have until tonight 11:59pm (grace day).
//
// Needs env vars: CRON_SECRET, RESEND_API_KEY, REMINDER_FROM
// Test without sending:  /api/cron/remind?dry=1   (with the same Bearer secret)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = new URL(req.url).searchParams.get('dry') === '1'

  const week = addDays(weekStart(todayLocal()), -7) // on Sunday: the week that ended yesterday
  const end = addDays(week, 6)

  const [creators, subs] = await Promise.all([
    admin.from('creators').select('id, name, email'),
    admin.from('video_submissions').select('creator_id').gte('posted_at', week).lte('posted_at', end + 'T23:59:59'),
  ])
  if (creators.error || subs.error) {
    return NextResponse.json({ error: (creators.error || subs.error)!.message }, { status: 500 })
  }

  const submitted = new Set((subs.data || []).map((s) => s.creator_id))
  const missing = (creators.data || []).filter((c) => c.email && !submitted.has(c.id))

  if (dry) return NextResponse.json({ week: weekLabel(week), wouldEmail: missing.map((c) => c.email) })

  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM) {
    return NextResponse.json({ error: 'RESEND_API_KEY / REMINDER_FROM not set' }, { status: 500 })
  }

  const results = await Promise.all(missing.map(async (c) => {
    const first = (c.name || '').split(' ')[0] || 'hey'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM,
        to: c.email,
        subject: '⏰ Last call — submit your Mad Labs videos tonight',
        html: `
          <p>Yo ${first} 👋</p>
          <p>We didn't get any videos from you for <b>${weekLabel(week)}</b>.</p>
          <p>You've got until <b>tonight at 11:59pm</b> to drop your links + views — after that this week's rewards are locked. 🔒</p>
          <p><a href="https://madrewards.xyz">Submit now → madrewards.xyz</a></p>
          <p>— Mad Rewards</p>`,
      }),
    })
    return { email: c.email, ok: res.ok }
  }))

  return NextResponse.json({ week: weekLabel(week), sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) })
}

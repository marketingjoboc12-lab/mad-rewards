import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { todayLocal, weekStart, addDays, weekLabel } from '@/lib/rewards'
import { sendEmail, emailConfigured, SITE_URL } from '@/lib/email'

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

  if (!emailConfigured()) {
    return NextResponse.json({ error: 'RESEND_API_KEY / REMINDER_FROM not set' }, { status: 500 })
  }

  const results = await Promise.all(missing.map(async (c) => {
    const first = (c.name || '').split(' ')[0] || 'there'
    const ok = await sendEmail(
      c.email,
      'Last call: submit your Mad Labs videos tonight',
      `<p>Hi ${first.replace(/[<>&]/g, '')},</p>
       <p>We didn't get any videos from you for <b>${weekLabel(week)}</b>.</p>
       <p>You have until <b>tonight at 11:59pm</b> to submit your links and views. After that, this week's rewards are locked.</p>
       <p><a href="${SITE_URL}/#drop">Submit now</a></p>
       <p>Mad Rewards</p>`,
    )
    return { email: c.email, ok }
  }))

  return NextResponse.json({ week: weekLabel(week), sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) })
}

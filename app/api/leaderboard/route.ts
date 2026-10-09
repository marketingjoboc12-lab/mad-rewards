import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { todayLocal, weekStart, addDays, countedViews } from '@/lib/rewards'

// This week's leaderboard for logged-in creators.
// Creators can't read each other's rows (RLS), so this runs server-side and
// only returns first name, TikTok handle and the week's view count.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  const me = await admin.auth.getUser(token)
  if (me.error || !me.data.user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const start = weekStart(todayLocal())
  const end = addDays(start, 6)
  const [creators, subs] = await Promise.all([
    admin.from('creators').select('id, name, tiktok_handle'),
    admin.from('video_submissions').select('creator_id, status, views, claimed_views, posted_at')
      .gte('posted_at', start).lte('posted_at', end + 'T23:59:59'),
  ])
  if (creators.error || subs.error) {
    return NextResponse.json({ error: (creators.error || subs.error)!.message }, { status: 500 })
  }

  // Same estimate creators see on their own dashboard: verified views, or
  // their own number while a video is still pending review.
  const views = new Map<string, number>()
  for (const s of subs.data || []) {
    const v = countedViews({ posted: '', status: s.status, views: s.views, claimedViews: s.claimed_views || 0 }, true)
    views.set(s.creator_id, (views.get(s.creator_id) || 0) + v)
  }

  const rows = (creators.data || [])
    .map((c) => ({
      id: c.id,
      name: (c.name || 'Creator').trim().split(/\s+/)[0],
      handle: c.tiktok_handle || null,
      views: views.get(c.id) || 0,
    }))
    .sort((a, b) => b.views - a.views)
    .map((r, i) => ({ rank: i + 1, name: r.name, handle: r.handle, views: r.views, me: r.id === me.data.user!.id }))

  return NextResponse.json({ week: start, rows })
}

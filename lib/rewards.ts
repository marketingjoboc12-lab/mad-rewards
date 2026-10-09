// ============================================================
//  MAD REWARDS — the reward rules, in one place.
//
//  Both the creator dashboard and the admin page read from this
//  file, so changing a number here changes it everywhere.
//
//  Week = Sunday → Saturday. A video counts toward the week (and
//  month) of the date it was POSTED, not the date it was submitted.
//  Deadline: Saturday 11:59pm. Reminder email goes out Sunday
//  morning; Sunday is a grace day. Employee verifies Monday.
// ============================================================

export type ViewTier = { views: number; amount: number; label: string }
export type PostingBonus = { videos: number; days: number; amount: number; label: string }
export type MonthlyPrize = { views: number; label: string }

// Weekly view rewards — creator gets the HIGHEST tier hit (not all of them).
export const VIEW_TIERS: ViewTier[] = [
  { views: 25_000, amount: 25, label: '$25' },
  { views: 50_000, amount: 50, label: '$50' },
  { views: 100_000, amount: 100, label: '$100' },
  { views: 250_000, amount: 200, label: '$200' },
  { views: 500_000, amount: 350, label: '$350' },
  { views: 1_000_000, amount: 600, label: '$600' },
]

// Weekly posting bonus — stacks on top of the view reward. Highest one only.
// `days` = number of DIFFERENT days the videos were posted on that week.
export const POSTING_BONUSES: PostingBonus[] = [
  { videos: 5, days: 5, amount: 25, label: '$25 or product re-up' },
  { videos: 10, days: 7, amount: 50, label: '$50 + product re-up' },
]

// Flat weekly bonus when their profile pic is the Mad Labs logo.
// Employee ticks a box on Monday when checking; stacks on everything else.
export const LOGO_PFP_BONUS = 10

// Monthly prizes (calendar month) — highest one only. Paid/handled by hand.
export const MONTHLY_PRIZES: MonthlyPrize[] = [
  { views: 3_000_000, label: 'New iPhone' },
  { views: 10_000_000, label: 'Trip for 2' },
]

// All dates are judged in this time zone (the deadline is 11:59pm here).
export const TIMEZONE = 'America/Los_Angeles'

// ───────────── date helpers (all work on 'YYYY-MM-DD' strings) ─────────────

const DAY = 86_400_000
const toUTC = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z')
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10)

export const addDays = (d: string, n: number) => fromUTC(toUTC(d) + n * DAY)

// Today's date in TIMEZONE, as 'YYYY-MM-DD'.
export const todayLocal = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

// Sunday that starts the week containing `d`.
export const weekStart = (d: string) => addDays(d, -new Date(toUTC(d)).getUTCDay())
export const weekEnd = (d: string) => addDays(weekStart(d), 6)
export const monthStart = (d: string) => d.slice(0, 7) + '-01'

// Which weeks a creator may still submit videos for, given today.
// Always the current week; last week too if today is Sunday (grace day).
export const earliestSubmittableDate = (today: string = todayLocal()) => {
  const thisWeek = weekStart(today)
  return today === thisWeek ? addDays(thisWeek, -7) : thisWeek
}

// The most recent week that has fully closed (deadline + grace passed).
export const lastClosedWeek = (today: string = todayLocal()) => addDays(weekStart(today), -7)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`
export const weekLabel = (start: string) => `${short(start)} – ${short(addDays(start, 6))}`
export const monthLabel = (start: string) => `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`

// ───────────── reward math ─────────────

export type SubLike = {
  posted: string        // 'YYYY-MM-DD'
  status: string        // pending | approved | rejected | paid
  views: number         // verified views (set by employee)
  claimedViews: number  // what the creator typed in
}

// Views that count: verified views for approved/paid videos. When
// `estimate` is on, pending videos count with the creator's own number.
export const countedViews = (s: SubLike, estimate: boolean) => {
  if (s.status === 'approved' || s.status === 'paid') return Number(s.views) || 0
  if (estimate && s.status === 'pending') return Number(s.claimedViews) || 0
  return 0
}

const counts = (s: SubLike, estimate: boolean) =>
  s.status === 'approved' || s.status === 'paid' || (estimate && s.status === 'pending')

export const viewTierFor = (views: number) =>
  [...VIEW_TIERS].reverse().find((t) => views >= t.views) || null

export const bonusFor = (videos: number, days: number) =>
  [...POSTING_BONUSES].reverse().find((b) => videos >= b.videos && days >= b.days) || null

export const prizeFor = (views: number) =>
  [...MONTHLY_PRIZES].reverse().find((p) => views >= p.views) || null

export type WeekResult = {
  start: string
  views: number
  videos: number
  days: number
  pending: number
  viewTier: ViewTier | null
  bonus: PostingBonus | null
  total: number
}

// Everything for one creator's week. `subs` can be all their submissions.
export const computeWeek = (subs: SubLike[], start: string, estimate = false): WeekResult => {
  const end = addDays(start, 6)
  const inWeek = subs.filter((s) => s.posted >= start && s.posted <= end)
  const counted = inWeek.filter((s) => counts(s, estimate))
  const views = counted.reduce((a, s) => a + countedViews(s, estimate), 0)
  const days = new Set(counted.map((s) => s.posted)).size
  const viewTier = viewTierFor(views)
  const bonus = bonusFor(counted.length, days)
  return {
    start, views, videos: counted.length, days,
    pending: inWeek.filter((s) => s.status === 'pending').length,
    viewTier, bonus,
    total: (viewTier?.amount || 0) + (bonus?.amount || 0),
  }
}

export type MonthResult = { start: string; views: number; prize: MonthlyPrize | null; next: MonthlyPrize | null }

export const computeMonth = (subs: SubLike[], start: string, estimate = false): MonthResult => {
  const views = subs
    .filter((s) => s.posted.slice(0, 7) === start.slice(0, 7))
    .reduce((a, s) => a + countedViews(s, estimate), 0)
  const prize = prizeFor(views)
  return { start, views, prize, next: MONTHLY_PRIZES.find((p) => p.views > views) || null }
}

// Strip tracking junk so the same video can't be submitted twice
// with a different ?query string or trailing slash.
export const normalizeVideoUrl = (raw: string) => {
  let u = (raw || '').trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    const p = new URL(u)
    return `https://${p.hostname.toLowerCase().replace(/^m\./, 'www.')}${p.pathname.replace(/\/+$/, '')}`
  } catch {
    return u
  }
}

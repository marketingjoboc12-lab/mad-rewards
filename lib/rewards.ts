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

export type Milestone = { views: number; label: string; emoji: string }
export type MonthlyPrize = { views: number; label: string; emoji: string }

// Weekly pay: flat $100 for every 100K views (views from all that week's videos add up).
export const PAY_PER_100K = 100

// Most anyone can earn from views in one week (logo bonus is on top).
export const WEEKLY_CAP = 1000

// Weekly levels, just for fun (no effect on pay).
export const LEVELS = [
  { at: 0, name: 'Warming up', emoji: '🌱' },
  { at: 100_000, name: 'Heating up', emoji: '🔥' },
  { at: 500_000, name: 'Going viral', emoji: '🚀' },
  { at: 1_000_000, name: 'Maxed out', emoji: '👑' },
]

// Creators must re-accept "How it works" if they accepted before this date.
export const RULES_UPDATED = '2026-10-09T00:00:00Z'

// Flat weekly bonus when their profile pic is the Mad Labs logo.
// Employee ticks a box on Monday when checking.
export const LOGO_PFP_BONUS = 10

// Free product re-up: this many videos within a 2-week period.
export const REUP_VIDEOS = 10
// 2-week periods start on this Sunday and repeat every 14 days.
export const REUP_ANCHOR = '2026-10-04'

// Free merch, unlocked once by TOTAL verified views since joining.
export const MILESTONES: Milestone[] = [
  { views: 100_000, label: 'Mad Labs socks', emoji: '🧦' },
  { views: 250_000, label: 'Mad Labs shirt', emoji: '👕' },
]

// Big monthly prizes (calendar month) — highest one only.
export const MONTHLY_PRIZES: MonthlyPrize[] = [
  { views: 3_000_000, label: 'iPhone 18 Pro Max', emoji: '📱' },
  { views: 10_000_000, label: 'Trip for 2 — New York or Mexico', emoji: '✈️' },
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

// Dollars earned for a week's views (before the cap).
export const rawPayForViews = (views: number) => Math.round((Math.max(0, views) / 100_000) * PAY_PER_100K * 100) / 100
export const payForViews = (views: number) => Math.min(WEEKLY_CAP, rawPayForViews(views))

// Views needed to reach the cap (1M).
export const CAP_VIEWS = (WEEKLY_CAP / PAY_PER_100K) * 100_000

// Index into LEVELS for a week's views.
export const levelFor = (views: number) => {
  let i = 0
  LEVELS.forEach((l, idx) => { if (views >= l.at) i = idx })
  return i
}

export const prizeFor = (views: number) =>
  [...MONTHLY_PRIZES].reverse().find((p) => views >= p.views) || null

// 2-week re-up period containing `d`.
export const reupPeriodStart = (d: string) => {
  const weeks = Math.floor((toUTC(weekStart(d)) - toUTC(REUP_ANCHOR)) / (7 * DAY))
  return addDays(REUP_ANCHOR, Math.floor(weeks / 2) * 14)
}

export type WeekResult = {
  start: string
  views: number
  videos: number
  days: number
  pending: number
  pay: number       // view pay after the cap
  capped: boolean
}

// One creator's week. `subs` can be all their submissions.
export const computeWeek = (subs: SubLike[], start: string, estimate = false): WeekResult => {
  const end = addDays(start, 6)
  const inWeek = subs.filter((s) => s.posted >= start && s.posted <= end)
  const counted = inWeek.filter((s) => counts(s, estimate))
  const views = counted.reduce((a, s) => a + countedViews(s, estimate), 0)
  return {
    start, views, videos: counted.length,
    days: new Set(counted.map((s) => s.posted)).size,
    pending: inWeek.filter((s) => s.status === 'pending').length,
    pay: payForViews(views),
    capped: rawPayForViews(views) > WEEKLY_CAP,
  }
}

// Re-up progress for the 2-week period containing `d`.
export const computeReup = (subs: SubLike[], d: string, estimate = false) => {
  const start = reupPeriodStart(d), end = addDays(start, 13)
  const videos = subs.filter((s) => s.posted >= start && s.posted <= end && counts(s, estimate)).length
  return { start, end, videos, earned: videos >= REUP_VIDEOS }
}

// Lifetime verified views and which merch milestones they've passed.
export const lifetimeViews = (subs: SubLike[], upTo?: string, estimate = false) =>
  subs.filter((s) => !upTo || s.posted <= upTo).reduce((a, s) => a + countedViews(s, estimate), 0)
export const milestonesReached = (views: number) => MILESTONES.filter((m) => views >= m.views)

export type MonthResult = { start: string; views: number; prize: MonthlyPrize | null; next: MonthlyPrize | null }

export const computeMonth = (subs: SubLike[], start: string, estimate = false): MonthResult => {
  const views = subs
    .filter((s) => s.posted.slice(0, 7) === start.slice(0, 7))
    .reduce((a, s) => a + countedViews(s, estimate), 0)
  return { start, views, prize: prizeFor(views), next: MONTHLY_PRIZES.find((p) => p.views > views) || null }
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

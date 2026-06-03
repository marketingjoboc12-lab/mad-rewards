import { createClient } from '@supabase/supabase-js'

// ============================================================
//  MAD REWARDS — Supabase client (hardened + self-diagnosing)
//
//  Why this file is more than three lines: the app was hitting
//  ERR_NAME_NOT_RESOLVED on a domain that IS reachable. That only
//  happens when the URL string actually used at runtime isn't the
//  clean one — usually a stray space / newline / zero-width char /
//  wrapping quote pasted into the Vercel env var. This sanitizes
//  the value, validates it, logs exactly what it resolved to, and
//  falls back to the known-good URL so the app keeps working while
//  you fix the env in Vercel.
// ============================================================

// Your confirmed-good project URL (the one that loads manually).
const KNOWN_GOOD_URL = 'https://cgzpmvinxysaezndhklk.supabase.co'

// Flip to true to bypass the env entirely and force the known URL.
// Decisive A/B test: if true fixes the fetch, your env var is the problem.
const FORCE_KNOWN_GOOD_URL = false

// Strip the junk that breaks hostnames: surrounding quotes, ALL
// whitespace (space/tab/newline/CR), zero-width chars, and the BOM.
function sanitize(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/^['"]+|['"]+$/g, '')        // wrapping quotes
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width + BOM
    .replace(/\s+/g, '')                   // any whitespace, incl. trailing newline
    .trim()
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const cleanUrl = sanitize(rawUrl)
const cleanKey = sanitize(rawKey)

// Validate the URL is a real https://*.supabase.co address.
function isValidSupabaseUrl(u: string): boolean {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

let finalUrl = cleanUrl
if (FORCE_KNOWN_GOOD_URL || !isValidSupabaseUrl(cleanUrl)) {
  finalUrl = KNOWN_GOOD_URL
}

// ── Diagnostics: visible in the live browser console on load ──
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[supabase] URL in use:', finalUrl)

  // Reveal hidden characters: if raw length != clean length, the env
  // value had junk (spaces/newlines/quotes) — fix it in Vercel.
  if (rawUrl && rawUrl.length !== cleanUrl.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[supabase] NEXT_PUBLIC_SUPABASE_URL contained hidden characters. ` +
      `raw length ${rawUrl.length}, cleaned length ${cleanUrl.length}. ` +
      `Re-enter it in Vercel with no surrounding quotes or trailing whitespace, then redeploy.`
    )
  }
  if (cleanUrl && cleanUrl !== KNOWN_GOOD_URL && isValidSupabaseUrl(cleanUrl)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[supabase] env URL (${cleanUrl}) differs from the known-good URL (${KNOWN_GOOD_URL}). ` +
      `If fetches fail, the env points at the wrong/old project.`
    )
  }
  if (!isValidSupabaseUrl(cleanUrl)) {
    // eslint-disable-next-line no-console
    console.error(
      `[supabase] NEXT_PUBLIC_SUPABASE_URL is missing or invalid ("${rawUrl}"). ` +
      `Falling back to ${KNOWN_GOOD_URL}. Fix the Vercel env var and redeploy.`
    )
  }
  if (!cleanKey) {
    // eslint-disable-next-line no-console
    console.error('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty.')
  }
}

// Exported so the app can log/display the exact URL it's talking to.
export const SUPABASE_URL_IN_USE = finalUrl

export const supabase = createClient(finalUrl, cleanKey)

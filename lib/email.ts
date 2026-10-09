// Sends one email through Resend. Returns false (instead of throwing) when
// email isn't set up yet, so callers can fall back to a manual step.
// Needs env vars RESEND_API_KEY and REMINDER_FROM (e.g. "Mad Rewards <rewards@madrewards.xyz>").
export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.REMINDER_FROM)

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailConfigured()) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.REMINDER_FROM, to, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://madrewards.xyz').replace(/\/+$/, '')

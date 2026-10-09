// Sends one text message through Twilio. Returns false (instead of throwing)
// when texting isn't set up, so callers can carry on with email only.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
// TWILIO_MESSAGING_SERVICE_SID (preferred) or TWILIO_FROM (e.g. +15551234567).
export const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
     (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM))

// "(941) 234-1244" -> "+19412341244" (US numbers only)
export const toE164 = (raw: string | null | undefined) => {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.length === 10 ? `+1${d}` : null
}

export async function sendSms(phone: string | null | undefined, body: string): Promise<boolean> {
  const to = toE164(phone)
  if (!smsConfigured() || !to) return false
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const form = new URLSearchParams({ To: to, Body: body })
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID)
  else form.set('From', process.env.TWILIO_FROM!)
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    })
    return res.ok
  } catch {
    return false
  }
}

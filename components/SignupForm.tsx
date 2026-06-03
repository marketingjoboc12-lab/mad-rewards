'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Status = 'idle' | 'saving' | 'success' | 'error'

export default function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [instagram, setInstagram] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!name.trim() || !email.trim()) {
      setStatus('error')
      setMessage('Name and email are required.')
      return
    }

    setStatus('saving')

    // status / created_at default in the DB. We only send what the creator typed.
    const { error } = await supabase.from('creators').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      tiktok_handle: tiktok.trim() || null,
      instagram_handle: instagram.trim() || null,
    })

    if (error) {
      // 23505 = Postgres unique_violation. Requires a UNIQUE constraint on
      // creators.email (see supabase-setup.sql) for this check to fire.
      if (error.code === '23505') {
        setStatus('error')
        setMessage('An account with that email already exists.')
      } else {
        setStatus('error')
        setMessage(error.message || 'Something went wrong. Try again.')
      }
      return
    }

    setStatus('success')
    setMessage("You're in. We'll review your profile shortly.")
    setName(''); setEmail(''); setTiktok(''); setInstagram('')
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Full name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maya Okafor"
          className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">TikTok handle</label>
          <input
            type="text"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="@you"
            className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Instagram handle</label>
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@you"
            className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === 'saving' ? 'Submitting…' : 'Join Mad Rewards'}
      </button>

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </form>
  )
}

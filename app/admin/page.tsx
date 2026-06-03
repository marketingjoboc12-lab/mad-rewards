'use client'

// ⚠️ NO ACCESS CONTROL. As written, anyone who finds /admin can read every
// creator and edit every submission, because it runs on the public anon key.
// Before this is reachable in production, gate it (see GO_LIVE notes / the
// "Securing admin" section). This file is the functional dashboard only.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Creator, VideoSubmission } from '@/lib/types'

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'paid']

export default function AdminDashboard() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const [c, v] = await Promise.all([
      supabase.from('creators').select('*').order('created_at', { ascending: false }),
      supabase.from('video_submissions').select('*').order('created_at', { ascending: false }),
    ])
    if (c.error || v.error) setError(c.error?.message || v.error?.message || 'Load failed.')
    setCreators((c.data as Creator[]) ?? [])
    setSubmissions((v.data as VideoSubmission[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Optimistic update, then persist. Reverts via reload on error.
  const updateSubmission = async (id: string, patch: Partial<VideoSubmission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    const { error } = await supabase.from('video_submissions').update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const emailFor = (creatorId: string) =>
    creators.find((c) => c.id === creatorId)?.email ?? '—'

  if (loading) return <div className="p-8 text-sm text-neutral-500">Loading…</div>

  return (
    <div className="mx-auto max-w-6xl space-y-12 p-6 md:p-10">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* CREATORS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Creators ({creators.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">TikTok</th>
                <th className="p-3">Instagram</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {creators.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-neutral-600">{c.email}</td>
                  <td className="p-3 text-neutral-600">{c.tiktok_handle ?? '—'}</td>
                  <td className="p-3 text-neutral-600">{c.instagram_handle ?? '—'}</td>
                  <td className="p-3 capitalize">{c.status}</td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-neutral-400">No creators yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SUBMISSIONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Video submissions ({submissions.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Creator</th>
                <th className="p-3">Video</th>
                <th className="p-3">Platform</th>
                <th className="p-3">Views</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reward ($)</th>
                <th className="p-3">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="p-3 text-neutral-600">{emailFor(s.creator_id)}</td>
                  <td className="p-3 max-w-[180px]">
                    <a href={s.video_url} target="_blank" rel="noreferrer" className="block truncate text-blue-600 hover:underline">
                      {s.video_url}
                    </a>
                  </td>
                  <td className="p-3 capitalize text-neutral-600">{s.platform}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      defaultValue={s.views}
                      onBlur={(e) => {
                        const views = Number(e.target.value)
                        if (views !== s.views) updateSubmission(s.id, { views })
                      }}
                      className="w-24 rounded border border-neutral-300 px-2 py-1"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={s.status}
                      onChange={(e) => updateSubmission(s.id, { status: e.target.value })}
                      className="rounded border border-neutral-300 px-2 py-1 capitalize"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o} className="capitalize">{o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      defaultValue={s.reward_amount}
                      onBlur={(e) => {
                        const reward_amount = Number(e.target.value)
                        if (reward_amount !== s.reward_amount) updateSubmission(s.id, { reward_amount })
                      }}
                      className="w-24 rounded border border-neutral-300 px-2 py-1"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={s.paid}
                      onChange={(e) => updateSubmission(s.id, { paid: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-neutral-400">No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

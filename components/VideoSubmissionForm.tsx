'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { VideoSubmission } from '@/lib/types'

type Status = 'idle' | 'saving' | 'success' | 'error'

function detectPlatform(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('instagram.com')) return 'instagram'
  return 'other'
}

export default function VideoSubmissionForm() {
  const [email, setEmail] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [videos, setVideos] = useState<VideoSubmission[]>([])

  const loadVideos = async (creatorId: string) => {
    const { data } = await supabase
      .from('video_submissions')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
    setVideos((data as VideoSubmission[]) ?? [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!email.trim() || !videoUrl.trim()) {
      setStatus('error')
      setMessage('Email and video URL are required.')
      return
    }

    setStatus('saving')

    // 1. Find the creator by email.
    const { data: creator, error: lookupError } = await supabase
      .from('creators')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (lookupError) {
      setStatus('error')
      setMessage(lookupError.message || 'Could not look up that email.')
      return
    }
    if (!creator) {
      setStatus('error')
      setMessage('No creator found with that email. Sign up first.')
      return
    }

    // 2. Save the video. status / views / paid / reward_amount default in the DB.
    const { error: insertError } = await supabase.from('video_submissions').insert({
      creator_id: creator.id,
      video_url: videoUrl.trim(),
      platform: detectPlatform(videoUrl),
    })

    if (insertError) {
      setStatus('error')
      setMessage(insertError.message || 'Could not save your video.')
      return
    }

    // 3. Show their submissions.
    await loadVideos(creator.id)
    setStatus('success')
    setMessage('Video submitted. Pending review.')
    setVideoUrl('')
  }

  return (
    <div className="w-full max-w-2xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Video URL</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@you/video/..."
            className="w-full rounded-lg border border-neutral-300 bg-white/5 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500"
          />
          {videoUrl && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Detected platform: {detectPlatform(videoUrl)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {status === 'saving' ? 'Submitting…' : 'Submit video'}
        </button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>

      {videos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Your submissions
          </h3>
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 p-3.5 text-sm">
                <a
                  href={v.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-blue-600 hover:underline"
                >
                  {v.video_url}
                </a>
                <div className="flex shrink-0 items-center gap-3 text-neutral-500">
                  <span className="capitalize">{v.platform}</span>
                  <span>{v.views.toLocaleString()} views</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs capitalize">
                    {v.status}
                  </span>
                  <span>{v.paid ? 'Paid' : 'Unpaid'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

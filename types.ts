// Column shapes the app expects. If your Supabase tables use different
// column names, either rename them to match these or adjust here + in the
// queries. See supabase-setup.sql for the reference schema.

export type Creator = {
  id: string
  name: string
  email: string
  tiktok_handle: string | null
  instagram_handle: string | null
  status: string // defaults to 'pending'
  created_at: string
}

export type VideoSubmission = {
  id: string
  creator_id: string
  video_url: string
  platform: string // 'tiktok' | 'instagram' | 'other'
  status: string // defaults to 'pending'
  views: number // defaults to 0
  paid: boolean // defaults to false
  reward_amount: number // defaults to 0
  created_at: string
}

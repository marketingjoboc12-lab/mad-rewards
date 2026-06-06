'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, ArrowUpRight, Check, X, Clock, DollarSign,
  Upload, Calendar, Users, TrendingUp, Settings, LogOut, Menu,
  Trophy, Target, Lock, Mail, Phone, User as UserIcon, AtSign, Plus,
  ChevronRight, Sun, Moon, Filter, Search, MoreVertical,
  CheckCircle2, XCircle, CircleDot, Banknote, ExternalLink,
  Hash, Zap, Award, BarChart3, Eye, Heart, Music2, Instagram,
  Shield, Layers, Inbox, Wallet, ChevronLeft, Edit3, Trash2,
  Link as LinkIcon, FileText, Tag, Ticket, Gift, Package
} from 'lucide-react';
import { supabase, SUPABASE_URL_IN_USE } from '@/lib/supabase';

// Turn opaque network failures into something a human can act on.
const friendlyError = (e) => {
  const msg = (e && e.message) ? e.message : String(e || '');
  if (/failed to fetch|networkerror|name_not_resolved|err_name_not_resolved|fetch failed/i.test(msg))
    return 'Cannot reach the database. The Supabase URL looks unreachable — check NEXT_PUBLIC_SUPABASE_URL in Vercel for stray spaces/characters, then redeploy.';
  if (/no api key|api key|apikey|jwt|invalid.*key/i.test(msg))
    return 'Supabase rejected the request (API key problem). Check NEXT_PUBLIC_SUPABASE_ANON_KEY.';
  if (/permission|rls|row-level|policy/i.test(msg))
    return 'Saved request blocked by row-level security. Run the RLS policies for these tables.';
  return msg || 'Something went wrong.';
};

// =============================================================================
//  MAD REWARDS — Influencer rewards portal
//  Wired to Supabase: signup -> creators, video submit -> video_submissions,
//  Recent submissions loaded live. Campaigns remain local (no campaigns table).
// =============================================================================

// Map a video_submissions row (snake_case) onto the camelCase shape the
// existing UI already reads (sub.url, sub.submittedAt, sub.payout, etc.).
const mapSubmissionRow = (r) => ({
  id: r.id,
  creatorId: r.creator_id,
  campaignId: null,           // no campaign column in this model
  url: r.video_url,
  platform: r.platform,
  status: r.status,
  submittedAt: r.created_at,
  postedAt: r.posted_at || null,
  claimedViews: r.claimed_views ?? 0,
  payout: Number(r.reward_amount) || 0,
  views: r.views ?? 0,
  paid: !!r.paid,
  notes: '',
});

// Map a creators row onto the shape the UI uses for the signed-in creator.
const mapCreatorRow = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  tiktok: r.tiktok_handle,
  instagram: r.instagram_handle,
  status: r.status,
  joined: r.created_at,
});

// ────────────────────────── MOCK DATA ──────────────────────────
const initialCampaigns = [
  {
    id: 'cmp_01',
    title: 'Launch Week Sprint',
    reward: 250,
    bonus: 500,
    description: 'Post a TikTok or Reel featuring the drop during launch week. Highest engagement bags the bonus.',
    requirements: [
      'Post 1 TikTok or Reel',
      'Tag @madintel in caption',
      'Use hashtag #MADdrop',
      'Hit 5,000+ views in 72 hours',
    ],
    startDate: '2026-05-19',
    endDate: '2026-06-02',
    active: true,
  },
  {
    id: 'cmp_02',
    title: 'Behind The Brand',
    reward: 150,
    bonus: 0,
    description: 'A casual day-in-the-life vibe featuring the product. Authentic > polished.',
    requirements: [
      '30s+ TikTok or Reel',
      'Tag @madintel',
      'Show product in first 3 seconds',
      'Hit 2,000+ views',
    ],
    startDate: '2026-05-26',
    endDate: '2026-06-09',
    active: true,
  },
  {
    id: 'cmp_03',
    title: 'Carousel Week',
    reward: 100,
    bonus: 0,
    description: 'Instagram carousel only. Tell a story across 5+ slides.',
    requirements: [
      '5+ slide carousel',
      'Tag @madintel',
      'Hit 1,500+ saves or 3,000+ likes',
    ],
    startDate: '2026-05-12',
    endDate: '2026-05-26',
    active: false,
  },
];

const initialCreators = [
  { id: 'usr_01', name: 'Maya Okafor',     email: 'maya@example.com',     phone: '+1 415 555 0142', tiktok: '@mayaokafor',  instagram: '@maya.ok',     joined: '2026-04-12', password: 'demo' },
  { id: 'usr_02', name: 'Diego Salinas',   email: 'diego@example.com',    phone: '+1 213 555 0188', tiktok: '@diegosalinas', instagram: '@diego.s',   joined: '2026-04-18', password: 'demo' },
  { id: 'usr_03', name: 'Priya Raman',     email: 'priya@example.com',    phone: '+1 646 555 0119', tiktok: '@priyaraman',   instagram: '@priya.r',   joined: '2026-04-21', password: 'demo' },
  { id: 'usr_04', name: 'Sam Whitlock',    email: 'sam@example.com',      phone: '+44 20 7946 0918', tiktok: '@samwhitlock', instagram: '@sam.w',    joined: '2026-05-02', password: 'demo' },
  { id: 'usr_05', name: 'Noor Hassan',     email: 'noor@example.com',     phone: '+1 305 555 0177', tiktok: '@noorhassan',   instagram: '@noor.h',   joined: '2026-05-09', password: 'demo' },
  { id: 'usr_06', name: 'Tomás Ferreira',  email: 'tomas@example.com',    phone: '+55 11 9876 4321', tiktok: '@tomasferreira', instagram: '@tomas.f', joined: '2026-05-14', password: 'demo' },
];

const initialSubmissions = [
  { id: 'sub_01', creatorId: 'usr_01', campaignId: 'cmp_01', url: 'https://www.tiktok.com/@mayaokafor/video/7430000000000000001', platform: 'tiktok',    submittedAt: '2026-05-20', status: 'approved', notes: 'Hit 12k views in 48h.', payout: 250 },
  { id: 'sub_02', creatorId: 'usr_01', campaignId: 'cmp_02', url: 'https://www.instagram.com/reel/AbcDef123/', platform: 'instagram',                     submittedAt: '2026-05-23', status: 'pending',  notes: '', payout: 150 },
  { id: 'sub_03', creatorId: 'usr_02', campaignId: 'cmp_01', url: 'https://www.tiktok.com/@diegosalinas/video/7430000000000000002', platform: 'tiktok',  submittedAt: '2026-05-21', status: 'paid',     notes: 'Top performer — bonus paid.', payout: 750 },
  { id: 'sub_04', creatorId: 'usr_03', campaignId: 'cmp_01', url: 'https://www.tiktok.com/@priyaraman/video/7430000000000000003', platform: 'tiktok',    submittedAt: '2026-05-22', status: 'approved', notes: '', payout: 250 },
  { id: 'sub_05', creatorId: 'usr_04', campaignId: 'cmp_03', url: 'https://www.instagram.com/p/CarouselXYZ/', platform: 'instagram',                     submittedAt: '2026-05-18', status: 'rejected', notes: 'Did not tag brand.', payout: 0 },
  { id: 'sub_06', creatorId: 'usr_05', campaignId: 'cmp_02', url: 'https://www.tiktok.com/@noorhassan/video/7430000000000000004', platform: 'tiktok',    submittedAt: '2026-05-24', status: 'pending',  notes: '', payout: 150 },
  { id: 'sub_07', creatorId: 'usr_06', campaignId: 'cmp_01', url: 'https://www.instagram.com/reel/Tomas01/', platform: 'instagram',                      submittedAt: '2026-05-23', status: 'approved', notes: '', payout: 250 },
  { id: 'sub_08', creatorId: 'usr_02', campaignId: 'cmp_02', url: 'https://www.tiktok.com/@diegosalinas/video/7430000000000000005', platform: 'tiktok',  submittedAt: '2026-05-25', status: 'pending',  notes: '', payout: 150 },
];

const ADMIN_CREDS = { email: 'admin@madintel.com', password: 'admin' };

// ────────────────────────── HELPERS ──────────────────────────
const fmtMoney = (n) => `$${Number(n).toLocaleString('en-US')}`;
const fmtDate = (s) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateFull = (s) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const detectPlatform = (url) => {
  const u = (url || '').toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  return 'other';
};
const daysLeft = (endDate) => {
  const ms = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

// Parse loose view input: "1.2m" -> 1200000, "400k" -> 400000, "1,200,000" -> 1200000, "48200" -> 48200
const parseViews = (raw) => {
  if (raw == null) return 0;
  let s = String(raw).trim().toLowerCase().replace(/,/g, '').replace(/\s/g, '');
  if (!s) return 0;
  let mult = 1;
  if (s.endsWith('m')) { mult = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * mult);
};

// Pick an icon that fits a reward tier
const tierIcon = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('device') || l.includes('mega')) return Zap;
  if (l.includes('bag') || l.includes('duffle')) return Award;
  if (l.includes('product') || l.includes('re-up') || l.includes('reup')) return Gift;
  if (l.includes('$') || /\d/.test(l)) return Banknote;
  return Trophy;
};

// ────────────────────────── PRIMITIVES ──────────────────────────
const Btn = ({ children, variant = 'primary', size = 'md', className = '', icon: Icon, iconRight: IconRight, ...rest }) => {
  const sizes = {
    sm: 'h-9 px-4 text-[13px]',
    md: 'h-11 px-5 text-sm',
    lg: 'h-[52px] px-7 text-[15px]',
  };
  const variants = {
    primary: 'bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-[var(--shadow-sm)] hover:shadow-[0_12px_32px_-10px_var(--accent)]',
    outline: 'bg-transparent text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--elev1)] hover:border-[var(--text)] hover:-translate-y-0.5 active:translate-y-0',
    ghost:   'bg-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--elev1)]',
    danger:  'bg-[var(--elev1)] text-[var(--danger)] border border-[var(--border)] hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)]',
    success: 'bg-[var(--elev1)] text-[var(--success)] border border-[var(--border)] hover:bg-[var(--success)] hover:text-black hover:border-[var(--success)]',
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.4} />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2.4} />}
    </button>
  );
};

const Field = ({ label, icon: Icon, error, ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)] mb-2">{label}</span>}
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" strokeWidth={2.2} />}
      <input
        {...rest}
        className={`w-full h-12 ${Icon ? 'pl-11' : 'pl-4'} pr-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--elev2)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all`}
      />
    </div>
    {error && <span className="block text-xs text-[var(--danger)] mt-1.5">{error}</span>}
  </label>
);

const Textarea = ({ label, ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)] mb-2">{label}</span>}
    <textarea
      {...rest}
      className="w-full min-h-[96px] p-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] resize-y transition-all"
    />
  </label>
);

const Card = ({ children, className = '', interactive = false, ...rest }) => (
  <div
    {...rest}
    className={`rounded-3xl bg-[var(--elev1)] border border-[var(--border)] transition-all duration-300 ${interactive ? 'hover:border-[var(--border-strong)] hover:bg-[var(--elev2)] hover:-translate-y-0.5 cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

const Badge = ({ status, children }) => {
  const map = {
    pending:  { dot: 'bg-amber-400',   ring: 'ring-amber-400/20',   text: 'text-amber-400',   label: 'Pending Review' },
    approved: { dot: 'bg-blue-400',    ring: 'ring-blue-400/20',    text: 'text-blue-400',    label: 'Approved' },
    rejected: { dot: 'bg-red-400',     ring: 'ring-red-400/20',     text: 'text-red-400',     label: 'Rejected' },
    paid:     { dot: 'bg-[var(--accent)]', ring: 'ring-[var(--accent)]/20', text: 'text-[var(--accent)]', label: 'Paid' },
    active:   { dot: 'bg-emerald-400', ring: 'ring-emerald-400/20', text: 'text-emerald-400', label: 'Active' },
    ended:    { dot: 'bg-zinc-500',    ring: 'ring-zinc-500/20',    text: 'text-zinc-500',    label: 'Ended' },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--elev2)] ring-1 ring-inset ${m.ring} text-[11px] font-semibold ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'pending' ? 'animate-pulse' : ''}`} />
      {children || m.label}
    </span>
  );
};

const PlatformIcon = ({ platform, size = 14 }) => {
  if (platform === 'tiktok') return <Music2 size={size} strokeWidth={2.2} />;
  if (platform === 'instagram') return <Instagram size={size} strokeWidth={2.2} />;
  return <LinkIcon size={size} strokeWidth={2.2} />;
};

const Stat = ({ label, value, icon: Icon, accent = false }) => (
  <Card className="p-5 md:p-6">
    <div className="flex items-start justify-between mb-4">
      <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--text-dim)]">{label}</span>
      {Icon && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${accent ? 'bg-[var(--accent)] text-black' : 'bg-[var(--elev2)] text-[var(--text-dim)]'}`}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
      )}
    </div>
    <div className="font-display text-[32px] md:text-[38px] font-bold tracking-tight text-[var(--text)] leading-none">{value}</div>
  </Card>
);

// ────────────────────────── THEME / STYLES ──────────────────────────
const ThemeStyles = () => (
  <style>{`
    :root {
      --bg:          #0a0a0a;
      --elev1:       #131313;
      --elev2:       #1a1a1a;
      --border:      rgba(255,255,255,0.07);
      --border-strong: rgba(255,255,255,0.14);
      --text:        #f5f5f5;
      --text-dim:    #909090;
      --text-faint:  #555;
      --accent:      #D9FF3D;
      --accent-hover:#C6EC1F;
      --accent-soft: rgba(217,255,61,0.1);
      --danger:      #ef4444;
      --success:     #34d399;
      --shadow-sm:   0 1px 2px rgba(0,0,0,0.4);
      --shadow-md:   0 8px 24px -8px rgba(0,0,0,0.5);
      --shadow-lg:   0 20px 60px -20px rgba(0,0,0,0.6);
      --ease:        cubic-bezier(0.22, 1, 0.36, 1);
    }
    .light {
      --bg:          #fafaf9;
      --elev1:       #ffffff;
      --elev2:       #f4f4f5;
      --border:      rgba(0,0,0,0.06);
      --border-strong: rgba(0,0,0,0.14);
      --text:        #0a0a0a;
      --text-dim:    #6b6b6b;
      --text-faint:  #b0b0b0;
      --accent:      #84cc16;
      --accent-hover:#65a30d;
      --accent-soft: rgba(132,204,22,0.08);
      --shadow-sm:   0 1px 2px rgba(0,0,0,0.04);
      --shadow-md:   0 8px 24px -8px rgba(0,0,0,0.08);
      --shadow-lg:   0 20px 60px -20px rgba(0,0,0,0.12);
    }

    .font-display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -0.02em; }
    .font-mono    { font-family: 'JetBrains Mono', monospace; }
    body, .font-body { font-family: 'Manrope', system-ui, sans-serif; }

    .madvault-root {
      background: var(--bg);
      color: var(--text);
      font-family: 'Manrope', system-ui, sans-serif;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .madvault-root::before {
      content: '';
      position: fixed; inset: 0;
      background-image: radial-gradient(circle at 1px 1px, var(--text-faint) 0.5px, transparent 0);
      background-size: 36px 36px;
      opacity: 0.05;
      pointer-events: none;
      z-index: 0;
    }

    .glow-accent {
      background: radial-gradient(60% 60% at 50% 50%, var(--accent-soft) 0%, transparent 70%);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-up { animation: fadeUp 0.9s cubic-bezier(0.2, 0.65, 0.2, 1) both; }
    .anim-d-100 { animation-delay: 0.08s; }
    .anim-d-200 { animation-delay: 0.18s; }
    .anim-d-300 { animation-delay: 0.30s; }
    .anim-d-400 { animation-delay: 0.42s; }
    .anim-d-500 { animation-delay: 0.54s; }

    /* Hero per-line reveal — each line slides up + fades with stagger */
    @keyframes heroLine {
      from { opacity: 0; transform: translateY(40px); filter: blur(4px); }
      to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
    }
    .hero-line {
      display: block;
      opacity: 0;
      animation: heroLine 1.1s cubic-bezier(0.2, 0.65, 0.2, 1) both;
    }
    .hero-line-1 { animation-delay: 0.15s; }
    .hero-line-2 { animation-delay: 0.32s; }
    .hero-line-3 { animation-delay: 0.50s; }

    /* Scroll-triggered reveals (SocialTip-style) */
    .reveal {
      opacity: 0;
      will-change: opacity, transform, filter;
      transition:
        opacity   1.1s cubic-bezier(0.2, 0.65, 0.2, 1),
        transform 1.1s cubic-bezier(0.2, 0.65, 0.2, 1),
        filter    1.1s cubic-bezier(0.2, 0.65, 0.2, 1);
    }
    .reveal-up   { transform: translateY(36px); }
    .reveal-blur { filter: blur(14px); }
    .reveal-fade { /* opacity only */ }
    .reveal.is-in {
      opacity: 1;
      transform: none;
      filter: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .anim-fade-up, .hero-line {
        transition: none !important;
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
      }
    }

    @keyframes shimmer {
      0%,100% { opacity: 1; }
      50%     { opacity: 0.55; }
    }
    .pulse-soft { animation: shimmer 2.6s ease-in-out infinite; }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { scrollbar-width: none; }

    /* Infinite horizontal marquee for video carousel */
    @keyframes marquee {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .marquee-track {
      animation: marquee 60s linear infinite;
      width: max-content;
      will-change: transform;
    }
    .marquee-wrap:hover .marquee-track {
      animation-play-state: paused;
    }
    .marquee-fade::before,
    .marquee-fade::after {
      content: '';
      position: absolute;
      top: 0; bottom: 0;
      width: 80px;
      z-index: 2;
      pointer-events: none;
    }
    .marquee-fade::before {
      left: 0;
      background: linear-gradient(to right, var(--bg), transparent);
    }
    .marquee-fade::after {
      right: 0;
      background: linear-gradient(to left, var(--bg), transparent);
    }
    @media (max-width: 640px) {
      .marquee-fade::before, .marquee-fade::after { width: 40px; }
    }

    /* Logo swaps by theme: white logo on dark, black logo on light */
    .logo-light { display: none; }
    .logo-dark  { display: inline-block; }
    .light .logo-light { display: inline-block; }
    .light .logo-dark  { display: none; }

    /* Slowly rotating gradient inside placeholder video cards */
    @keyframes drift {
      0%, 100% { transform: scale(1.1) translate(0, 0); }
      50%      { transform: scale(1.2) translate(-4%, -3%); }
    }
    .video-drift { animation: drift 14s ease-in-out infinite; }

    /* Smoother global transitions */
    button, a { transition: all 0.2s var(--ease); }

    /* Refined focus ring */
    *:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 6px;
    }

    input:-webkit-autofill,
    input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--text);
      -webkit-box-shadow: 0 0 0 1000px var(--elev1) inset;
      transition: background-color 9999s ease-out;
    }
  `}</style>
);

// ────────────────────────── LOGO ──────────────────────────
// MAD LABS wordmark — embedded as PNG data URI so it ships with the JSX.
// Swap MADLABS_LOGO with a hosted URL when you have a CDN set up.
const LOGO_DARK = 'data:image/png;base64,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';   // white logo — shown on dark theme
const LOGO_LIGHT = 'data:image/png;base64,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'; // black logo — shown on light theme

const Logo = ({ small = false }) => {
  const sz = small ? 'h-8 md:h-9' : 'h-9 md:h-10';
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center">
      <img src={LOGO_DARK}  alt="Mad Rewards" className={`logo-dark ${sz} w-auto select-none`}  draggable={false} />
      <img src={LOGO_LIGHT} alt="Mad Rewards" className={`logo-light ${sz} w-auto select-none`} draggable={false} />
    </a>
  );
};

// ────────────────────────── THEME TOGGLE ──────────────────────────
const ThemeToggle = ({ theme, setTheme }) => (
  <button
    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    className="w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] hover:bg-[var(--elev2)] hover:border-[var(--border-strong)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)]"
    aria-label="Toggle theme"
  >
    {theme === 'dark' ? <Sun size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
  </button>
);

// ====================== CREATOR VIDEO CAROUSEL ======================
// Real videos live in `public/videos/` and are served at `/videos/<filename>`.
// To add more, drop the MP4 into public/videos/ and add an entry below.
// To remove, delete the entry.
const CREATOR_VIDEOS = [
  { id: 'v1', creator: 'MAYA',  reward: '$6.83',  platform: 'tiktok',    accent: 'from-pink-500 via-rose-400 to-orange-400',     src: '/videos/Untitled_design.mp4', poster: null },
  { id: 'v2', creator: 'DIEGO', reward: '$10.95', platform: 'instagram', accent: 'from-purple-500 via-fuchsia-400 to-pink-500',  src: '/videos/snaptik_7630493405272984846_v3 (1).mp4', poster: null },
  { id: 'v3', creator: 'PRIYA', reward: '$6.67',  platform: 'tiktok',    accent: 'from-cyan-400 via-blue-500 to-indigo-600',     src: '/videos/snaptik_7565392481496485151_v3 (1).mp4', poster: null },
  { id: 'v4', creator: 'SAM',   reward: '$10.80', platform: 'instagram', accent: 'from-emerald-400 via-teal-500 to-cyan-600',    src: '/videos/snaptik_7633507667079597342_v3 (1).mp4', poster: null },
  { id: 'v5', creator: 'NOOR',  reward: '$11.99', platform: 'tiktok',    accent: 'from-amber-400 via-orange-500 to-red-500',     src: '/videos/snaptik_7577547898355764510_v3 (1).mp4', poster: null },
  { id: 'v6', creator: 'TOMÁS', reward: '$5.87',  platform: 'instagram', accent: 'from-lime-400 via-emerald-500 to-teal-500',    src: '/videos/snaptik_7620274220408360205_v3 (1).mp4', poster: null },
  { id: 'v7', creator: 'KIMMI', reward: '$17.89', platform: 'tiktok',    accent: 'from-violet-500 via-purple-600 to-fuchsia-500',src: '/videos/snaptik_7589090811782925598_v3 (1).mp4', poster: null },
];

const VideoCard = ({ creator, reward, platform, src, poster, accent }) => (
  <div className="group relative w-[150px] sm:w-[180px] md:w-[210px] aspect-[9/16] rounded-3xl overflow-hidden flex-shrink-0 bg-[var(--elev2)] cursor-pointer shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:scale-[1.04] hover:-translate-y-1 duration-500">
    {src ? (
      <video
        src={src}
        poster={poster || undefined}
        autoPlay muted loop playsInline preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
    ) : (
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} video-drift`}>
        <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.7) 0%, transparent 45%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.4) 0%, transparent 50%)',
        }} />
      </div>
    )}
  </div>
);

const VideoCarousel = ({ videos = CREATOR_VIDEOS }) => {
  // Duplicate for seamless infinite loop
  const doubled = [...videos, ...videos];
  return (
    <div className="marquee-wrap marquee-fade relative w-full overflow-hidden py-4">
      <div className="flex gap-3 md:gap-4 marquee-track">
        {doubled.map((v, i) => <VideoCard key={`${v.id}-${i}`} {...v} />)}
      </div>
    </div>
  );
};

// ============================================================================
//  SCROLL REVEAL — fades sections in as they enter the viewport
// ============================================================================
const useInView = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.unobserve(el);
      }
    }, { threshold, rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
};

const Reveal = ({
  children,
  variant = 'up',
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  variant?: 'up' | 'blur' | 'fade';
  delay?: number;
  className?: string;
  as?: any;
}) => {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant} ${inView ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
};

// ============================================================================
//  LANDING
// ============================================================================
const REWARD_TEASERS = {
  week: [
    { tag: 'Re-up', label: 'Free product restock', sub: 'Stay active, keep posting' },
    { tag: '$100', label: 'Cash reward', sub: 'Hit the weekly view goal' },
    { tag: '$200', label: 'Cash reward', sub: 'Push past the next tier' },
  ],
  month: [
    { tag: '$300', label: 'Cash reward', sub: 'Monthly reach milestone' },
    { tag: '$350 + bag', label: 'Cash + MAD duffle bag', sub: 'Top creators only' },
    { tag: '$350 + device', label: 'Cash + Mega device', sub: 'Hit the big numbers' },
  ],
};

const BlurReward = ({ t }) => (
  <Card className="relative overflow-hidden p-5 sm:p-6 select-none min-h-[116px] sm:min-h-[140px]">
    <div className="pointer-events-none blur-[7px] opacity-80">
      <div className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--accent)]">{t.tag}</div>
      <div className="font-semibold mt-2 text-sm sm:text-base">{t.label}</div>
      <div className="text-xs sm:text-sm text-[var(--text-dim)] mt-1">{t.sub}</div>
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-dim)] bg-[var(--elev1)]/90 border border-[var(--border)] px-3 py-1.5 rounded-full backdrop-blur-sm">
        <Lock size={12} /> Members only
      </span>
    </div>
  </Card>
);

const LandingPage = ({ go, theme, setTheme }) => {
  return (
    <div className="relative z-10">
      {/* NAV — login stays top-right */}
      <nav className="relative z-20 px-5 md:px-10 py-5 md:py-6 flex items-center justify-between max-w-7xl mx-auto">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <Btn variant="ghost" size="sm" onClick={() => go('login')}>Log in</Btn>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative px-5 md:px-10 pt-8 md:pt-16 pb-8 md:pb-12 max-w-5xl mx-auto text-center">
        <div className="absolute inset-0 glow-accent pointer-events-none" />
        <div className="relative">
          <div className="anim-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--elev1)] text-xs text-[var(--text-dim)] mb-6 md:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] pulse-soft" />
            Invite-only creator program
          </div>
          <h1 className="font-display font-extrabold text-[19vw] sm:text-[104px] md:text-[148px] leading-[0.86] tracking-[-0.04em]">
            <span className="hero-line hero-line-1">Post.</span>
            <span className="hero-line hero-line-2">Earn.</span>
            <span className="hero-line hero-line-3 text-[var(--accent)]">Repeat.</span>
          </h1>
          <p className="anim-fade-up anim-d-400 mt-6 md:mt-8 mx-auto max-w-lg text-base md:text-xl text-[var(--text-dim)] leading-relaxed">
            Post content. Hit goals. Earn rewards every week. Mad Rewards is invite-only.
          </p>
        </div>
      </header>
{/* CREATOR VIDEOS — auto-scrolling carousel */}
      <section className="relative pb-10 md:pb-14">
        <div className="flex items-center justify-between mb-4 md:mb-5 px-5 md:px-10 max-w-6xl mx-auto">
          <h2 className="font-display font-bold text-xl md:text-3xl tracking-tight">Creators on TikTok</h2>
          <Badge status="active">Live</Badge>
        </div>
        <VideoCarousel />
      </section>
      {/* BLURRED — THIS WEEK */}
      <section className="relative px-5 md:px-10 pb-10 md:pb-14 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <h2 className="font-display font-bold text-xl md:text-3xl tracking-tight">Active rewards — this week</h2>
          <Badge status="active">Live</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {REWARD_TEASERS.week.map((t, i) => <BlurReward key={i} t={t} />)}
        </div>
      </section>

      {/* BLURRED — THIS MONTH */}
      <section className="relative px-5 md:px-10 pb-10 md:pb-14 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <h2 className="font-display font-bold text-xl md:text-3xl tracking-tight">Active rewards — this month</h2>
          <Badge status="active">Live</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {REWARD_TEASERS.month.map((t, i) => <BlurReward key={i} t={t} />)}
        </div>
        <p className="text-center text-sm text-[var(--text-dim)] mt-6 md:mt-8">Sign in to unlock the full reward ladder and track your progress.</p>
      </section>

      {/* TWO DOORS */}
      <section className="relative px-5 md:px-10 pb-16 md:pb-24 max-w-3xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-4">
          <Card interactive onClick={() => go('invite')} className="p-6 md:p-7 text-center cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-black flex items-center justify-center mx-auto mb-4"><Ticket size={20} /></div>
            <h3 className="font-display font-bold text-xl">Have an invite code?</h3>
            <p className="text-sm text-[var(--text-dim)] mt-2">Enter your one-time code and set up your account.</p>
            <div className="mt-5"><Btn className="w-full" iconRight={ArrowRight}>Enter code</Btn></div>
          </Card>
          <Card interactive onClick={() => go('request')} className="p-6 md:p-7 text-center cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-[var(--elev2)] text-[var(--accent)] flex items-center justify-center mx-auto mb-4"><Mail size={20} /></div>
            <h3 className="font-display font-bold text-xl">Want in?</h3>
            <p className="text-sm text-[var(--text-dim)] mt-2">Request an invite. If you're a fit, we'll send you a code.</p>
            <div className="mt-5"><Btn variant="outline" className="w-full" iconRight={ArrowRight}>Request an invite</Btn></div>
          </Card>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative px-5 md:px-10 py-10 border-t border-[var(--border)] max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Logo small />
            <span className="text-xs text-[var(--text-dim)]">© 2026 MAD Intelligence</span>
          </div>
          <a href="/admin" className="text-xs text-[var(--text-faint)] hover:text-[var(--text-dim)]">Admin</a>
        </div>
      </footer>
    </div>
  );
};

// ============================================================================
//  AUTH — Sign Up / Login (creator) and Admin Login
// ============================================================================
const AuthFrame = ({ go, back = 'landing', children }) => (
  <div className="relative z-10 min-h-screen flex flex-col">
    <nav className="px-5 md:px-10 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
      <button onClick={() => go(back)} className="flex items-center gap-1.5 text-[var(--text-dim)] hover:text-[var(--text)] -ml-1 h-9 px-3 rounded-full hover:bg-[var(--elev1)]">
        <ChevronLeft size={16} /><span className="text-sm font-semibold">Back</span>
      </button>
      <Logo small />
    </nav>
    <div className="flex-1 flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-md anim-fade-up">{children}</div>
    </div>
  </div>
);

const LoginPage = ({ go, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await onLogin({ email, password }); }
    catch (err) { setError(err?.message || 'Could not log in.'); }
    finally { setBusy(false); }
  };
  return (
    <AuthFrame go={go}>
      <div className="text-center mb-8">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Welcome back.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">Log in to see this week's challenge.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" icon={Mail} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" icon={Lock} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
        <div className="pt-2"><Btn type="submit" size="lg" className="w-full" disabled={busy} iconRight={ArrowRight}>{busy ? 'Logging in…' : 'Log in'}</Btn></div>
      </form>
      <p className="text-center text-sm text-[var(--text-dim)] mt-6">Have an invite code? <button onClick={() => go('invite')} className="text-[var(--accent)] font-semibold">Sign up</button></p>
    </AuthFrame>
  );
};

const InvitePage = ({ go, onValid }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await onValid(code.trim().toUpperCase()); }
    catch (err) { setError(err?.message || 'That code is not valid.'); }
    finally { setBusy(false); }
  };
  return (
    <AuthFrame go={go}>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-black flex items-center justify-center mx-auto mb-5"><Ticket size={24} /></div>
        <h1 className="font-display font-extrabold text-4xl tracking-tight">Enter your invite.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">This is a <span className="text-[var(--text)] font-semibold">one-time-use invite code</span>, just for you. Please don't share it.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Invite code" icon={Ticket} placeholder="MAD-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
        <div className="pt-2"><Btn type="submit" size="lg" className="w-full" disabled={busy} iconRight={ArrowRight}>{busy ? 'Checking…' : 'Continue'}</Btn></div>
      </form>
      <p className="text-center text-sm text-[var(--text-dim)] mt-6">No code? <button onClick={() => go('request')} className="text-[var(--accent)] font-semibold">Request an invite</button></p>
    </AuthFrame>
  );
};

const SignupPage = ({ go, code, onSignup }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', cashapp: '', password: '', tiktok: '', instagram: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try { await onSignup({ ...form, code }); }
    catch (err) { setError(err?.message || 'Could not create your account.'); }
    finally { setBusy(false); }
  };
  return (
    <AuthFrame go={go} back="invite">
      <div className="text-center mb-8">
        <h1 className="font-display font-extrabold text-4xl tracking-tight">Create your account.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">Invite <span className="font-mono text-[var(--accent)]">{code}</span> accepted. Set up your profile.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" icon={UserIcon} placeholder="Maya Okafor" value={form.name} onChange={(e) => up('name', e.target.value)} />
        <Field label="Email" icon={Mail} type="email" placeholder="you@email.com" value={form.email} onChange={(e) => up('email', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" icon={Phone} type="tel" placeholder="+1 555 000 0000" value={form.phone} onChange={(e) => up('phone', e.target.value)} />
          <Field label="Cash App" icon={DollarSign} placeholder="$yourcashtag" value={form.cashapp} onChange={(e) => up('cashapp', e.target.value)} />
        </div>
        <Field label="Password" icon={Lock} type="password" placeholder="At least 6 characters" value={form.password} onChange={(e) => up('password', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="TikTok" icon={AtSign} placeholder="@you" value={form.tiktok} onChange={(e) => up('tiktok', e.target.value)} />
          <Field label="Instagram" icon={AtSign} placeholder="@you" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} />
        </div>
        {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
        <div className="pt-2"><Btn type="submit" size="lg" className="w-full" disabled={busy} iconRight={ArrowRight}>{busy ? 'Creating…' : 'Create my account'}</Btn></div>
      </form>
    </AuthFrame>
  );
};

const RequestPage = ({ go, onSubmit }) => {
  const [form, setForm] = useState({ name: '', email: '', tiktok: '', instagram: '', note: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.email) { setError('Name and email are required.'); return; }
    setBusy(true);
    try { await onSubmit(form); setDone(true); }
    catch (err) { setError(err?.message || 'Could not send your request.'); }
    finally { setBusy(false); }
  };
  if (done) return (
    <AuthFrame go={go}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-black flex items-center justify-center mx-auto mb-5"><Check size={26} strokeWidth={3} /></div>
        <h1 className="font-display font-extrabold text-4xl tracking-tight">Request sent.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">If you're a fit, we'll send a one-time invite code to your email. Keep an eye out.</p>
        <div className="mt-7"><Btn variant="outline" onClick={() => go('landing')}>Back home</Btn></div>
      </div>
    </AuthFrame>
  );
  return (
    <AuthFrame go={go}>
      <div className="text-center mb-8">
        <h1 className="font-display font-extrabold text-4xl tracking-tight">Request an invite.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">Tell us about you. Mad Rewards is invite-only — we approve creators who fit.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" icon={UserIcon} placeholder="Maya Okafor" value={form.name} onChange={(e) => up('name', e.target.value)} />
        <Field label="Email" icon={Mail} type="email" placeholder="you@email.com" value={form.email} onChange={(e) => up('email', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="TikTok" icon={AtSign} placeholder="@you" value={form.tiktok} onChange={(e) => up('tiktok', e.target.value)} />
          <Field label="Instagram" icon={AtSign} placeholder="@you" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} />
        </div>
        <Textarea label="Your pitch" placeholder="Audience size, what you post, why you're a fit…" value={form.note} onChange={(e) => up('note', e.target.value)} />
        {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
        <div className="pt-2"><Btn type="submit" size="lg" className="w-full" disabled={busy} iconRight={ArrowRight}>{busy ? 'Sending…' : 'Send request'}</Btn></div>
      </form>
    </AuthFrame>
  );
};

const AdminLoginPage = ({ go, onAdminLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (email.toLowerCase() === ADMIN_CREDS.email && password === ADMIN_CREDS.password) {
      onAdminLogin();
    } else {
      setError('Invalid admin credentials. Try admin@madintel.com / admin');
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <nav className="px-5 md:px-10 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <button onClick={() => go('landing')} className="flex items-center gap-1.5 text-[var(--text-dim)] hover:text-[var(--text)] -ml-1 h-9 px-3 rounded-full hover:bg-[var(--elev1)]">
          <ChevronLeft size={16} />
          <span className="text-sm font-semibold">Back</span>
        </button>
        <Logo small />
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md anim-fade-up">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] mb-6">
              <Shield size={22} className="text-[var(--accent)]" />
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl tracking-tight">Admin sign-in</h1>
            <p className="mt-3 text-sm text-[var(--text-dim)]">Restricted access. Audited.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" icon={Mail} type="email" placeholder="admin@madintel.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" icon={Lock} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
            <div className="pt-2">
              <Btn type="submit" size="lg" className="w-full" iconRight={ArrowRight}>Enter admin</Btn>
            </div>
          </form>
          <div className="mt-6 p-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-xs text-[var(--text-dim)]">
            <div className="font-semibold text-[var(--text)] mb-1">Demo admin</div>
            <span className="font-mono text-[var(--accent)]">admin@madintel.com</span> / <span className="font-mono">admin</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
//  CREATOR APP
// ============================================================================
const CreatorShell = ({ user, view, setView, onLogout, theme, setTheme, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = [
    { k: 'dash',    label: 'Dashboard',  icon: BarChart3 },
    { k: 'rewards', label: 'Rewards',    icon: Trophy },
    { k: 'history', label: 'Submissions', icon: Inbox },
  ];

  return (
    <div className="relative z-10 min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--bg)]/85 border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Logo small />
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setView(t.k)}
                  className={`relative h-10 px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${view === t.k ? 'text-[var(--text)] bg-[var(--elev2)]' : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--elev1)]'}`}
                >
                  <t.icon size={14} strokeWidth={2.4} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <div className="hidden md:flex items-center gap-3 pl-4 pr-1.5 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)]">
              <span className="text-xs">
                <span className="text-[var(--text-dim)]">Hi, </span>
                <span className="font-semibold text-[var(--text)]">{user.name.split(' ')[0]}</span>
              </span>
              <button onClick={onLogout} className="w-7 h-7 rounded-full bg-[var(--elev2)] hover:bg-[var(--danger)] hover:text-white text-[var(--text-dim)] flex items-center justify-center" title="Log out">
                <LogOut size={13} />
              </button>
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-center">
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="md:hidden border-t border-[var(--border)] px-5 py-4 space-y-1 anim-fade-up">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => { setView(t.k); setMenuOpen(false); }}
                className={`w-full h-12 px-4 rounded-2xl text-sm font-semibold flex items-center gap-3 ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)]'}`}
              >
                <t.icon size={15} strokeWidth={2.4} />
                {t.label}
              </button>
            ))}
            <button onClick={() => { onLogout(); setMenuOpen(false); }} className="w-full h-12 px-4 rounded-2xl text-sm font-semibold flex items-center gap-3 text-[var(--danger)]">
              <LogOut size={15} strokeWidth={2.4} />
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
        {children}
      </main>
    </div>
  );
};

const CreatorDashboard = ({ user, deal, submissions, onSubmit, setView }) => {
  const mine = submissions.filter((s) => s.creatorId === user.id);
  const pending = mine.filter((s) => s.status === 'pending').length;
  const earned = mine.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.payout || 0), 0);
  const pendingPayout = mine.filter((s) => s.status === 'approved').reduce((sum, s) => sum + (s.payout || 0), 0);

  // ── Rewards calculator (driven by the active campaign) ──
  const tiers = deal?.tiers || [];
  const periodStart = deal?.starts_at ? new Date(deal.starts_at) : null;
  const minePeriod = periodStart ? mine.filter((s) => new Date(s.postedAt || s.submittedAt) >= periodStart) : mine;
  const videoCount = minePeriod.length;
  const totalViews = minePeriod.reduce((sum, s) => sum + (s.views || 0), 0);
  const qualifies = (t) => (t.videos != null && videoCount >= t.videos) || (totalViews >= t.views);
  let currentIdx = -1;
  tiers.forEach((t, i) => { if (qualifies(t)) currentIdx = Math.max(currentIdx, i); });
  const current = currentIdx >= 0 ? tiers[currentIdx] : null;
  const next = tiers[currentIdx + 1] || null;
  const viewsToNext = next ? Math.max(0, next.views - totalViews) : 0;
  const videosToNext = next && next.videos != null ? Math.max(0, next.videos - videoCount) : null;
  const nf = (n) => Number(n || 0).toLocaleString();
  const progress = next ? Math.min(100, Math.round((totalViews / next.views) * 100)) : 100;
  const examples = deal?.examples || [];

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] p-7 md:p-10 anim-fade-up"
        style={{ background: 'radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 45%), radial-gradient(120% 160% at 0% 120%, rgba(124,58,237,0.14) 0%, transparent 50%), var(--elev1)' }}>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full glow-accent pointer-events-none" />
        <Trophy className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none hidden sm:block" size={150} />
        <div className="relative">
          <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--accent)]">{fmtDateFull(new Date().toISOString())}</span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">
            Welcome back, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-3 text-[var(--text-dim)] max-w-lg leading-relaxed">
            {deal
              ? (current
                  ? <>You've unlocked <span className="text-[var(--text)] font-semibold">{current.reward_label}</span> so far this {deal.cadence === 'monthly' ? 'month' : 'week'}.</>
                  : <>No reward unlocked yet — keep posting to hit your first tier.</>)
              : <>No active campaign right now. Check back soon.</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 anim-fade-up anim-d-100">
        <div className="flex items-center gap-3.5 p-4 md:p-5 rounded-2xl bg-[var(--elev1)] border border-[var(--border)]">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#a3e635,#4d7c0f)' }}><Wallet size={18} /></span>
          <div><div className="font-display font-bold text-2xl leading-none">{fmtMoney(earned)}</div><div className="text-xs text-[var(--text-dim)] mt-1 font-semibold">Earned</div></div>
        </div>
        <div className="flex items-center gap-3.5 p-4 md:p-5 rounded-2xl bg-[var(--elev1)] border border-[var(--border)]">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#a78bfa,#6d28d9)' }}><Clock size={18} /></span>
          <div><div className="font-display font-bold text-2xl leading-none">{fmtMoney(pendingPayout)}</div><div className="text-xs text-[var(--text-dim)] mt-1 font-semibold">Pending</div></div>
        </div>
        <div className="flex items-center gap-3.5 p-4 md:p-5 rounded-2xl bg-[var(--elev1)] border border-[var(--border)]">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#fcd34d,#d97706)' }}><Inbox size={18} /></span>
          <div><div className="font-display font-bold text-2xl leading-none">{pending}</div><div className="text-xs text-[var(--text-dim)] mt-1 font-semibold">In review</div></div>
        </div>
      </div>

      {/* ── REWARDS ── */}
      {deal ? (
        <div className="anim-fade-up anim-d-200">
          {/* progress header */}
          <Card className="relative overflow-hidden p-7 md:p-10">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full glow-accent pointer-events-none" />
            <div className="relative">
              <Badge status="active">{deal.cadence === 'monthly' ? 'This month' : 'This week'}</Badge>
              <h2 className="font-display font-extrabold text-3xl md:text-5xl mt-5 tracking-tight">{deal.title}</h2>

              <div className="mt-7 grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--text-dim)] mb-1.5">Your views</div>
                  <div className="font-display font-bold text-3xl md:text-4xl text-[var(--accent)]">{nf(totalViews)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--text-dim)] mb-1.5">Your videos</div>
                  <div className="font-display font-bold text-3xl md:text-4xl">{videoCount}</div>
                </div>
              </div>

              {/* the one clear sentence */}
              <div className="mt-7">
                {current && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--accent)] text-black font-bold text-sm mb-4">
                    <Check size={15} strokeWidth={3} /> You've earned {current.reward_label}
                  </div>
                )}
                {next ? (
                  <>
                    <div className="text-lg md:text-xl font-semibold">
                      {nf(viewsToNext)} more views{videosToNext != null && <> (or {videosToNext} more videos)</>} to unlock <span className="text-[var(--accent)]">{next.reward_label}</span>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-[var(--elev2)] overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="text-lg md:text-xl font-bold text-[var(--accent)]">🎉 You've reached the top reward. Incredible.</div>
                )}
              </div>
            </div>
          </Card>

          {/* reward ladder */}
          <div className="mt-6 space-y-3">
            {tiers.map((t, i) => {
              const hit = qualifies(t);
              const isNext = i === currentIdx + 1;
              const Ico = tierIcon(t.reward_label);
              return (
                <div
                  key={i}
                  className={`reward-step group flex items-center gap-4 p-4 md:p-5 rounded-2xl border transition-all duration-300
                    ${hit
                      ? 'border-[var(--accent)] shadow-[0_8px_30px_-12px_var(--accent)]'
                      : isNext
                        ? 'border-[var(--accent)]/40 bg-[var(--elev1)]'
                        : 'border-[var(--border)] bg-[var(--elev1)] opacity-60'}`}
                  style={hit ? { background: 'linear-gradient(135deg, var(--accent-soft), transparent)' } : undefined}
                >
                  <span
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all
                      ${hit ? 'bg-[var(--accent)] text-black scale-100' : isNext ? 'bg-[var(--elev2)] text-[var(--accent)] pulse-soft' : 'bg-[var(--elev2)] text-[var(--text-faint)]'}`}
                  >
                    {hit ? <Check size={22} strokeWidth={3} /> : <Ico size={20} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-lg md:text-xl">{t.reward_label}</span>
                      {hit && <span className="text-[10px] uppercase tracking-wide font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full">Unlocked</span>}
                      {isNext && <span className="text-[10px] uppercase tracking-wide font-bold text-[var(--text-dim)] border border-[var(--border)] px-2 py-0.5 rounded-full">Next up</span>}
                    </div>
                    <div className="text-sm text-[var(--text-dim)] mt-0.5">
                      {t.videos != null ? <>{t.videos} videos or {nf(t.views)} views</> : <>{nf(t.views)} views</>}
                    </div>
                  </div>
                  {!hit && <Lock size={16} className="text-[var(--text-faint)] flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center anim-fade-up anim-d-200">
          <p className="text-sm text-[var(--text-dim)]">No active campaign right now. Check back soon.</p>
        </Card>
      )}

      <SubmitForm user={user} onSubmit={onSubmit} />

      {/* ── EXAMPLE VIDEOS ── */}
      {examples.length > 0 && (
        <div className="anim-fade-up anim-d-300">
          <h3 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-5">Example videos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {examples.map((x, i) => (
              <a key={i} href={toUrl(x)} target="_blank" rel="noreferrer"
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--elev2)] hover:border-[var(--border-strong)]">
                <div className="flex items-center gap-3 min-w-0">
                  <PlatformIcon platform={detectPlatform(x)} />
                  <span className="text-sm truncate">{x}</span>
                </div>
                <ExternalLink size={15} className="text-[var(--text-dim)] flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="anim-fade-up anim-d-400">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-2xl md:text-3xl tracking-tight">Recent submissions</h3>
          <button onClick={() => setView('history')} className="text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1">
            See all <ChevronRight size={14} />
          </button>
        </div>
        {mine.length === 0 ? (
          <Card className="p-12 text-center">
            <Inbox size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
            <p className="text-sm text-[var(--text-dim)]">No submissions yet. Drop your first link above.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {mine.slice(0, 3).map((s) => <SubmissionRow key={s.id} sub={s} campaign={null} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const SubmitForm = ({ user, onSubmit }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [postedAt, setPostedAt] = useState('');
  const [claimedViews, setClaimedViews] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ready = url && postedAt && parseViews(claimedViews) > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError('');
    setSuccess(false);
    setSubmitting(true);
    try {
      await onSubmit({ creatorId: user.id, url, platform, postedAt, claimedViews: parseViews(claimedViews) });
      setUrl(''); setPostedAt(''); setClaimedViews('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2400);
    } catch (err) {
      setError(err?.message || 'Could not submit your link. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-6 md:p-8 anim-fade-up anim-d-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-[0_4px_16px_-4px_var(--accent)]">
          <Upload size={16} strokeWidth={2.4} className="text-black" />
        </div>
        <div>
          <h3 className="font-display font-bold text-xl tracking-tight">Submit a video</h3>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">Add your video, where it posted, when, and its views</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* platform toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)] mb-2.5">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' }].map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center justify-center gap-2 h-12 rounded-2xl border font-semibold text-sm transition-all ${platform === p.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]' : 'border-[var(--border)] bg-[var(--elev1)] text-[var(--text-dim)] hover:border-[var(--border-strong)]'}`}
              >
                <PlatformIcon platform={p.id} />{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* url */}
        <Field
          label="Video URL"
          icon={LinkIcon}
          placeholder={platform === 'instagram' ? 'https://www.instagram.com/reel/...' : 'https://www.tiktok.com/@you/video/...'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {/* date + views */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)] mb-2.5">Date posted</label>
            <input
              type="date"
              max={today}
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all"
            />
            <p className="text-[11px] text-[var(--text-faint)] mt-2 leading-snug">
              All data is verified. Submitting false info means losing access to the program.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)] mb-2.5">Views on this video</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 48200, 400k, 1.2m"
              value={claimedViews}
              onChange={(e) => setClaimedViews(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all"
            />
            {claimedViews && parseViews(claimedViews) > 0 && (
              <p className="text-[11px] text-[var(--accent)] mt-1.5 font-semibold">= {parseViews(claimedViews).toLocaleString()} views</p>
            )}
            <p className="text-[11px] text-[var(--text-faint)] mt-2 leading-snug">
              All data is verified. Submitting false info means losing access to the program.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {error && <span className="text-xs text-[var(--danger)] flex items-center gap-1.5 font-semibold"><X size={13} strokeWidth={3} />{error}</span>}
          {success && <span className="text-xs text-[var(--success)] flex items-center gap-1.5 font-semibold"><Check size={13} strokeWidth={3} />Submitted for review</span>}
          <Btn type="submit" disabled={!ready || submitting} iconRight={ArrowRight}>{submitting ? 'Submitting…' : 'Submit for review'}</Btn>
        </div>
      </form>
    </Card>
  );
};

const SubmissionRow = ({ sub, campaign }) => (
  <Card interactive className="p-4 md:p-5">
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl bg-[var(--elev2)] flex items-center justify-center flex-shrink-0">
        <PlatformIcon platform={sub.platform} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{campaign?.title || 'Campaign'}</div>
            <a href={sub.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)] truncate flex items-center gap-1 mt-1 max-w-full">
              <span className="truncate">{sub.url}</span>
              <ExternalLink size={11} className="flex-shrink-0" />
            </a>
          </div>
          <Badge status={sub.status} />
        </div>
        <div className="flex items-center gap-3 mt-2.5 text-xs text-[var(--text-dim)]">
          <span>{fmtDate(sub.submittedAt)}</span>
          {sub.status === 'paid' && <span className="text-[var(--accent)] font-semibold">+{fmtMoney(sub.payout)}</span>}
          {sub.notes && <span className="truncate">· {sub.notes}</span>}
        </div>
      </div>
    </div>
  </Card>
);

const CreatorRewards = ({ campaigns }) => {
  const [filter, setFilter] = useState('active');
  const filtered = campaigns.filter((c) => filter === 'all' ? true : filter === 'active' ? c.active : !c.active);

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Active challenges</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Weekly Rewards</h1>
        <p className="mt-3 text-[var(--text-dim)] max-w-md">Pick a challenge, hit the brief, get paid.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-full bg-[var(--elev1)] border border-[var(--border)] w-fit anim-fade-up anim-d-100">
        {[{ k: 'active', l: 'Active' }, { k: 'ended', l: 'Ended' }, { k: 'all', l: 'All' }].map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`h-9 px-5 rounded-full text-sm font-semibold ${filter === t.k ? 'bg-[var(--accent)] text-black shadow-[0_4px_16px_-4px_var(--accent)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((c, i) => (
          <Card key={c.id} interactive className={`relative overflow-hidden p-7 md:p-8 anim-fade-up anim-d-${Math.min((i + 1) * 100, 500)}`}>
            <div className="flex items-start justify-between mb-5">
              <Badge status={c.active ? 'active' : 'ended'} />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--text-dim)]">Reward</div>
                <div className="font-display font-bold text-2xl md:text-3xl text-[var(--accent)] mt-0.5">{fmtMoney(c.reward)}</div>
              </div>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight">{c.title}</h3>
            <p className="mt-2.5 text-sm text-[var(--text-dim)] leading-relaxed">{c.description}</p>
            <ul className="mt-6 space-y-2">
              {c.requirements.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-[var(--text)]">
                  <Check size={12} className="text-[var(--accent)] mt-0.5 flex-shrink-0" strokeWidth={3} />
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-7 pt-5 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-dim)]">
              <span className="flex items-center gap-1.5"><Calendar size={12} /> Closes {fmtDate(c.endDate)}</span>
              {c.active && <span className="text-[var(--text)] font-semibold">{daysLeft(c.endDate)}d left</span>}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-14 text-center">
          <Trophy size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">No campaigns in this view.</p>
        </Card>
      )}
    </div>
  );
};

const CreatorHistory = ({ user, submissions, campaigns }) => {
  const [filter, setFilter] = useState('all');
  const mine = submissions.filter((s) => s.creatorId === user.id);
  const filtered = filter === 'all' ? mine : mine.filter((s) => s.status === filter);

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Your activity</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Submissions</h1>
        <p className="mt-3 text-[var(--text-dim)]">All links you've submitted, and where they stand.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-full bg-[var(--elev1)] border border-[var(--border)] overflow-x-auto no-scrollbar anim-fade-up anim-d-100">
        {[
          { k: 'all',      l: `All (${mine.length})` },
          { k: 'pending',  l: 'Pending' },
          { k: 'approved', l: 'Approved' },
          { k: 'rejected', l: 'Rejected' },
          { k: 'paid',     l: 'Paid' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${filter === t.k ? 'bg-[var(--accent)] text-black shadow-[0_4px_16px_-4px_var(--accent)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-14 text-center">
          <Inbox size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">Nothing here yet.</p>
        </Card>
      ) : (
        <div className="space-y-2.5 anim-fade-up anim-d-200">
          {filtered.map((s) => <SubmissionRow key={s.id} sub={s} campaign={campaigns.find((c) => c.id === s.campaignId)} />)}
        </div>
      )}
    </div>
  );
};

// ============================================================================
//  ADMIN APP
// ============================================================================
const AdminShell = ({ view, setView, onLogout, theme, setTheme, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = [
    { k: 'a-dash',        label: 'Dashboard',   icon: BarChart3 },
    { k: 'a-submissions', label: 'Submissions', icon: Inbox },
    { k: 'a-creators',    label: 'Creators',    icon: Users },
    { k: 'a-campaigns',   label: 'Campaigns',   icon: Trophy },
  ];

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--bg)]/85 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2.5">
              <Logo small />
              <span className="ml-1 text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1 rounded">Admin</span>
            </div>
            <nav className="hidden lg:flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setView(t.k)}
                  className={`h-10 px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--elev1)]'}`}
                >
                  <t.icon size={14} strokeWidth={2.4} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <Btn variant="ghost" size="sm" icon={LogOut} onClick={onLogout} className="hidden md:inline-flex">Log out</Btn>
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-center">
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-[var(--border)] px-5 py-4 space-y-1 anim-fade-up">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => { setView(t.k); setMenuOpen(false); }}
                className={`w-full h-12 px-4 rounded-2xl text-sm font-semibold flex items-center gap-3 ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)]'}`}
              >
                <t.icon size={15} strokeWidth={2.4} />
                {t.label}
              </button>
            ))}
            <button onClick={() => { onLogout(); setMenuOpen(false); }} className="w-full h-12 px-4 rounded-2xl text-sm font-semibold flex items-center gap-3 text-[var(--danger)]">
              <LogOut size={15} strokeWidth={2.4} />
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
        {children}
      </main>
    </div>
  );
};

const AdminDashboard = ({ creators, submissions, campaigns, setView }) => {
  const pending  = submissions.filter((s) => s.status === 'pending').length;
  const approved = submissions.filter((s) => s.status === 'approved').length;
  const paidTotal = submissions.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.payout || 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.active).length;

  const recent = [...submissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Admin overview</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 anim-fade-up anim-d-100">
        <Stat label="Total creators" value={creators.length} icon={Users} />
        <Stat label="Pending review" value={pending} icon={Clock} />
        <Stat label="Approved" value={approved} icon={CheckCircle2} />
        <Stat label="Paid out" value={fmtMoney(paidTotal)} icon={Wallet} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 anim-fade-up anim-d-200">
        <Card className="p-6 md:p-7 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-xl tracking-tight">Recent submissions</h3>
            <button onClick={() => setView('a-submissions')} className="text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1">
              View all <ChevronRight size={14} />
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] text-center py-8">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((s) => {
                const creator = creators.find((c) => c.id === s.creatorId);
                const campaign = campaigns.find((c) => c.id === s.campaignId);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--elev2)] hover:bg-[var(--bg)]">
                    <div className="w-10 h-10 rounded-full bg-[var(--elev1)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {creator?.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{creator?.name}</div>
                      <div className="text-xs text-[var(--text-dim)] truncate mt-0.5">{campaign?.title}</div>
                    </div>
                    <Badge status={s.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 md:p-7">
          <h3 className="font-display font-bold text-xl tracking-tight mb-6">Active campaigns</h3>
          <div className="space-y-3">
            {campaigns.filter((c) => c.active).map((c) => (
              <div key={c.id} className="p-3.5 rounded-2xl bg-[var(--elev2)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm truncate">{c.title}</span>
                  <span className="font-mono text-xs text-[var(--accent)] font-semibold">{fmtMoney(c.reward)}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)]">{daysLeft(c.endDate)} days left</div>
              </div>
            ))}
            <Btn variant="outline" size="sm" icon={Plus} onClick={() => setView('a-campaigns')} className="w-full mt-2">New campaign</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
};

const AdminSubmissions = ({ submissions, creators, campaigns, onUpdateStatus, onUpdateNotes }) => {
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  const filtered = submissions.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search) {
      const c = creators.find((cr) => cr.id === s.creatorId);
      const q = search.toLowerCase();
      return (c?.name.toLowerCase().includes(q) || c?.tiktok.toLowerCase().includes(q) || c?.instagram.toLowerCase().includes(q));
    }
    return true;
  });

  const saveNote = (id) => { onUpdateNotes(id, noteText); setEditingNote(null); setNoteText(''); };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Review queue</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Submissions</h1>
        <p className="mt-3 text-[var(--text-dim)]">Review, approve, reject, mark as paid.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 anim-fade-up anim-d-100">
        <div className="flex gap-1 p-1 rounded-full bg-[var(--elev1)] border border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            { k: 'all',      l: 'All' },
            { k: 'pending',  l: 'Pending' },
            { k: 'approved', l: 'Approved' },
            { k: 'rejected', l: 'Rejected' },
            { k: 'paid',     l: 'Paid' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${filter === t.k ? 'bg-[var(--accent)] text-black shadow-[0_4px_16px_-4px_var(--accent)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-xs ml-auto">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creator…"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--elev1)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">No submissions match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-3 anim-fade-up anim-d-200">
          {filtered.map((s) => {
            const creator = creators.find((c) => c.id === s.creatorId);
            const campaign = campaigns.find((c) => c.id === s.campaignId);
            return (
              <Card key={s.id} className="p-5">
                <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--elev2)] flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {creator?.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{creator?.name}</span>
                        <Badge status={s.status} />
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-dim)] flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Music2 size={11} />{creator?.tiktok}</span>
                        <span className="flex items-center gap-1"><Instagram size={11} />{creator?.instagram}</span>
                        <span>· {fmtDate(s.submittedAt)}</span>
                      </div>
                      <div className="mt-2 text-sm font-medium">{campaign?.title} <span className="text-[var(--text-dim)] font-normal">· {fmtMoney(s.payout)}</span></div>
                      <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 text-xs text-[var(--text-dim)] hover:text-[var(--accent)] flex items-center gap-1 truncate">
                        <PlatformIcon platform={s.platform} size={11} />
                        <span className="truncate">{s.url}</span>
                        <ExternalLink size={11} className="flex-shrink-0" />
                      </a>

                      {editingNote === s.id ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add a note…"
                            className="flex-1 h-9 px-3 rounded-xl bg-[var(--elev2)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)]"
                          />
                          <Btn size="sm" onClick={() => saveNote(s.id)}>Save</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => { setEditingNote(null); setNoteText(''); }}>×</Btn>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingNote(s.id); setNoteText(s.notes || ''); }} className="mt-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1 transition-colors">
                          <Edit3 size={10} />
                          {s.notes ? <span className="italic">"{s.notes}"</span> : 'Add note'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 md:items-end">
                    {s.status === 'pending' && (
                      <>
                        <Btn size="sm" variant="success" icon={Check} onClick={() => onUpdateStatus(s.id, 'approved')}>Approve</Btn>
                        <Btn size="sm" variant="danger"  icon={X}     onClick={() => onUpdateStatus(s.id, 'rejected')}>Reject</Btn>
                      </>
                    )}
                    {s.status === 'approved' && (
                      <Btn size="sm" icon={Banknote} onClick={() => onUpdateStatus(s.id, 'paid')}>Mark paid</Btn>
                    )}
                    {(s.status === 'rejected' || s.status === 'paid') && (
                      <Btn size="sm" variant="ghost" onClick={() => onUpdateStatus(s.id, 'pending')}>Reopen</Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminCreators = ({ creators, submissions }) => {
  const [search, setSearch] = useState('');
  const filtered = creators.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.tiktok.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Creator directory</span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Creators</h1>
          <p className="mt-3 text-[var(--text-dim)]">{creators.length} active accounts.</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators…"
            className="w-72 max-w-full h-11 pl-11 pr-4 rounded-full bg-[var(--elev1)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 anim-fade-up anim-d-100">
        {filtered.map((c) => {
          const subs = submissions.filter((s) => s.creatorId === c.id);
          const earned = subs.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.payout || 0), 0);
          return (
            <Card key={c.id} interactive className="p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--elev2)] flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate mt-0.5">{c.email}</div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-[var(--elev2)]">
                  <div className="text-[var(--text-dim)] flex items-center gap-1 mb-1"><Music2 size={11} /> TikTok</div>
                  <div className="font-semibold truncate">{c.tiktok}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--elev2)]">
                  <div className="text-[var(--text-dim)] flex items-center gap-1 mb-1"><Instagram size={11} /> Instagram</div>
                  <div className="font-semibold truncate">{c.instagram}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-dim)]">{subs.length} submissions</span>
                <span className="font-mono text-[var(--accent)] font-semibold">{fmtMoney(earned)} earned</span>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-14 text-center">
          <Users size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">No creators match your search.</p>
        </Card>
      )}
    </div>
  );
};

const AdminCampaigns = ({ campaigns, onSave, onDelete, onToggleActive }) => {
  const blank = { id: null, title: '', reward: 0, bonus: 0, description: '', requirements: '', startDate: '', endDate: '', active: true };
  const [editing, setEditing] = useState(null);

  const startNew = () => setEditing(blank);
  const startEdit = (c) => setEditing({ ...c, requirements: c.requirements.join('\n') });
  const save = () => {
    if (!editing.title) return;
    const payload = {
      ...editing,
      reward: Number(editing.reward) || 0,
      bonus: Number(editing.bonus) || 0,
      requirements: editing.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    onSave(payload);
    setEditing(null);
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">Manage rewards</span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-2 tracking-tight">Campaigns</h1>
          <p className="mt-3 text-[var(--text-dim)]">Create, edit, toggle weekly rewards.</p>
        </div>
        <Btn icon={Plus} onClick={startNew}>New campaign</Btn>
      </div>

      {editing && (
        <Card className="p-6 anim-fade-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-xl tracking-tight">{editing.id ? 'Edit campaign' : 'New campaign'}</h3>
            <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-[var(--elev2)] hover:bg-[var(--elev1)] flex items-center justify-center"><X size={15} /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Campaign title" placeholder="Launch Week Sprint" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <Field label="Reward ($)" type="number" placeholder="250" value={editing.reward} onChange={(e) => setEditing({ ...editing, reward: e.target.value })} />
            <Field label="Bonus ($, optional)" type="number" placeholder="500" value={editing.bonus} onChange={(e) => setEditing({ ...editing, bonus: e.target.value })} />
            <div /> {/* spacer */}
            <Field label="Start date" type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
            <Field label="End date"   type="date" value={editing.endDate}   onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
            <div className="md:col-span-2">
              <Textarea label="Description" placeholder="What should creators post?" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="Requirements (one per line)" placeholder={'Post 1 TikTok or Reel\nTag @madintel\nHit 5,000+ views in 72 hours'} value={editing.requirements} onChange={(e) => setEditing({ ...editing, requirements: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-xs uppercase tracking-[0.08em] font-medium text-[var(--text-dim)]">Active</span>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, active: !editing.active })}
                  className={`w-11 h-6 rounded-full transition-all relative ${editing.active ? 'bg-[var(--accent)]' : 'bg-[var(--elev2)]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${editing.active ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </label>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn onClick={save} icon={Check}>{editing.id ? 'Save' : 'Create'}</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 anim-fade-up anim-d-100">
        {campaigns.map((c) => (
          <Card key={c.id} className="p-6">
            <div className="flex items-start justify-between mb-3">
              <Badge status={c.active ? 'active' : 'ended'} />
              <div className="text-right">
                <div className="font-display font-bold text-2xl text-[var(--accent)]">{fmtMoney(c.reward)}</div>
                {c.bonus > 0 && <div className="text-xs text-[var(--text-dim)]">+ {fmtMoney(c.bonus)} bonus</div>}
              </div>
            </div>
            <h3 className="font-display font-bold text-xl tracking-tight">{c.title}</h3>
            <p className="mt-2 text-sm text-[var(--text-dim)] leading-relaxed line-clamp-2">{c.description}</p>
            <div className="mt-4 text-xs text-[var(--text-dim)] flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(c.startDate)} – {fmtDate(c.endDate)}</span>
              <span>· {c.requirements.length} requirements</span>
            </div>
            <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
              <button onClick={() => onToggleActive(c.id)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-2 transition-colors">
                <span className={`w-9 h-5 rounded-full relative transition-all ${c.active ? 'bg-[var(--accent)]' : 'bg-[var(--elev2)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${c.active ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
                {c.active ? 'Active' : 'Inactive'}
              </button>
              <div className="flex items-center gap-1.5">
                <Btn size="sm" variant="ghost" icon={Edit3} onClick={() => startEdit(c)}>Edit</Btn>
                <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => { if (confirm(`Delete "${c.title}"?`)) onDelete(c.id); }}>Delete</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
//  ROOT APP
// ============================================================================
const App = () => {
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState('light');
  const [inviteCode, setInviteCode] = useState('');

  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [submissions, setSubmissions] = useState([]);
  const [deal, setDeal] = useState(null); // the active reward campaign (tiers + examples)

  // ─── SUPABASE SERVICE LAYER ───
  // Recent submissions + creators load live. Campaigns stay local (no table).
  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from('video_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSubmissions(data.map(mapSubmissionRow));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') console.info('[madrewards] talking to Supabase at:', SUPABASE_URL_IN_USE);
    (async () => {
      try {
        const [subs, crs, dl] = await Promise.all([
          supabase.from('video_submissions').select('*').order('created_at', { ascending: false }),
          supabase.from('creators').select('*').order('created_at', { ascending: false }),
          supabase.from('campaigns').select('*').eq('active', true).limit(1).maybeSingle(),
        ]);
        if (!subs.error && subs.data) setSubmissions(subs.data.map(mapSubmissionRow));
        if (!crs.error && crs.data) setCreators(crs.data.map(mapCreatorRow));
        if (!dl.error && dl.data) setDeal(dl.data);
      } catch (e) {
        console.error('[madrewards] initial load failed:', friendlyError(e));
      }
    })();
  }, []);

  // Restore a logged-in session on load (real Supabase Auth accounts).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sUser = data?.session?.user;
        if (sUser) {
          const { data: cr } = await supabase.from('creators').select('*').eq('id', sUser.id).maybeSingle();
          setUser(cr ? mapCreatorRow(cr) : { id: sUser.id, name: (sUser.email || 'creator').split('@')[0], email: sUser.email });
          setView('dash');
        }
      } catch (e) {
        console.error('[madrewards] session restore failed:', friendlyError(e));
      }
    })();
  }, []);

  // Real login via Supabase Auth.
  const handleLogin = async ({ email, password }) => {
    const em = (email || '').trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) throw new Error('Wrong email or password.');
    const uid = data.user.id;
    const { data: cr } = await supabase.from('creators').select('*').eq('id', uid).maybeSingle();
    setUser(cr ? mapCreatorRow(cr) : { id: uid, name: em.split('@')[0], email: em });
    setView('dash');
    await loadSubmissions();
  };

  // Validate an invite code (server-side; codes are not public-readable).
  const checkInvite = async (code) => {
    const res = await fetch('/api/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', code }),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) throw new Error(data.error || 'That code is not valid or already used.');
    return true;
  };

  // Redeem code -> create real account -> sign in.
  const handleSignup = async (form) => {
    const res = await fetch('/api/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'redeem',
        code: form.code,
        name: form.name,
        email: (form.email || '').trim().toLowerCase(),
        password: form.password,
        phone: form.phone || null,
        cashapp: form.cashapp || null,
        tiktok: form.tiktok || null,
        instagram: form.instagram || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create your account.');
    await handleLogin({ email: form.email, password: form.password });
  };

  // Public "request an invite" -> lands in admin Requests tab.
  const submitRequest = async (form) => {
    const { error } = await supabase.from('signup_requests').insert({
      name: form.name,
      email: (form.email || '').trim().toLowerCase(),
      tiktok_handle: form.tiktok || null,
      instagram_handle: form.instagram || null,
      note: form.note || null,
    });
    if (error) throw new Error(friendlyError(error));
  };

  const handleAdminLogin = () => { setIsAdmin(true); setView('a-dash'); };
  const handleLogout = async () => { try { await supabase.auth.signOut(); } catch {} setUser(null); setIsAdmin(false); setView('landing'); };

  // Insert into video_submissions. Throws a specific message on failure.
  const handleNewSubmission = async (data) => {
    let error;
    try {
      ({ error } = await supabase.from('video_submissions').insert({
        creator_id: data.creatorId,
        video_url: data.url,
        platform: data.platform,
        posted_at: data.postedAt || null,
        claimed_views: Number(data.claimedViews) || 0,
      }));
    } catch (e) {
      throw new Error(friendlyError(e)); // network/DNS failures land here
    }
    if (error) throw new Error(friendlyError(error));
    await loadSubmissions();
  };

  // Admin write-backs stay local until the protected admin route exists.
  const updateStatus = (id, status) => {
    setSubmissions((subs) => subs.map((s) => s.id === id ? { ...s, status } : s));
  };
  const updateNotes = (id, notes) => {
    setSubmissions((subs) => subs.map((s) => s.id === id ? { ...s, notes } : s));
  };

  const saveCampaign = (data) => {
    if (data.id) {
      setCampaigns((cs) => cs.map((c) => c.id === data.id ? data : c));
    } else {
      setCampaigns((cs) => [{ ...data, id: uid('cmp') }, ...cs]);
    }
  };
  const deleteCampaign = (id) => setCampaigns((cs) => cs.filter((c) => c.id !== id));
  const toggleActive = (id) => setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, active: !c.active } : c));

  const go = (v) => setView(v);

  // ─── RENDER ───
  let body;
  if (view === 'landing') {
    body = <LandingPage go={go} theme={theme} setTheme={setTheme} />;
  } else if (view === 'login') {
    body = <LoginPage go={go} onLogin={handleLogin} />;
  } else if (view === 'invite') {
    body = <InvitePage go={go} onValid={async (code) => { await checkInvite(code); setInviteCode(code); setView('signup'); }} />;
  } else if (view === 'signup') {
    body = inviteCode
      ? <SignupPage go={go} code={inviteCode} onSignup={handleSignup} />
      : <InvitePage go={go} onValid={async (code) => { await checkInvite(code); setInviteCode(code); setView('signup'); }} />;
  } else if (view === 'request') {
    body = <RequestPage go={go} onSubmit={submitRequest} />;
  } else if (user) {
    body = (
      <CreatorShell user={user} view={view} setView={setView} onLogout={handleLogout} theme={theme} setTheme={setTheme}>
        {view === 'dash'    && <CreatorDashboard user={user} deal={deal} submissions={submissions} onSubmit={handleNewSubmission} setView={setView} />}
        {view === 'rewards' && <CreatorRewards   campaigns={campaigns} />}
        {view === 'history' && <CreatorHistory   user={user} submissions={submissions} campaigns={campaigns} />}
      </CreatorShell>
    );
  } else {
    body = <LandingPage go={go} theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className={`madvault-root ${theme === 'light' ? 'light' : ''}`}>
      <ThemeStyles />
      {body}
    </div>
  );
};

export default App;

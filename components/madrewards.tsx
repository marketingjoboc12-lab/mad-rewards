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
const LOGO_DARK = 'data:image/jpeg;base64,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';   // white logo — shown on dark theme
const LOGO_LIGHT = 'data:image/jpeg;base64,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'; // black logo — shown on light theme

const Logo = ({ small = false }) => {
  const sz = small ? 'h-12 md:h-14' : 'h-16 md:h-20';
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

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
import {
  PAY_PER_100K, WEEKLY_CAP, CAP_VIEWS, LEVELS, levelFor, RULES_UPDATED, LOGO_PFP_BONUS, REUP_VIDEOS, MILESTONES, MONTHLY_PRIZES,
  computeWeek, computeMonth, computeReup, lifetimeViews, payForViews, todayLocal, weekStart, monthStart, addDays,
  weekLabel, monthLabel, earliestSubmittableDate, normalizeVideoUrl,
} from '@/lib/rewards';

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
//  Creators only load their own videos + payouts. Reward rules: lib/rewards.ts.
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
  posted: (r.posted_at || r.created_at || '').slice(0, 10),
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
  rulesAccepted: !!r.rules_accepted_at && r.rules_accepted_at >= RULES_UPDATED,
});

// Shape the reward math in lib/rewards.ts expects.
const toSubLike = (s) => ({ posted: s.posted, status: s.status, views: s.views, claimedViews: s.claimedViews });

const fmtMoney = (n) => `$${Number(n).toLocaleString('en-US')}`;
const fmtDate = (s) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// 'YYYY-MM-DD' -> 'Oct 5' without timezone shifting the day.
const fmtDay = (d) => (d ? `${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}` : '—');
const fmtViews = (n) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}K` : String(n));
const toUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
// US phone: keeps max 10 digits and shows them as (432) 432-4324 while typing.
const fmtPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d.length ? `(${d}` : '';
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
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

    /* ── leak protection ── */
    .leak-guard { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .leak-guard input, .leak-guard textarea { -webkit-user-select: text; user-select: text; }
    .leak-blur > *:not(style) { filter: blur(22px); }
    @media print { .leak-guard { display: none !important; } }

    /* ── game layer: bright, glossy, bubbly ── */
    :root { --ink: #f5f5f5; --lime: #C6FF3D; --grape: #7B5CFF; --gum: #FF4FB8; --sun: #FFD23F; --sky: #38BDF8;
            --card: #17171b; --card-line: rgba(255,255,255,0.08); }
    .light { --ink: #14141a; --card: #ffffff; --card-line: rgba(20,20,26,0.06); }
    .font-arcade { font-family: 'Fredoka', 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.01em; }
    .stk { background-color: var(--card); border: 1px solid var(--card-line); border-radius: 28px; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 14px 32px -18px rgba(76,60,160,.28); }
    .stk-chip { border: 1px solid var(--card-line); border-radius: 999px; }
    .stk-btn { border-radius: 999px; background: linear-gradient(135deg, #7DB6FF, #3F7BE6); color: #fff !important; box-shadow: 0 10px 24px -8px rgba(63,123,230,.45), inset 0 1px 0 rgba(255,255,255,.35); transition: transform .15s var(--ease), box-shadow .15s var(--ease); }
    .stk-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px rgba(63,123,230,.55), inset 0 1px 0 rgba(255,255,255,.35); }
    .stk-btn:active { transform: translateY(1px) scale(.98); }
    .stk-btn:focus-visible, .stk-chip:focus-visible, .pill-btn:focus-visible { outline: 3px solid var(--grape); outline-offset: 3px; }
    .gloss { position: relative; overflow: hidden; }
    .gloss::after { content: ''; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(255,255,255,.45) 0%, rgba(255,255,255,0) 42%); pointer-events: none; border-radius: inherit; }
    .g-blue  { background: linear-gradient(135deg, #8CC2FF 0%, #5E9CF3 50%, #3F7BE6 100%); }
    .g-level { background: radial-gradient(70% 90% at 82% 45%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 60%), linear-gradient(135deg, #8CC2FF 0%, #5E9CF3 48%, #3F7BE6 100%); }
    .ok-pill { background: #E3F7EC; color: #16794A; }
    .g-lime  { background: linear-gradient(135deg, #D7FF5C 0%, #7EE34B 55%, #23C483 100%); }
    .g-grape { background: linear-gradient(135deg, #A78BFA 0%, #7B5CFF 50%, #5B3DF5 100%); }
    .g-gum   { background: linear-gradient(135deg, #FF9AD5 0%, #FF4FB8 55%, #E0338F 100%); }
    .g-sky   { background: linear-gradient(135deg, #8BE3FF 0%, #38BDF8 55%, #2563EB 100%); }
    .g-sun   { background: linear-gradient(135deg, #FFE68A 0%, #FFD23F 50%, #FFA62B 100%); }
    .badge-orb { width: 108px; height: 108px; border-radius: 34px; display: grid; place-items: center; font-size: 58px;
                 background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.25) 45%, rgba(255,255,255,.05) 70%);
                 box-shadow: inset 0 -6px 14px rgba(0,0,0,.12), 0 12px 28px -10px rgba(0,0,0,.35); transform: rotate(-6deg); }
    .pill-btn { border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 13px; white-space: nowrap; }
    .rank { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; font-family: 'Fredoka', sans-serif; font-weight: 700; flex-shrink: 0; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .tilt-l, .tilt-r { transform: none; }
    .prize-card { transition: transform .2s var(--ease), box-shadow .2s var(--ease); box-shadow: 0 12px 26px -16px rgba(30,60,140,.35); }
    .prize-card:hover { transform: translateY(-4px) rotate(-.6deg); box-shadow: 0 22px 34px -16px rgba(30,60,140,.45); }
    .prize-card:active { transform: scale(.98); }
    .prize-card:focus-visible { outline: 3px solid #3F7BE6; outline-offset: 3px; }
    @keyframes growBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .grow-bar { transform-origin: left; animation: growBar .9s var(--ease) both .15s; }
    @keyframes shineSweep { 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(220%) skewX(-18deg); } }
    .shine-once { position: relative; overflow: hidden; }
    .shine-once::before { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: shineSweep 1.4s var(--ease) .4s both; pointer-events: none; z-index: 1; }
    .lift { transition: transform .18s var(--ease); } .lift:hover { transform: translateY(-2px); }
    @media (prefers-reduced-motion: reduce) { .grow-bar, .shine-once::before { animation: none; } .prize-card:hover { transform: none; } }
    @keyframes popIn { 0% { transform: scale(.7); opacity: 0 } 70% { transform: scale(1.04); opacity: 1 } 100% { transform: scale(1) } }
    .pop-in { animation: popIn .45s var(--ease) both; }
    @keyframes confettiFall { 0% { transform: translateY(-40px) rotate(0); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(420px) rotate(320deg); opacity: 0 } }
    .confetti-bit { position: absolute; top: 0; animation: confettiFall 1.6s ease-in both; }
    @media (prefers-reduced-motion: reduce) { .pop-in, .confetti-bit { animation: none; } .confetti-bit { display: none; } }
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

    /* swipe-to-agree arrow nudge */
    @keyframes slideHint { 0%,100% { transform: translateX(0); opacity: .5 } 50% { transform: translateX(6px); opacity: 1 } }
    .slide-hint { display: inline-block; animation: slideHint 1.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .slide-hint { animation: none; } }

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

const Logo = ({ small = false }) => {
  const sz = small ? 'h-9 md:h-10' : 'h-14 md:h-16';
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center">
      <img src="/logo-dark.png"  alt="Mad Rewards" className={`logo-dark ${sz} w-auto select-none`}  draggable={false} />
      <img src="/logo-light.png" alt="Mad Rewards" className={`logo-light ${sz} w-auto select-none`} draggable={false} />
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
    { tag: '$100', label: 'Per 100K views', sub: 'Paid every week' },
    { tag: '+$10', label: 'Logo bonus', sub: 'Every week' },
    { tag: 'Re-up', label: 'Free product', sub: '10 videos in 2 weeks' },
  ],
  month: [
    { tag: 'Merch', label: 'Socks, shirt + hat, duffle', sub: 'Unlocks with your views' },
    { tag: 'iPhone', label: 'iPhone 18 Pro', sub: 'Monthly prize' },
    { tag: 'Mexico', label: 'Trip for 2', sub: 'Monthly prize' },
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
            Post content, get paid for your views every week. Invite-only.
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
        <p className="text-center text-sm text-[var(--text-dim)] mt-6 md:mt-8">Log in to see all rewards and track your progress.</p>
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
            <h3 className="font-display font-bold text-xl">Don't have a code?</h3>
            <p className="text-sm text-[var(--text-dim)] mt-2">Request an invite and we'll review it.</p>
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
        <p className="mt-4 text-sm text-[var(--text-dim)]">Log in to your account.</p>
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

const InvitePage = ({ go, onValid, initialCode = '' }) => {
  const [code, setCode] = useState(initialCode);
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
  const [form, setForm] = useState({ name: '', email: '', phone: '', cashapp: '', password: '', confirm: '', tiktok: '', instagram: '', smsOptIn: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    if (form.smsOptIn && !form.phone) { setError('Add your phone number to get texts.'); return; }
    if (form.phone && form.phone.replace(/\D/g, '').length !== 10) { setError('Enter a 10-digit phone number, like (555) 000-0000.'); return; }
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
          <Field label="Phone" icon={Phone} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(555) 000-0000" value={form.phone} onChange={(e) => up('phone', fmtPhone(e.target.value))} />
          <Field label="Cash App" icon={DollarSign} placeholder="$yourcashtag" value={form.cashapp} onChange={(e) => up('cashapp', e.target.value)} />
        </div>
        <Field label="Password" icon={Lock} type="password" autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={(e) => up('password', e.target.value)} />
        <Field label="Confirm password" icon={Lock} type="password" autoComplete="new-password" placeholder="Type it again" value={form.confirm} onChange={(e) => up('confirm', e.target.value)} error={form.confirm && form.confirm !== form.password ? "Passwords don't match" : undefined} />
        <label className="flex items-start gap-3 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={form.smsOptIn} onChange={(e) => up('smsOptIn', e.target.checked)} className="mt-1 w-4 h-4 accent-[#3F7BE6]" />
          <span>Text me updates about my rewards and weekly reminders. <span className="text-[var(--text-dim)]">Msg &amp; data rates may apply. Reply STOP to opt out.</span></span>
        </label>
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
        <p className="mt-4 text-sm text-[var(--text-dim)]">We'll review your request and email you an invite code if you're approved.</p>
        <div className="mt-7"><Btn variant="outline" onClick={() => go('landing')}>Back home</Btn></div>
      </div>
    </AuthFrame>
  );
  return (
    <AuthFrame go={go}>
      <div className="text-center mb-8">
        <h1 className="font-display font-extrabold text-4xl tracking-tight">Request an invite.</h1>
        <p className="mt-4 text-sm text-[var(--text-dim)]">Mad Rewards is invite-only. Share a few details and we'll be in touch.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" icon={UserIcon} placeholder="Maya Okafor" value={form.name} onChange={(e) => up('name', e.target.value)} />
        <Field label="Email" icon={Mail} type="email" placeholder="you@email.com" value={form.email} onChange={(e) => up('email', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="TikTok" icon={AtSign} placeholder="@you" value={form.tiktok} onChange={(e) => up('tiktok', e.target.value)} />
          <Field label="Instagram" icon={AtSign} placeholder="@you" value={form.instagram} onChange={(e) => up('instagram', e.target.value)} />
        </div>
        <Textarea label="Anything else? (optional)" placeholder="Follower count, the kind of content you post" value={form.note} onChange={(e) => up('note', e.target.value)} />
        {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-3">{error}</div>}
        <div className="pt-2"><Btn type="submit" size="lg" className="w-full" disabled={busy} iconRight={ArrowRight}>{busy ? 'Sending…' : 'Send request'}</Btn></div>
      </form>
    </AuthFrame>
  );
};

const CreatorShell = ({ user, view, setView, onLogout, theme, setTheme, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = [
    { k: 'dash',    label: 'Home',      icon: BarChart3 },
    { k: 'drop',    label: 'Drop videos', icon: Upload },
    { k: 'history', label: 'My drops',  icon: Inbox },
    { k: 'rewards', label: 'How it works', icon: Trophy },
    { k: 'contact', label: 'Contact', icon: Mail },
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
      <Watermark user={user} />
    </div>
  );
};

// ────────────────────────── LEAK PROTECTION ──────────────────────────
// No website can truly block a phone screenshot, so we make leaks traceable
// (name watermark on every page) and harder (blur when the app/tab loses focus,
// no text copying, no right-click, blank when printed).
const Watermark = ({ user }) => {
  const label = [user.name, user.tiktok && `@${String(user.tiktok).replace(/^@/, '')}`].filter(Boolean).join(' · ') || user.email || 'Mad Rewards';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'><text x='10' y='95' transform='rotate(-24 150 85)' font-family='sans-serif' font-size='15' font-weight='700' fill='rgb(127,127,127)'>${label.replace(/[<>&'"]/g, '')}</text></svg>`;
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[60] pointer-events-none select-none"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, opacity: 0.035 }}
    />
  );
};

const useLeakGuard = (on) => {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!on) return;
    const hide = () => setHidden(true);
    const show = () => setHidden(document.visibilityState === 'hidden');
    const vis = () => setHidden(document.visibilityState === 'hidden');
    const block = (e) => e.preventDefault();
    const keys = (e) => {
      // PrintScreen and common screenshot / save / print shortcuts
      if (e.key === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && ['p', 's'].includes(e.key.toLowerCase())) || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))) {
        e.preventDefault(); hide(); setTimeout(show, 1500);
        try { navigator.clipboard?.writeText(''); } catch {}
      }
    };
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', vis);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      window.removeEventListener('keydown', keys);
    };
  }, [on]);
  return hidden;
};

// ────────────────────────── RULES (shown in the swipe-to-agree popup + Rewards tab) ──────────────────────────
const VIDEO_STYLES = [
  { t: 'Reaction', d: 'React to the hit, the flavor, the vibe' },
  { t: 'Review / talking', d: 'Talk to the camera, keep it real' },
  { t: 'Voice-over', d: 'Narrate over clips of the device' },
  { t: 'Music / trend', d: 'Use a trending sound or format' },
  { t: 'Clean device shot', d: 'A clear, good-looking video of the device' },
  { t: 'Blinker', d: 'You taking a blinker, on camera' },
  { t: 'Unboxing', d: 'Open it up and show it off' },
  { t: 'Meme', d: 'A meme format with the device in it' },
  { t: 'Cartoon / AI video', d: 'Animated or AI-made, brand clearly shown' },
]

const Sec = ({ title, children }) => (
  <section>
    <h3 className="font-arcade text-2xl mb-3">{title}</h3>
    <div className="space-y-5">{children}</div>
  </section>
);
const Row = ({ left, right }) => (
  <div className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5"><span>{left}</span><b className="text-right">{right}</b></div>
);

const RulesContent = () => (
  <div className="space-y-9 text-sm leading-relaxed">
    <div className="gloss g-grape rounded-[24px] p-5 text-white">
      <div className="font-arcade text-xl">You've been personally invited</div>
      <p className="mt-1.5">Mad Rewards is invite-only. You're one of a small group of creators we picked, and this offer is just for you.</p>
    </div>

    <Sec title="How it works">
      <ol className="space-y-1.5">
        <li><b>1.</b> Post your Mad Labs videos <b>Sunday to Saturday</b>.</li>
        <li><b>2.</b> Submit every link and its views here by <b>Saturday 11:59pm</b>.</li>
        <li><b>3.</b> Missed it? We'll email you Sunday. That's your <b>last call</b>.</li>
        <li><b>4.</b> On <b>Monday</b> we check every video by hand.</li>
        <li><b>5.</b> You get paid to your Cash App.</li>
      </ol>

      <div className="gloss g-level rounded-[24px] p-4 text-white">
        <div className="text-xs font-bold opacity-80">This week's rate</div>
        <div className="font-arcade text-xl">{fmtCash(PAY_PER_100K)} for every 100K views</div>
        <p className="mt-1">250K = {fmtCash(payForViews(250_000))} · 500K = {fmtCash(payForViews(500_000))} · 1M = {fmtCash(payForViews(1_000_000))}</p>
      </div>

      <div>
        <div className="font-bold mb-1">Your views stack</div>
        <p>Every video you post that week adds into one total. Example: 10 videos × 10K views = 100K = {fmtCash(PAY_PER_100K)}. Your all-time views keep stacking toward free merch, and your monthly views toward the big prizes.</p>
      </div>

      <div>
        <div className="font-bold mb-1">Extras</div>
        <Row left="Mad Labs logo as your profile pic" right={`+${fmtCash(LOGO_PFP_BONUS)}/week`} />
        <Row left={`${REUP_VIDEOS} videos in 2 weeks`} right="Free re-up" />
        {MILESTONES.map((ms) => <Row key={ms.views} left={`${fmtViews(ms.views)} total views`} right={ms.label} />)}
        {MONTHLY_PRIZES.map((p) => <Row key={p.views} left={`${fmtViews(p.views)} views in one month`} right={p.label} />)}
      </div>

      <div className="rounded-[24px] p-4 bg-[var(--elev2)]">
        <div className="font-bold mb-1">This week's cap</div>
        <p>This week you can earn up to <b>{fmtCash(WEEKLY_CAP)}</b> from views (that's {fmtViews(CAP_VIEWS)} views). Anything past that still counts toward free merch and the big prizes.</p>
      </div>

      <p className="text-xs text-[var(--text-dim)]">Rates, caps and rewards can change from week to week. Whatever you see on your dashboard is what that week pays.</p>
    </Sec>

    <Sec title="The rules">
      <div>
        <div className="font-bold mb-2">Video styles that work</div>
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_STYLES.map((v) => (
            <div key={v.t} className="p-3 rounded-2xl bg-[var(--elev2)]">
              <div className="font-semibold">{v.t}</div>
              <div className="text-xs text-[var(--text-dim)] mt-0.5">{v.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="gloss g-sun rounded-[24px] p-4 text-black">
        <div className="font-arcade text-base">Show the brand</div>
        <p className="mt-1">The <b>MAD LABS</b> name has to be <b>clearly visible</b> in every video. No brand on screen, no pay.</p>
      </div>

      <ul className="space-y-2">
        <li><b>This site stays private.</b> No screenshots, screen recordings or sharing anything from here. Every page is marked with your name.</li>
        <li><b>Don't mention the program.</b> Never say you're part of Mad Rewards, talk about payouts, or say how you got the product, in any video, caption, comment or story.</li>
        <li><b>Videos must still be up when we check Monday.</b> TikTok and Instagram often remove cannabis content. Removed videos don't count.</li>
        <li><b>Report real views.</b> We verify every number. False numbers end your spot in the program.</li>
        <li><b>One link, one submission.</b> Each video counts once.</li>
        <li><b>Late videos don't count.</b> Anything not submitted by Sunday 11:59pm misses that week.</li>
        <li><b>Breaking the rules gets you removed.</b> If we find you broke any of these rules, or you don't post any content, you'll be disqualified and taken out of the program.</li>
      </ul>
    </Sec>
  </div>
);

// Drag the knob all the way right to agree. Keyboard: focus the knob, press → or Enter.
const SlideToAgree = ({ onDone, label = 'Slide to agree', locked = false }) => {
  const track = useRef(null);
  const startX = useRef(0);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const KNOB = 56;
  const max = () => (track.current?.offsetWidth || 320) - KNOB - 8;
  const finish = () => { setX(max()); setDone(true); onDone(); };
  return (
    <div ref={track} className="relative h-[68px] rounded-full bg-[var(--elev2)] overflow-hidden select-none touch-none">
      <div className="absolute inset-y-0 left-0 bg-[#3F7BE6]/20" style={{ width: x + KNOB + 8, transition: drag ? 'none' : 'width .3s' }} />
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--text-dim)] pointer-events-none">
        {done ? "You're in 🤝" : locked ? '🔒 Scroll to the end to unlock' : <>{label} <span className="ml-2 slide-hint">→→</span></>}
      </div>
      <button
        type="button"
        aria-label={label}
        disabled={locked}
        className="absolute top-[6px] left-[6px] w-14 h-14 rounded-full disabled:opacity-30 g-blue text-white shadow-[0_6px_16px_-6px_rgba(29,79,224,.8)] flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--grape)]"
        style={{ transform: `translateX(${x}px)`, transition: drag ? 'none' : 'transform .3s' }}
        onPointerDown={(e) => { if (done) return; setDrag(true); startX.current = e.clientX - x; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag) setX(Math.max(0, Math.min(max(), e.clientX - startX.current))); }}
        onPointerUp={() => { if (!drag) return; setDrag(false); if (x >= max() * 0.88) finish(); else setX(0); }}
        onKeyDown={(e) => { if (!done && (e.key === 'ArrowRight' || e.key === 'Enter')) { e.preventDefault(); finish(); } }}
      >
        {done ? <Check size={22} strokeWidth={3} /> : <ArrowRight size={22} strokeWidth={3} />}
      </button>
    </div>
  );
};

const RulesGate = ({ user, onAccept }) => {
  const [error, setError] = useState('');
  const [readAll, setReadAll] = useState(false);
  const body = useRef(null);
  const checkEnd = () => {
    const el = body.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadAll(true);
  };
  useEffect(() => { checkEnd(); }, []);
  const accept = async () => {
    setError('');
    try { await onAccept(); } catch (e) { setError(friendlyError(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6">
      <div className="stk w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-b-none sm:rounded-[24px] bg-[var(--bg)] pop-in">
        <div className="px-6 pt-6 pb-3">
          <h2 className="font-arcade text-3xl mt-1">Welcome, {(user.name || '').split(' ')[0] || 'there'}</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">Read how it works and the rules, then slide to agree.</p>
        </div>
        <div ref={body} onScroll={checkEnd} className="px-6 pb-6 overflow-y-auto flex-1">
          <RulesContent />
        </div>
        <div className="p-6 pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-dim)] mb-3 text-center">By sliding, you confirm you read it all and agree.</p>
          <SlideToAgree onDone={accept} label="I read it all & agree" locked={!readAll} />
          {error && <p className="text-xs text-[var(--danger)] mt-3 text-center font-semibold">{error}</p>}
        </div>
      </div>
    </div>
  );
};

// ────────────────────────── GAME LAYER ──────────────────────────
const fmtCash = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// Ticks a number up from 0 once on mount (skipped for reduced motion).
const useCountUp = (target, ms = 900) => {
  const [v, setV] = useState(target);
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) { setV(target); return; }
    first.current = false;
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !target) { setV(target); return; }
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
};

const Confetti = () => {
  const colors = ['#7FB8FF', '#3D7BEA', '#FFD23F', '#FF8AC6', '#B8F0D2', '#C7B8FF'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="confetti-bit rounded-sm" style={{ left: `${(i * 47) % 100}%`, animationDelay: `${(i % 7) * 0.07}s`, width: 7 + (i % 3) * 2, height: 11 + (i % 2) * 4, background: colors[i % colors.length] }} />
      ))}
    </div>
  );
};

// Glossy winged badge with the M, like a game rank emblem.
const MEmblem = ({ size = 132 }) => (
  <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden className="drop-shadow-[0_14px_22px_rgba(30,70,170,.35)]">
    <defs>
      <linearGradient id="emWing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6F2FF" /><stop offset="1" stopColor="#7FB0F5" /></linearGradient>
      <linearGradient id="emHex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9FD0FF" /><stop offset=".55" stopColor="#4A8BF0" /><stop offset="1" stopColor="#2559D6" /></linearGradient>
      <linearGradient id="emInner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5FA2FF" /><stop offset="1" stopColor="#2A62DC" /></linearGradient>
      <linearGradient id="emShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></linearGradient>
    </defs>
    <g fill="url(#emWing)" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5">
      <path d="M44 52 L8 34 L18 62 L4 66 L22 86 L12 94 L40 104 Z" />
      <path d="M116 52 L152 34 L142 62 L156 66 L138 86 L148 94 L120 104 Z" />
    </g>
    <path d="M80 14 L132 44 L132 104 L80 134 L28 104 L28 44 Z" fill="url(#emHex)" stroke="#fff" strokeOpacity=".85" strokeWidth="3" />
    <path d="M80 30 L118 52 L118 96 L80 118 L42 96 L42 52 Z" fill="url(#emInner)" stroke="#CFE6FF" strokeOpacity=".9" strokeWidth="2" />
    <path d="M80 14 L132 44 L132 70 Q80 58 28 70 L28 44 Z" fill="url(#emShine)" />
    <image href="/m-logo-white.png" x="52" y="46" width="56" height="56" />
    <path d="M80 4 L90 14 L80 22 L70 14 Z" fill="#F4D7A8" stroke="#fff" strokeWidth="1.5" />
  </svg>
);

// Popup after a creator submits videos.
const DropCelebration = ({ data, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
    <div className="stk relative overflow-hidden w-full max-w-sm p-7 text-center pop-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Videos submitted">
      <Confetti />
      <div className="relative">
        <div className="flex justify-center"><MEmblem size={96} /></div>
        <h2 className="font-arcade text-3xl mt-3">{data.count > 1 ? `${data.count} videos submitted` : 'Video submitted'}</h2>
        {data.levelUp && <p className="mt-1 font-semibold">New level: {LEVELS[data.level].name} {LEVELS[data.level].emoji}</p>}
        <div className="mt-5 inline-block rounded-full g-blue text-white font-arcade text-2xl px-5 py-2">+{fmtCash(data.added)}</div>
        <p className="mt-3 text-sm text-[var(--text-dim)]">Added to this week's total, pending Monday's check.</p>
        <button onClick={onClose} className="stk-btn mt-6 w-full h-14 font-bold text-base">Done</button>
      </div>
    </div>
  </div>
);

// ────────────────────────── CREATOR DASHBOARD ──────────────────────────
const CreatorDashboard = ({ user, deal, submissions, payouts, onSubmit, setView }) => {
  const mine = submissions;
  const subs = mine.map(toSubLike);
  const today = todayLocal();
  const thisWeek = weekStart(today);
  const lastCall = today === thisWeek; // Sunday: last week's videos can still go in
  const w = computeWeek(subs, thisWeek, true);
  const m = computeMonth(subs, monthStart(today), true);
  const reup = computeReup(subs, today, true);
  const life = lifetimeViews(subs, undefined, true);
  const paidTotal = payouts.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const lvl = levelFor(w.views);
  const nextLvl = LEVELS[lvl + 1] || null;
  const lvlPct = nextLvl ? Math.round(((w.views - LEVELS[lvl].at) / (nextLvl.at - LEVELS[lvl].at)) * 100) : 100;
  const bag = useCountUp(w.pay);
  const [board, setBoard] = useState(null);
  const examples = deal?.examples || [];
  const nf = (n) => Number(n || 0).toLocaleString();

  const loadBoard = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) { setBoard([]); return; }
      const res = await fetch('/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
      setBoard(res.ok ? (await res.json()).rows || [] : []);
    } catch { setBoard([]); }
  };
  useEffect(() => { loadBoard(); }, [submissions.length]);

  // latest announcement banner (dismissed ones stay hidden on this device)
  const [news, setNews] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
      const a = data?.[0];
      let seen = '';
      try { seen = localStorage.getItem('mr_seen_announcement') || ''; } catch {}
      if (a && a.id !== seen) setNews(a);
    })().catch(() => {});
  }, []);
  const dismissNews = () => {
    try { localStorage.setItem('mr_seen_announcement', news.id); } catch {}
    setNews(null);
  };


  // every reward in one swipeable row
  const prizes = [
    ...MILESTONES.map((ms, i) => ({ key: 'm' + i, emoji: ms.emoji, image: ms.image, label: ms.label, kind: 'Free merch', need: `${fmtViews(ms.views)} total views`, how: 'Unlocks with your total views since you joined. Shipped to you once.', have: life, goal: ms.views, got: life >= ms.views, grad: i === 0 ? 'g-sky' : 'g-sun' })),
    ...MONTHLY_PRIZES.map((p, i) => ({ key: 'p' + i, emoji: p.emoji, image: p.image, label: p.label, kind: 'Monthly prize', need: `${fmtViews(p.views)} in one month`, how: `Hit ${fmtViews(p.views)} views in a single calendar month. Resets on the 1st.`, have: m.views, goal: p.views, got: m.views >= p.views, grad: i === 0 ? 'g-grape' : 'g-gum' })),
  ].map((p) => ({ ...p, pct: Math.min(100, Math.round((p.have / p.goal) * 100)) }));
  const [openPrize, setOpenPrize] = useState(null);
  const top3 = (board || []).slice(0, 3);
  const rest = (board || []).slice(3);
  const meRow = (board || []).find((r) => r.me);
  const medal = ['🥇', '🥈', '🥉'];
  const rankBg = ['g-sun', 'bg-[#E5E7EB] text-black', 'bg-[#F5B98A] text-black'];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {openPrize && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6" onClick={() => setOpenPrize(null)}>
          <div className="stk w-full sm:max-w-md overflow-hidden rounded-b-none sm:rounded-[28px] pop-in" role="dialog" aria-modal="true" aria-label={openPrize.label} onClick={(e) => e.stopPropagation()}>
            <div className={`relative ${openPrize.kind === 'Free merch' ? 'bg-[#F0EAE4] aspect-square' : 'bg-black aspect-[16/10]'}`}>
              {openPrize.image
                ? <img src={openPrize.image} alt={openPrize.label} className={`absolute inset-0 w-full h-full ${openPrize.kind === 'Free merch' ? 'object-contain' : 'object-cover'}`} />
                : <span className="absolute inset-0 grid place-items-center text-7xl" aria-hidden>{openPrize.emoji}</span>}
              <button onClick={() => setOpenPrize(null)} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-6">
              <span className="text-xs font-bold text-[#3F7BE6]">{openPrize.kind}</span>
              <h3 className="font-arcade text-2xl mt-1">{openPrize.label}</h3>
              <p className="text-sm text-[var(--text-dim)] mt-1.5">{openPrize.how}</p>
              <div className="mt-5 flex items-end justify-between">
                <div className="font-arcade text-3xl">{openPrize.pct}%</div>
                <div className="text-sm text-[var(--text-dim)]">{nf(openPrize.have)} / {nf(openPrize.goal)} views</div>
              </div>
              <div className="mt-2 h-3 rounded-full bg-[var(--elev2)] overflow-hidden">
                <div className="h-full rounded-full g-blue grow-bar" style={{ width: `${Math.max(openPrize.pct, 3)}%` }} />
              </div>
              <p className="mt-3 text-sm font-semibold">
                {openPrize.got ? "You've unlocked this. We'll reach out to get it to you." : `${nf(openPrize.goal - openPrize.have)} more views to go.`}
              </p>
              <button onClick={() => { setOpenPrize(null); setView('drop'); }} className="stk-btn mt-5 w-full h-13 py-3.5 font-bold">Drop your videos</button>
            </div>
          </div>
        </div>
      )}
      {news && (
        <div className="gloss g-grape rounded-[24px] p-5 text-white flex items-start gap-4 pop-in" role="status">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold opacity-80">New from Mad Rewards</div>
            <div className="font-arcade text-xl mt-0.5">{news.title}</div>
            {news.body && <p className="text-sm mt-1 opacity-90 whitespace-pre-line">{news.body}</p>}
          </div>
          <button onClick={dismissNews} className="w-9 h-9 rounded-full bg-white/20 grid place-items-center flex-shrink-0" aria-label="Dismiss announcement"><X size={16} /></button>
        </div>
      )}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="font-arcade text-3xl md:text-4xl leading-none">Welcome back, {user.name.split(' ')[0]}.</h1>
        <span className={`stk-chip px-3 py-1.5 text-xs font-bold ${lastCall ? 'g-sun text-black border-transparent' : 'bg-[var(--card)]'}`}>
          {lastCall ? 'Last call: closes tonight 11:59pm' : 'Submit by Sat 11:59pm'}
        </span>
      </div>

      {/* LEVEL CARD — the one big moment */}
      <section className="gloss shine-once g-level rounded-[32px] p-6 md:p-8 text-white shadow-[0_24px_48px_-20px_rgba(63,123,230,.45)]" aria-label="This week">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-bold">This week's level</span>
            <div className="font-arcade text-3xl md:text-4xl mt-3 leading-none">{LEVELS[lvl].name}</div>
            <div className="mt-4 text-sm font-semibold opacity-80">Earned this week</div>
            <div className="font-arcade text-6xl md:text-7xl leading-none tabular-nums">{fmtCash(Math.round(bag * 100) / 100)}</div>
          </div>
          <div className="flex-shrink-0 -mr-2 -mt-2"><MEmblem size={128} /></div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full rounded-full bg-white grow-bar" style={{ width: `${lvlPct}%` }} />
            </div>
            <span className="w-11 h-11 rounded-full bg-white/95 border-2 border-white grid place-items-center text-xl shadow-[0_0_0_4px_rgba(255,255,255,.25)]" aria-hidden>{nextLvl ? '🔒' : '👑'}</span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {nextLvl
              ? <>{fmtViews(nextLvl.at - w.views)} more views to unlock {nextLvl.emoji} {nextLvl.name}</>
              : <>You hit this week's cap.</>}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1.5">{nf(w.views)} views</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">{w.videos} video{w.videos === 1 ? '' : 's'}</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">This week: {fmtCash(PAY_PER_100K)} per 100K</span>
        </div>
        <p className="mt-3 text-xs opacity-70">Uses the views you entered. Final after we check on Monday.</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => setView('drop')} className="stk-btn flex items-center justify-center gap-2 h-16 font-arcade text-xl"><span>Drop your videos</span></button>
        <button onClick={() => setView('ideas')} className="flex flex-col items-center justify-center h-16 rounded-full bg-[var(--card)] border border-[#3F7BE6]/30 text-[#3F7BE6] shadow-[0_10px_24px_-14px_rgba(63,123,230,.45)] hover:bg-[#3F7BE6]/5">
          <span className="font-arcade text-lg leading-tight">Video ideas</span>
          <span className="text-xs font-semibold text-[var(--text-dim)]">Out of ideas? See what's working</span>
        </button>
      </div>

      {/* LEADERBOARD */}
      <section className="stk p-5 md:p-6" aria-label="Leaderboard">
        <div className="flex items-center justify-between">
          <h2 className="font-arcade text-xl">Top this week</h2>
          {meRow && meRow.views > 0 && <span className="pill-btn g-blue text-white">You're #{meRow.rank}</span>}
        </div>
        {board === null ? (
          <p className="mt-4 text-sm text-[var(--text-dim)]">Loading the board…</p>
        ) : board.every((r) => r.views === 0) ? (
          <p className="mt-4 text-sm text-[var(--text-dim)]">Nobody's on the board yet this week. Submit a video to take #1.</p>
        ) : (
          <>
            <div className="mt-4 space-y-2.5 rounded-[22px] border-2 border-dashed border-[#3F7BE6]/35 p-3">
              {top3.map((r, i) => (
                <div key={r.rank} className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.me ? 'bg-[#3F7BE6]/10' : ''}`}>
                  <span className={`rank ${rankBg[i]}`}>{r.rank}</span>
                  <span className="text-2xl" aria-hidden>{medal[i]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.name}{r.me && ' (you)'}</div>
                    {r.handle && <div className="text-xs text-[var(--text-dim)] truncate">{r.handle}</div>}
                  </div>
                  <div className="font-arcade text-lg">{fmtViews(r.views)}</div>
                </div>
              ))}
            </div>
            {rest.length > 0 && (
              <div className="mt-3 space-y-1">
                {rest.map((r) => (
                  <div key={r.rank} className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.me ? 'bg-[#3F7BE6]/10' : ''}`}>
                    <span className="rank bg-[var(--elev2)]">{r.rank}</span>
                    <div className="min-w-0 flex-1 font-semibold truncate">{r.name}{r.me && ' (you)'}</div>
                    <div className="font-bold text-sm">{fmtViews(r.views)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* REWARDS ROW */}
      <section aria-label="Rewards">
        <h2 className="font-arcade text-xl mb-1">Rewards to unlock</h2>
        <p className="text-sm text-[var(--text-dim)]">Extras on top of your weekly cash. Tap any reward for details.</p>
        <h3 className="font-bold mt-5 mb-2.5">Free merch <span className="font-normal text-[var(--text-dim)]">· your total views · {nf(life)} so far</span></h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {prizes.filter((p) => p.kind === 'Free merch').map((p) => (
            <button key={p.key} onClick={() => setOpenPrize(p)} className="prize-card text-left rounded-[24px] overflow-hidden bg-[var(--card)] border border-[var(--card-line)]">
              <div className="relative aspect-[4/5] bg-[#F0EAE4]">
                <img src={p.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-contain" />
                {p.got && <span className="absolute top-2.5 right-2.5 rounded-full ok-pill px-2.5 py-1 text-[11px] font-bold">Unlocked</span>}
              </div>
              <div className="p-3.5">
                <div className="font-bold leading-tight text-sm">{p.label}</div>
                <div className="text-xs text-[var(--text-dim)] mt-0.5">{p.got ? 'You earned this' : p.need}</div>
                <div className="mt-2.5 h-2 rounded-full bg-[var(--elev2)] overflow-hidden">
                  <div className="h-full rounded-full g-blue grow-bar" style={{ width: `${Math.max(p.pct, 3)}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <h3 className="font-bold mt-7 mb-2.5">Monthly prizes <span className="font-normal text-[var(--text-dim)]">· one month's views · {nf(m.views)} in {monthLabel(monthStart(today)).split(' ')[0]}</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {prizes.filter((p) => p.kind === 'Monthly prize').map((p) => (
            <button key={p.key} onClick={() => setOpenPrize(p)} className="prize-card text-left rounded-[24px] overflow-hidden bg-[var(--card)] border border-[var(--card-line)]">
              <div className="relative aspect-[16/10] bg-black">
                <img src={p.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                {p.got && <span className="absolute top-2.5 right-2.5 rounded-full ok-pill px-2.5 py-1 text-[11px] font-bold">Won</span>}
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-bold leading-tight">{p.label}</div>
                  <div className="text-xs text-[var(--text-dim)] mt-0.5">{p.got ? 'You won this month' : p.need}</div>
                  <div className="mt-2.5 h-2 rounded-full bg-[var(--elev2)] overflow-hidden">
                    <div className="h-full rounded-full g-blue grow-bar" style={{ width: `${Math.max(p.pct, 3)}%` }} />
                  </div>
                </div>
                <div className="font-arcade text-xl">{p.pct}%</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SIDE QUESTS */}
      <section className="stk p-2" aria-label="Side quests">
        <h2 className="font-arcade text-xl px-4 pt-3 pb-1">Bonuses</h2>
        {[
          { emoji: '📦', title: 'Free re-up', sub: `Post ${REUP_VIDEOS} videos by ${fmtDay(reup.end)}`, pill: reup.videos >= REUP_VIDEOS ? 'Earned ✓' : `${reup.videos}/${REUP_VIDEOS}`, done: reup.videos >= REUP_VIDEOS },
          { emoji: '😎', title: 'Logo pfp', sub: 'Make the Mad Labs logo your profile pic', pill: `+${fmtCash(LOGO_PFP_BONUS)}/wk`, done: false },
        ].map((q) => (
          <div key={q.title} className="lift flex items-center gap-3 rounded-[22px] p-3 hover:bg-[var(--elev2)]">
            <span className="w-12 h-12 rounded-2xl bg-[var(--elev2)] grid place-items-center text-2xl flex-shrink-0" aria-hidden>{q.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{q.title}</div>
              <div className="text-xs text-[var(--text-dim)]">{q.sub}</div>
            </div>
            <span className={`pill-btn ${q.done ? 'ok-pill' : 'g-blue text-white'}`}>{q.pill}</span>
          </div>
        ))}
      </section>

      <section aria-label="Recent videos">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-arcade text-xl">Your videos</h2>
          <button onClick={() => setView('history')} className="text-sm font-bold underline underline-offset-4">See all</button>
        </div>
        {mine.length === 0 ? (
          <div className="stk p-8 text-center">
            <div className="text-4xl">🎬</div>
            <p className="mt-2 font-semibold">No videos yet. Tap "Drop your videos" to add this week's.</p>
          </div>
        ) : (
          <div className="space-y-2.5">{mine.slice(0, 3).map((s) => <SubmissionRow key={s.id} sub={s} />)}</div>
        )}
      </section>
    </div>
  );
};

// ────────────────────────── DROP PAGE (bulk upload) ──────────────────────────
let rowSeq = 0;
const blankRow = (date, key = `row-${++rowSeq}`) => ({ key, url: '', postedAt: date, views: '', error: '' });
const inputCls = 'w-full h-12 px-4 rounded-2xl bg-[var(--elev2)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-4 focus:ring-[var(--grape)]/25 transition-shadow';

const DropPage = ({ submissions, onSubmit, setView }) => {
  const today = todayLocal();
  const minDate = earliestSubmittableDate(today);
  const [rows, setRows] = useState(() => [blankRow(today, 'start-1'), blankRow(today, 'start-2'), blankRow(today, 'start-3')]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(null);
  const [note, setNote] = useState('');

  const subs = submissions.map(toSubLike);
  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: '' } : r)));
  const filled = rows.filter((r) => r.url.trim() || r.views.trim());
  const rowProblem = (r) => {
    if (!r.url.trim()) return 'Add the video link.';
    if (detectPlatform(r.url) === 'other') return 'Use a TikTok or Instagram link.';
    if (!r.postedAt || r.postedAt < minDate || r.postedAt > today) return 'Pick a date from this week.';
    if (!(parseViews(r.views) > 0)) return 'Add the views.';
    return '';
  };
  const ready = filled.length > 0 && filled.every((r) => !rowProblem(r));
  const addViews = filled.reduce((a, r) => a + (parseViews(r.views) || 0), 0);

  // estimate what these drops add to each week's bag
  const estimateAdded = (list) => {
    const extra = list.map((r) => ({ posted: r.postedAt, status: 'pending', views: 0, claimedViews: parseViews(r.views) }));
    const weeks = [...new Set(list.map((r) => weekStart(r.postedAt)))];
    return weeks.reduce((a, wk) => a + computeWeek([...subs, ...extra], wk, true).pay - computeWeek(subs, wk, true).pay, 0);
  };
  const preview = ready ? estimateAdded(filled) : 0;

  const addPasted = () => {
    const links = pasted.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /tiktok\.com|instagram\.com/i.test(x));
    if (!links.length) { setNote('No TikTok or Instagram links found in what you pasted.'); return; }
    const keep = rows.filter((r) => r.url.trim() || r.views.trim());
    setRows([...keep, ...links.map((u) => ({ ...blankRow(today), url: u }))]);
    setPasted(''); setPasting(false);
    setNote(`Added ${links.length} link${links.length > 1 ? 's' : ''}. Now fill in the date and views for each.`);
  };

  const dropAll = async () => {
    if (!ready || busy) return;
    setBusy(true); setNote('');
    const before = levelFor(computeWeek(subs, weekStart(today), true).views);
    const done = [], failed = [];
    for (const r of filled) {
      try {
        await onSubmit({ url: r.url.trim(), platform: detectPlatform(r.url), postedAt: r.postedAt, claimedViews: parseViews(r.views) });
        done.push(r);
      } catch (e) {
        failed.push({ ...r, error: e?.message || 'Could not submit this one.' });
      }
    }
    setBusy(false);
    setRows(failed.length ? failed : [blankRow(today)]);
    if (done.length) {
      const added = estimateAdded(done);
      const after = levelFor(computeWeek([...subs, ...done.map((r) => ({ posted: r.postedAt, status: 'pending', views: 0, claimedViews: parseViews(r.views) }))], weekStart(today), true).views);
      setParty({ added, count: done.length, level: after, levelUp: after > before });
    }
    if (failed.length) setNote(`${failed.length} video${failed.length > 1 ? 's' : ''} didn't go through. Check the red notes below.`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {party && <DropCelebration data={party} onClose={() => { setParty(null); if (!rows.some((r) => r.error)) setView('dash'); }} />}

      <div>
        <button onClick={() => setView('dash')} className="text-sm font-bold text-[var(--text-dim)] hover:text-[var(--text)]">← Home</button>
        <h1 className="font-arcade text-4xl md:text-5xl mt-3">Drop your videos</h1>
        <p className="mt-2 text-[var(--text-dim)]">Add every video you posted this week, one row each, then drop them all at once. Due Saturday 11:59pm.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPasting((p) => !p)} className="pill-btn bg-[var(--elev2)]">Paste a list of links</button>
        <button onClick={() => setView('ideas')} className="pill-btn bg-[var(--elev2)]">Video ideas</button>
      </div>

      {pasting && (
        <div className="stk p-5">
          <label htmlFor="paste" className="font-bold">Paste your links</label>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">One per line or separated by spaces. We'll make a row for each.</p>
          <textarea id="paste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} className={`${inputCls} h-auto py-3 mt-3 resize-y`} placeholder={'https://www.tiktok.com/@you/video/123\nhttps://www.instagram.com/reel/abc'} />
          <button onClick={addPasted} className="stk-btn mt-3 h-12 px-5 font-bold">Add these links</button>
        </div>
      )}

      {note && <p className="text-sm font-semibold" role="status">{note}</p>}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className={`stk p-4 md:p-5 ${r.error ? 'ring-2 ring-[var(--danger)]' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-arcade text-lg flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl g-blue text-white grid place-items-center text-sm">{i + 1}</span>
                {r.url && detectPlatform(r.url) !== 'other' ? <PlatformIcon platform={detectPlatform(r.url)} size={16} /> : null}
              </span>
              {rows.length > 1 && (
                <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-sm font-bold text-[var(--text-dim)] hover:text-[var(--danger)]" aria-label={`Remove video ${i + 1}`}>Remove ✕</button>
              )}
            </div>
            <label className="sr-only" htmlFor={`url-${r.key}`}>Video link</label>
            <input id={`url-${r.key}`} value={r.url} onChange={(e) => set(r.key, { url: e.target.value })} placeholder="TikTok or Instagram link" inputMode="url" className={inputCls} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor={`date-${r.key}`} className="block text-xs font-bold text-[var(--text-dim)] mb-1.5">Date posted</label>
                <input id={`date-${r.key}`} type="date" min={minDate} max={today} value={r.postedAt} onChange={(e) => set(r.key, { postedAt: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor={`views-${r.key}`} className="block text-xs font-bold text-[var(--text-dim)] mb-1.5">Views right now</label>
                <input id={`views-${r.key}`} value={r.views} onChange={(e) => set(r.key, { views: e.target.value })} placeholder="48200, 400k, 1.2m" inputMode="decimal" className={inputCls} />
              </div>
            </div>
            {(r.error || ((r.url || r.views) && rowProblem(r))) && (
              <p className="text-xs font-semibold text-[var(--danger)] mt-2">{r.error || rowProblem(r)}</p>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => setRows((rs) => [...rs, blankRow(rs[rs.length - 1]?.postedAt || today)])} className="w-full h-14 rounded-[24px] border-2 border-dashed border-[#3F7BE6]/40 font-bold text-[#3F7BE6] hover:bg-[#3F7BE6]/5">
        + Add another video
      </button>

      <div className="stk p-5 sticky bottom-4 z-20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <b>{filled.length} video{filled.length === 1 ? '' : 's'}</b> · {Number(addViews).toLocaleString()} views
            {ready && preview > 0 && <span className="text-[var(--text-dim)]"> · ≈ +{fmtCash(preview)}</span>}
          </div>
          <button onClick={dropAll} disabled={!ready || busy} className="stk-btn h-14 px-7 font-arcade text-lg w-full sm:w-auto disabled:opacity-40 disabled:pointer-events-none">
            {busy ? 'Submitting…' : `Submit ${filled.length > 1 ? `all ${filled.length}` : 'video'}`}
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-faint)] mt-2">All data is verified. Submitting false info means losing access to the program.</p>
      </div>
    </div>
  );
};

// ────────────────────────── CONTACT PAGE ──────────────────────────
const TOPICS = [
  { k: 'suggestion', l: 'Suggestion' },
  { k: 'question', l: 'Question' },
  { k: 'problem', l: 'Problem' },
];

const ContactPage = ({ user, setView }) => {
  const [topic, setTopic] = useState('suggestion');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) { setError('Write a message first.'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.from('messages').insert({ creator_id: user.id, topic, body: body.trim() });
    setBusy(false);
    if (err) { setError(friendlyError(err)); return; }
    setSent(true); setBody('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <button onClick={() => setView('dash')} className="text-sm font-bold text-[var(--text-dim)] hover:text-[var(--text)]">← Home</button>
        <h1 className="font-arcade text-4xl md:text-5xl mt-3">Contact us</h1>
        <p className="mt-2 text-[var(--text-dim)]">Have a suggestion, a question or a problem? Send it here and the team will see it.</p>
      </div>

      {sent ? (
        <div className="stk p-7 text-center">
          <div className="font-arcade text-2xl">Message sent</div>
          <p className="text-sm text-[var(--text-dim)] mt-2">Thanks. We read every message.</p>
          <div className="flex gap-3 justify-center mt-5">
            <button onClick={() => setSent(false)} className="pill-btn bg-[var(--elev2)]">Send another</button>
            <button onClick={() => setView('dash')} className="pill-btn g-blue text-white">Back home</button>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="stk p-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-bold mb-2">What's it about?</legend>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t) => (
                <button type="button" key={t.k} onClick={() => setTopic(t.k)} aria-pressed={topic === t.k}
                  className={`pill-btn ${topic === t.k ? 'g-blue text-white' : 'bg-[var(--elev2)]'}`}>{t.l}</button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="contact-body" className="text-sm font-bold">Message</label>
            <textarea id="contact-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000}
              placeholder="Tell us what's on your mind"
              className="mt-2 w-full p-4 rounded-2xl bg-[var(--elev2)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-4 focus:ring-[#3F7BE6]/25 resize-y" />
          </div>
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={busy} className="stk-btn h-14 w-full font-bold disabled:opacity-50">{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      )}
    </div>
  );
};

// ────────────────────────── IDEAS PAGE ──────────────────────────
const IdeasPage = ({ deal, setView }) => {
  const examples = deal?.examples || [];
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => setView('dash')} className="text-sm font-bold text-[var(--text-dim)] hover:text-[var(--text)]">← Home</button>
        <h1 className="font-arcade text-4xl md:text-5xl mt-3">Video ideas</h1>
        <p className="mt-2 text-[var(--text-dim)]">Out of ideas? See what's working and recreate it in your own style. Keep MAD LABS clearly visible.</p>
      </div>
      {examples.length === 0 ? (
        <div className="stk p-8 text-center">
          <div className="text-4xl">🎬</div>
          <p className="mt-2 font-semibold">Examples are coming soon. Check back in a bit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map((x, i) => (
            <a key={i} href={toUrl(x)} target="_blank" rel="noreferrer" className="stk flex items-center gap-4 p-4 hover:-translate-y-0.5 transition-transform">
              <span className={`w-12 h-12 rounded-2xl grid place-items-center text-white flex-shrink-0 ${i % 3 === 0 ? 'g-grape' : i % 3 === 1 ? 'g-gum' : 'g-sky'}`}><PlatformIcon platform={detectPlatform(x)} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Example {i + 1}</span>
                <span className="block text-xs text-[var(--text-dim)] truncate">{x}</span>
              </span>
              <span className="pill-btn g-blue text-white">Watch ↗</span>
            </a>
          ))}
        </div>
      )}
      <div className="stk p-5">
        <h2 className="font-arcade text-xl mb-3">Styles that work</h2>
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_STYLES.map((v) => (
            <div key={v.t} className="p-3 rounded-2xl bg-[var(--elev2)]">
              <div className="font-semibold text-sm">{v.t}</div>
              <div className="text-xs text-[var(--text-dim)] mt-0.5">{v.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SubmissionRow = ({ sub }) => {
  const verified = sub.status === 'approved' || sub.status === 'paid';
  return (
    <div className="stk rounded-[24px] p-4 md:p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[var(--elev2)] flex items-center justify-center flex-shrink-0">
          <PlatformIcon platform={sub.platform} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">Posted {fmtDay(sub.posted)}</div>
              <a href={sub.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)] truncate flex items-center gap-1 mt-1 max-w-full">
                <span className="truncate">{sub.url}</span>
                <ExternalLink size={11} className="flex-shrink-0" />
              </a>
            </div>
            <Badge status={sub.status} />
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-xs text-[var(--text-dim)]">
            <span>{Number(verified ? sub.views : sub.claimedViews).toLocaleString()} views {verified ? '· verified' : '· your count'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CreatorRewards = () => (
  <div className="space-y-8 md:space-y-10">
    <div className="anim-fade-up">
      <h1 className="font-arcade text-4xl md:text-5xl mt-2">How it works</h1>
      <p className="mt-3 text-[var(--text-dim)] max-w-md">Everything you agreed to, in one place.</p>
    </div>
    <div className="stk p-6 md:p-8 max-w-2xl">
      <RulesContent />
    </div>
  </div>
);

const CreatorHistory = ({ submissions }) => {
  const [filter, setFilter] = useState('all');
  const mine = submissions;
  const filtered = filter === 'all' ? mine : mine.filter((s) => s.status === filter);

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="anim-fade-up">
        <h1 className="font-arcade text-4xl md:text-5xl">Your videos</h1>
        <p className="mt-3 text-[var(--text-dim)]">Every video you've submitted and where it's at.</p>
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
          {filtered.map((s) => <SubmissionRow key={s.id} sub={s} />)}
        </div>
      )}
    </div>
  );
};

// ============================================================================
//  ROOT APP
// ============================================================================
// Each screen has its own #address so Back and refresh work.
const CREATOR_VIEWS = ['dash', 'drop', 'ideas', 'history', 'rewards', 'contact'];
const PUBLIC_VIEWS = ['login', 'invite', 'signup', 'request'];
const hashView = () => (typeof window === 'undefined' ? '' : window.location.hash.slice(1));

const App = () => {
  const [view, setViewRaw] = useState('landing');
  const [booting, setBooting] = useState(true); // checking for a saved login
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  // Switch screens and add a browser history entry.
  const setView = (v) => {
    setViewRaw(v);
    if (typeof window !== 'undefined' && hashView() !== v) {
      window.history.pushState(null, '', v === 'landing' ? window.location.pathname : `#${v}`);
    }
  };
  // Back / forward buttons.
  useEffect(() => {
    const onPop = () => {
      const v = hashView();
      setViewRaw(v || (userRef.current ? 'dash' : 'landing'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [theme, setTheme] = useState('light');
  const [inviteCode, setInviteCode] = useState('');
  const [linkCode, setLinkCode] = useState(''); // code from an emailed invite link

  const [submissions, setSubmissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [deal, setDeal] = useState(null); // active campaign row — only used for example videos now

  // ─── SUPABASE SERVICE LAYER ───
  // A creator only ever loads their OWN videos + payouts (RLS enforces this too).
  const loadMine = async (uid) => {
    const [subs, pays] = await Promise.all([
      supabase.from('video_submissions').select('*').eq('creator_id', uid).order('created_at', { ascending: false }),
      supabase.from('payouts').select('*').eq('creator_id', uid).order('paid_at', { ascending: false }),
    ]);
    if (!subs.error && subs.data) setSubmissions(subs.data.map(mapSubmissionRow));
    if (!pays.error && pays.data) setPayouts(pays.data);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') console.info('[madrewards] talking to Supabase at:', SUPABASE_URL_IN_USE);
    (async () => {
      try {
        const { data } = await supabase.from('campaigns').select('*').eq('active', true).limit(1).maybeSingle();
        if (data) setDeal(data);
      } catch (e) {
        console.error('[madrewards] initial load failed:', friendlyError(e));
      }
    })();
  }, []);

  const enterAs = async (authUser, restoring = false) => {
    const { data: cr } = await supabase.from('creators').select('*').eq('id', authUser.id).maybeSingle();
    setUser(cr ? mapCreatorRow(cr) : { id: authUser.id, name: (authUser.email || 'creator').split('@')[0], email: authUser.email, rulesAccepted: false });
    if (restoring) {
      // refresh: stay on the page they were on
      const v = CREATOR_VIEWS.includes(hashView()) ? hashView() : 'dash';
      setViewRaw(v);
      window.history.replaceState(null, '', `#${v}`);
    } else {
      setView('dash');
    }
    await loadMine(authUser.id);
  };

  // Restore a logged-in session on load (real Supabase Auth accounts).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const inviteParam = new URLSearchParams(window.location.search).get('invite');
        if (inviteParam && !data?.session?.user) {
          // came from the invite email: open sign-up with the code filled in
          setLinkCode(inviteParam.trim().toUpperCase());
          window.history.replaceState(null, '', `${window.location.pathname}#invite`);
          setViewRaw('invite');
        } else if (data?.session?.user) await enterAs(data.session.user, true);
        else if (PUBLIC_VIEWS.includes(hashView())) setViewRaw(hashView());
      } catch (e) {
        console.error('[madrewards] session restore failed:', friendlyError(e));
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Real login via Supabase Auth.
  const handleLogin = async ({ email, password }) => {
    const em = (email || '').trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) throw new Error('Wrong email or password.');
    await enterAs(data.user);
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
        smsOptIn: !!form.smsOptIn,
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

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null); setSubmissions([]); setPayouts([]); setView('landing');
  };

  // Creator swiped to agree to the rules.
  const acceptRules = async () => {
    const { error } = await supabase.rpc('accept_rules');
    if (error) throw error;
    setUser((u) => ({ ...u, rulesAccepted: true }));
  };

  // Insert into video_submissions. Throws a specific message on failure.
  const handleNewSubmission = async (data) => {
    let error;
    try {
      ({ error } = await supabase.from('video_submissions').insert({
        creator_id: user.id,
        video_url: normalizeVideoUrl(data.url),
        platform: data.platform,
        posted_at: data.postedAt || null,
        claimed_views: Number(data.claimedViews) || 0,
      }));
    } catch (e) {
      throw new Error(friendlyError(e)); // network/DNS failures land here
    }
    if (error?.code === '23505') throw new Error('That video was already submitted.');
    if (error) throw new Error(friendlyError(error));
    await loadMine(user.id);
  };

  const go = (v) => setView(v);

  // Logged-in creator pages: blur when focus leaves, no copying.
  const guarded = !!user && !['landing', 'login', 'invite', 'signup', 'request'].includes(view);
  const leakHidden = useLeakGuard(guarded);

  // ─── RENDER ───
  let body;
  if (booting) {
    body = <div className="min-h-screen grid place-items-center"><Logo /></div>;
  } else if (view === 'landing') {
    body = <LandingPage go={go} theme={theme} setTheme={setTheme} />;
  } else if (view === 'login') {
    body = <LoginPage go={go} onLogin={handleLogin} />;
  } else if (view === 'invite') {
    body = <InvitePage go={go} initialCode={linkCode} onValid={async (code) => { await checkInvite(code); setInviteCode(code); setView('signup'); }} />;
  } else if (view === 'signup') {
    body = inviteCode
      ? <SignupPage go={go} code={inviteCode} onSignup={handleSignup} />
      : <InvitePage go={go} onValid={async (code) => { await checkInvite(code); setInviteCode(code); setView('signup'); }} />;
  } else if (view === 'request') {
    body = <RequestPage go={go} onSubmit={submitRequest} />;
  } else if (user) {
    body = (
      <CreatorShell user={user} view={view} setView={setView} onLogout={handleLogout} theme={theme} setTheme={setTheme}>
        {view === 'dash'    && <CreatorDashboard user={user} deal={deal} submissions={submissions} payouts={payouts} onSubmit={handleNewSubmission} setView={setView} />}
        {view === 'drop'    && <DropPage submissions={submissions} onSubmit={handleNewSubmission} setView={setView} />}
        {view === 'ideas'   && <IdeasPage deal={deal} setView={setView} />}
        {view === 'rewards' && <CreatorRewards />}
        {view === 'contact' && <ContactPage user={user} setView={setView} />}
        {view === 'history' && <CreatorHistory submissions={submissions} />}
        {!user.rulesAccepted && <RulesGate user={user} onAccept={acceptRules} />}
      </CreatorShell>
    );
  } else {
    body = <LandingPage go={go} theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className={`madvault-root ${theme === 'light' ? 'light' : ''} ${guarded ? 'leak-guard' : ''} ${guarded && leakHidden ? 'leak-blur' : ''}`}>
      <ThemeStyles />
      {body}
    </div>
  );
};

export default App;

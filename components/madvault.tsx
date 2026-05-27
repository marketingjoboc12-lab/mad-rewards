import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, ArrowUpRight, Check, X, Clock, DollarSign,
  Upload, Calendar, Users, TrendingUp, Settings, LogOut, Menu,
  Trophy, Target, Lock, Mail, Phone, User as UserIcon, AtSign, Plus,
  ChevronRight, Sun, Moon, Filter, Search, MoreVertical,
  CheckCircle2, XCircle, CircleDot, Banknote, ExternalLink,
  Hash, Zap, Award, BarChart3, Eye, Heart, Music2, Instagram,
  Shield, Layers, Inbox, Wallet, ChevronLeft, Edit3, Trash2,
  Link as LinkIcon, FileText, Tag
} from 'lucide-react';

// =============================================================================
//  MAD VAULT — Influencer rewards portal
//  Single-file React app. All data is mocked; swap the service layer for
//  Supabase/Firebase calls when wiring to backend.
// =============================================================================

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

// ────────────────────────── PRIMITIVES ──────────────────────────
const Btn = ({ children, variant = 'primary', size = 'md', className = '', icon: Icon, iconRight: IconRight, ...rest }) => {
  const sizes = {
    sm: 'h-9 px-3.5 text-[13px]',
    md: 'h-11 px-5 text-sm',
    lg: 'h-14 px-7 text-[15px]',
  };
  const variants = {
    primary: 'bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] active:scale-[0.98] shadow-[0_0_0_1px_var(--accent)] hover:shadow-[0_8px_28px_-8px_var(--accent)]',
    outline: 'bg-transparent text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--elev1)] hover:border-[var(--text-dim)]',
    ghost:   'bg-transparent text-[var(--text)] hover:bg-[var(--elev1)]',
    danger:  'bg-[var(--elev1)] text-[var(--danger)] border border-[var(--border)] hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)]',
    success: 'bg-[var(--elev1)] text-[var(--success)] border border-[var(--border)] hover:bg-[var(--success)] hover:text-black hover:border-[var(--success)]',
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.4} />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2.4} />}
    </button>
  );
};

const Field = ({ label, icon: Icon, error, ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-dim)] mb-2">{label}</span>}
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" strokeWidth={2.2} />}
      <input
        {...rest}
        className={`w-full h-12 ${Icon ? 'pl-11' : 'pl-4'} pr-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--elev2)] transition-all`}
      />
    </div>
    {error && <span className="block text-xs text-[var(--danger)] mt-1.5">{error}</span>}
  </label>
);

const Textarea = ({ label, ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-dim)] mb-2">{label}</span>}
    <textarea
      {...rest}
      className="w-full min-h-[88px] p-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] resize-y transition-all"
    />
  </label>
);

const Card = ({ children, className = '', interactive = false, ...rest }) => (
  <div
    {...rest}
    className={`rounded-3xl bg-[var(--elev1)] border border-[var(--border)] ${interactive ? 'hover:border-[var(--border-strong)] hover:bg-[var(--elev2)] transition-all cursor-pointer' : ''} ${className}`}
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
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--elev2)] ring-1 ring-inset ${m.ring} text-[11px] font-medium ${m.text}`}>
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
  <Card className="p-5">
    <div className="flex items-start justify-between mb-3">
      <span className="text-[11px] uppercase tracking-[0.1em] font-medium text-[var(--text-dim)]">{label}</span>
      {Icon && (
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? 'bg-[var(--accent)] text-black' : 'bg-[var(--elev2)] text-[var(--text-dim)]'}`}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
      )}
    </div>
    <div className="font-display text-3xl md:text-[34px] font-bold tracking-tight text-[var(--text)] leading-none">{value}</div>
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
      --text-dim:    #888;
      --text-faint:  #555;
      --accent:      #D9FF3D;
      --accent-hover:#C6EC1F;
      --accent-soft: rgba(217,255,61,0.1);
      --danger:      #ef4444;
      --success:     #34d399;
    }
    .light {
      --bg:          #fafaf9;
      --elev1:       #ffffff;
      --elev2:       #f4f4f5;
      --border:      rgba(0,0,0,0.07);
      --border-strong: rgba(0,0,0,0.15);
      --text:        #0a0a0a;
      --text-dim:    #666;
      --text-faint:  #aaa;
      --accent:      #84cc16;
      --accent-hover:#65a30d;
      --accent-soft: rgba(132,204,22,0.08);
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
    }

    .madvault-root::before {
      content: '';
      position: fixed; inset: 0;
      background-image: radial-gradient(circle at 1px 1px, var(--text-faint) 0.5px, transparent 0);
      background-size: 32px 32px;
      opacity: 0.06;
      pointer-events: none;
      z-index: 0;
    }

    .glow-accent {
      background: radial-gradient(60% 60% at 50% 50%, var(--accent-soft) 0%, transparent 70%);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-up { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
    .anim-d-100 { animation-delay: 0.06s; }
    .anim-d-200 { animation-delay: 0.12s; }
    .anim-d-300 { animation-delay: 0.18s; }
    .anim-d-400 { animation-delay: 0.24s; }
    .anim-d-500 { animation-delay: 0.30s; }

    @keyframes shimmer {
      0%,100% { opacity: 1; }
      50%     { opacity: 0.6; }
    }
    .pulse-soft { animation: shimmer 2.5s ease-in-out infinite; }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { scrollbar-width: none; }

    input:-webkit-autofill,
    input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--text);
      -webkit-box-shadow: 0 0 0 1000px var(--elev1) inset;
      transition: background-color 9999s ease-out;
    }
  `}</style>
);

// ────────────────────────── LOGO ──────────────────────────
const Logo = ({ small = false }) => (
  <div className="inline-flex items-center gap-2">
    <div className="relative">
      <div className={`${small ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg bg-[var(--accent)] flex items-center justify-center`}>
        <span className="font-display font-extrabold text-black text-sm">M</span>
      </div>
    </div>
    <span className={`font-display font-bold tracking-tight ${small ? 'text-base' : 'text-lg'}`}>
      MAD<span className="text-[var(--accent)]">/</span>Vault
    </span>
  </div>
);

// ────────────────────────── THEME TOGGLE ──────────────────────────
const ThemeToggle = ({ theme, setTheme }) => (
  <button
    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    className="w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] hover:bg-[var(--elev2)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-all"
    aria-label="Toggle theme"
  >
    {theme === 'dark' ? <Sun size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
  </button>
);

// ============================================================================
//  LANDING
// ============================================================================
const LandingPage = ({ go, theme, setTheme }) => {
  const steps = [
    { n: '01', title: 'Sign up',           desc: 'Create your creator profile with your TikTok and Instagram handles.', icon: UserIcon },
    { n: '02', title: 'Post the content',   desc: 'Pick a weekly challenge, hit the brief, and post to TikTok or Reels.', icon: Music2 },
    { n: '03', title: 'Submit your link',   desc: 'Drop the URL in your dashboard. We track views and engagement.',     icon: Upload },
    { n: '04', title: 'Get paid',           desc: 'Hit the goal, get approved, get paid out. Simple.',                   icon: Wallet },
  ];

  return (
    <div className="relative z-10">
      {/* NAV */}
      <nav className="relative z-20 px-5 md:px-10 py-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <Btn variant="ghost" size="sm" onClick={() => go('login')} className="hidden sm:inline-flex">Login</Btn>
          <Btn size="sm" onClick={() => go('signup')} iconRight={ArrowRight}>Join</Btn>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative px-5 md:px-10 pt-12 pb-20 md:pt-20 md:pb-32 max-w-6xl mx-auto">
        <div className="absolute inset-0 glow-accent pointer-events-none" />
        <div className="relative">
          <div className="anim-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--elev1)] text-xs text-[var(--text-dim)] mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] pulse-soft" />
            Invite-only creator program · 2026 Cohort
          </div>

          <h1 className="anim-fade-up anim-d-100 font-display font-extrabold text-[15vw] sm:text-[88px] md:text-[120px] leading-[0.88] tracking-tight">
            Post.<br />
            Earn.<br />
            <span className="text-[var(--accent)]">Repeat.</span>
          </h1>

          <p className="anim-fade-up anim-d-200 mt-8 max-w-xl text-base md:text-lg text-[var(--text-dim)] leading-relaxed">
            A private rewards portal for creators who post for our brand. Take a weekly challenge, hit the metrics, get paid. No bidding, no negotiating, no nonsense.
          </p>

          <div className="anim-fade-up anim-d-300 mt-10 flex flex-col sm:flex-row gap-3">
            <Btn size="lg" onClick={() => go('signup')} iconRight={ArrowRight}>Join as Creator</Btn>
            <Btn size="lg" variant="outline" onClick={() => go('login')}>Creator Login</Btn>
          </div>

          <div className="anim-fade-up anim-d-400 mt-12 flex items-center gap-6 text-xs text-[var(--text-dim)]">
            <span className="flex items-center gap-2"><Music2 size={14} strokeWidth={2.2} /> TikTok</span>
            <span className="flex items-center gap-2"><Instagram size={14} strokeWidth={2.2} /> Instagram Reels</span>
            <span className="hidden sm:flex items-center gap-2"><Shield size={14} strokeWidth={2.2} /> Vetted creators only</span>
          </div>
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section className="relative px-5 md:px-10 pb-24 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] font-medium text-[var(--text-dim)]">How it works</span>
            <h2 className="font-display font-bold text-3xl md:text-5xl mt-2 tracking-tight">Four steps to the payout.</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <Card key={s.n} className={`p-6 anim-fade-up anim-d-${(i + 1) * 100}`}>
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-[var(--text-dim)]">{s.n}</span>
                <div className="w-9 h-9 rounded-xl bg-[var(--elev2)] flex items-center justify-center text-[var(--accent)]">
                  <s.icon size={16} strokeWidth={2.2} />
                </div>
              </div>
              <h3 className="font-display font-bold text-xl mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURED REWARD */}
      <section className="relative px-5 md:px-10 pb-24 max-w-6xl mx-auto">
        <Card className="relative overflow-hidden p-7 md:p-10">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full glow-accent" />
          <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <Badge status="active">This week</Badge>
              <h3 className="font-display font-bold text-3xl md:text-5xl mt-4 tracking-tight">Launch Week Sprint</h3>
              <p className="mt-3 text-[var(--text-dim)] max-w-md">Hit the brief, hit 5k views in 72 hours, walk with $250. Top performer this week earns a $500 bonus.</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-[var(--text-dim)]">UP TO</span>
              <span className="font-display font-extrabold text-5xl md:text-6xl text-[var(--accent)] leading-none">$750</span>
            </div>
          </div>
        </Card>
      </section>

      {/* FOOTER */}
      <footer className="relative px-5 md:px-10 py-10 border-t border-[var(--border)] max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Logo small />
            <span className="text-xs text-[var(--text-dim)]">© 2026 MAD Intelligence</span>
          </div>
          <button onClick={() => go('admin-login')} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors">
            Admin sign-in
          </button>
        </div>
      </footer>
    </div>
  );
};

// ============================================================================
//  AUTH — Sign Up / Login (creator) and Admin Login
// ============================================================================
const AuthPage = ({ mode, go, onLogin, onSignup, creators }) => {
  const [tab, setTab] = useState(mode); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', phone: '', tiktok: '', instagram: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => setTab(mode), [mode]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (tab === 'login') {
      const u = creators.find((c) => c.email.toLowerCase() === form.email.toLowerCase() && c.password === form.password);
      if (!u) { setError('No creator found with that email/password. Try maya@example.com / demo'); return; }
      onLogin(u);
    } else {
      const required = ['name', 'email', 'phone', 'tiktok', 'instagram', 'password'];
      const missing = required.find((k) => !form[k]);
      if (missing) { setError('All fields required.'); return; }
      if (creators.some((c) => c.email.toLowerCase() === form.email.toLowerCase())) { setError('Email already registered.'); return; }
      onSignup(form);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <nav className="px-5 md:px-10 py-5 flex items-center justify-between">
        <button onClick={() => go('landing')} className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
        <Logo small />
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md anim-fade-up">
          <div className="text-center mb-8">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">
              {tab === 'login' ? 'Welcome back.' : 'Join the Vault.'}
            </h1>
            <p className="mt-3 text-sm text-[var(--text-dim)]">
              {tab === 'login' ? 'Log in to see this week\'s challenge.' : 'Set up your creator profile in under a minute.'}
            </p>
          </div>

          <div className="flex gap-1 p-1 rounded-full bg-[var(--elev1)] border border-[var(--border)] mb-6">
            {['login', 'signup'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 h-10 rounded-full text-sm font-medium transition-all ${tab === t ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
              >
                {t === 'login' ? 'Login' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === 'signup' && (
              <>
                <Field label="Full name" icon={UserIcon} placeholder="Maya Okafor" value={form.name} onChange={(e) => update('name', e.target.value)} />
                <Field label="Phone" icon={Phone} placeholder="+1 415 555 0142" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="TikTok" icon={AtSign} placeholder="@you" value={form.tiktok} onChange={(e) => update('tiktok', e.target.value)} />
                  <Field label="Instagram" icon={AtSign} placeholder="@you" value={form.instagram} onChange={(e) => update('instagram', e.target.value)} />
                </div>
              </>
            )}
            <Field label="Email" icon={Mail} type="email" placeholder="you@email.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
            <Field label="Password" icon={Lock} type="password" placeholder="••••••••" value={form.password} onChange={(e) => update('password', e.target.value)} />

            {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3 py-2.5">{error}</div>}

            <Btn type="submit" size="lg" className="w-full" iconRight={ArrowRight}>
              {tab === 'login' ? 'Login' : 'Create my account'}
            </Btn>
          </form>

          {tab === 'login' && (
            <div className="mt-6 p-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-xs text-[var(--text-dim)]">
              <div className="font-medium text-[var(--text)] mb-1">Demo logins</div>
              Try <span className="font-mono text-[var(--accent)]">maya@example.com</span> / <span className="font-mono">demo</span>
            </div>
          )}
        </div>
      </div>
    </div>
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
      <nav className="px-5 md:px-10 py-5 flex items-center justify-between">
        <button onClick={() => go('landing')} className="flex items-center gap-2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
        <Logo small />
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md anim-fade-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] mb-5">
              <Shield size={22} className="text-[var(--accent)]" />
            </div>
            <h1 className="font-display font-extrabold text-3xl tracking-tight">Admin sign-in</h1>
            <p className="mt-2 text-sm text-[var(--text-dim)]">Restricted access. Audited.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" icon={Mail} type="email" placeholder="admin@madintel.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" icon={Lock} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3 py-2.5">{error}</div>}
            <Btn type="submit" size="lg" className="w-full" iconRight={ArrowRight}>Enter admin</Btn>
          </form>
          <div className="mt-6 p-4 rounded-2xl bg-[var(--elev1)] border border-[var(--border)] text-xs text-[var(--text-dim)]">
            <div className="font-medium text-[var(--text)] mb-1">Demo admin</div>
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
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo small />
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setView(t.k)}
                  className={`h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
                >
                  <t.icon size={14} strokeWidth={2.4} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <div className="hidden md:flex items-center gap-3 pl-3 pr-1.5 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)]">
              <span className="text-xs">
                <span className="text-[var(--text-dim)]">Hi, </span>
                <span className="font-medium text-[var(--text)]">{user.name.split(' ')[0]}</span>
              </span>
              <button onClick={onLogout} className="w-7 h-7 rounded-full bg-[var(--elev2)] hover:bg-[var(--danger)] hover:text-white text-[var(--text-dim)] flex items-center justify-center transition-all" title="Log out">
                <LogOut size={13} />
              </button>
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] flex items-center justify-center">
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="md:hidden border-t border-[var(--border)] px-5 py-3 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => { setView(t.k); setMenuOpen(false); }}
                className={`w-full h-11 px-4 rounded-2xl text-sm font-medium flex items-center gap-3 transition-all ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)]'}`}
              >
                <t.icon size={15} strokeWidth={2.4} />
                {t.label}
              </button>
            ))}
            <button onClick={() => { onLogout(); setMenuOpen(false); }} className="w-full h-11 px-4 rounded-2xl text-sm font-medium flex items-center gap-3 text-[var(--danger)]">
              <LogOut size={15} strokeWidth={2.4} />
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {children}
      </main>
    </div>
  );
};

const CreatorDashboard = ({ user, campaigns, submissions, onSubmit, setView }) => {
  const activeCampaigns = campaigns.filter((c) => c.active);
  const featured = activeCampaigns[0];
  const mine = submissions.filter((s) => s.creatorId === user.id);
  const pending = mine.filter((s) => s.status === 'pending').length;
  const earned = mine.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.payout || 0), 0);
  const pendingPayout = mine.filter((s) => s.status === 'approved').reduce((sum, s) => sum + (s.payout || 0), 0);

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.12em] font-medium text-[var(--text-dim)]">{fmtDateFull(new Date().toISOString())}</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-1.5 tracking-tight">
          Welcome back, {user.name.split(' ')[0]}.
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 anim-fade-up anim-d-100">
        <Stat label="Earned" value={fmtMoney(earned)} icon={Wallet} accent />
        <Stat label="Pending" value={fmtMoney(pendingPayout)} icon={Clock} />
        <Stat label="In review" value={pending} icon={Inbox} />
      </div>

      {featured && (
        <Card className="relative overflow-hidden p-7 md:p-10 anim-fade-up anim-d-200">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full glow-accent" />
          <div className="relative">
            <Badge status="active">This week's drop</Badge>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl mt-4 tracking-tight">{featured.title}</h2>
            <p className="mt-3 text-[var(--text-dim)] max-w-lg leading-relaxed">{featured.description}</p>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-dim)] mb-1">Base reward</div>
                <div className="font-display font-bold text-2xl text-[var(--accent)]">{fmtMoney(featured.reward)}</div>
              </div>
              {featured.bonus > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-dim)] mb-1">Top bonus</div>
                  <div className="font-display font-bold text-2xl">{fmtMoney(featured.bonus)}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-dim)] mb-1">Closes in</div>
                <div className="font-display font-bold text-2xl">{daysLeft(featured.endDate)}d</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-dim)] mb-1">Deadline</div>
                <div className="font-display font-bold text-2xl">{fmtDate(featured.endDate)}</div>
              </div>
            </div>

            <ul className="mt-6 space-y-2">
              {featured.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                    <Check size={11} strokeWidth={3} className="text-black" />
                  </span>
                  <span className="text-[var(--text)]">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <SubmitForm user={user} campaigns={activeCampaigns} onSubmit={onSubmit} />

      <div className="anim-fade-up anim-d-400">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-2xl tracking-tight">Recent submissions</h3>
          <button onClick={() => setView('history')} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1 transition-colors">
            See all <ChevronRight size={14} />
          </button>
        </div>
        {mine.length === 0 ? (
          <Card className="p-10 text-center">
            <Inbox size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
            <p className="text-sm text-[var(--text-dim)]">No submissions yet. Drop your first link above.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {mine.slice(0, 3).map((s) => <SubmissionRow key={s.id} sub={s} campaign={campaigns.find((c) => c.id === s.campaignId)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const SubmitForm = ({ user, campaigns, onSubmit }) => {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '');
  const [url, setUrl] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id); }, [campaigns, campaignId]);

  const submit = (e) => {
    e.preventDefault();
    if (!url || !campaignId) return;
    onSubmit({ creatorId: user.id, campaignId, url, platform: detectPlatform(url) });
    setUrl('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2400);
  };

  if (campaigns.length === 0) return null;

  return (
    <Card className="p-6 md:p-7 anim-fade-up anim-d-300">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
          <Upload size={15} strokeWidth={2.4} className="text-black" />
        </div>
        <h3 className="font-display font-bold text-xl tracking-tight">Submit a link</h3>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-dim)] mb-2">Campaign</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {campaigns.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCampaignId(c.id)}
                className={`text-left p-4 rounded-2xl border transition-all ${campaignId === c.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--elev2)] hover:border-[var(--border-strong)]'}`}
              >
                <div className="font-medium text-sm">{c.title}</div>
                <div className="text-xs text-[var(--text-dim)] mt-0.5">{fmtMoney(c.reward)} · closes {fmtDate(c.endDate)}</div>
              </button>
            ))}
          </div>
        </div>
        <Field
          label="Video URL"
          icon={LinkIcon}
          placeholder="https://www.tiktok.com/@you/video/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          {url && (
            <div className="text-xs text-[var(--text-dim)] flex items-center gap-2">
              <PlatformIcon platform={detectPlatform(url)} />
              <span className="capitalize">{detectPlatform(url) === 'other' ? 'Unknown platform' : detectPlatform(url)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {success && <span className="text-xs text-[var(--success)] flex items-center gap-1.5"><Check size={13} strokeWidth={3} />Submitted</span>}
            <Btn type="submit" disabled={!url || !campaignId} iconRight={ArrowRight}>Submit</Btn>
          </div>
        </div>
      </form>
    </Card>
  );
};

const SubmissionRow = ({ sub, campaign }) => (
  <Card className="p-4 md:p-5">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[var(--elev2)] flex items-center justify-center flex-shrink-0">
        <PlatformIcon platform={sub.platform} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{campaign?.title || 'Campaign'}</div>
            <a href={sub.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)] truncate flex items-center gap-1 mt-0.5 max-w-full">
              <span className="truncate">{sub.url}</span>
              <ExternalLink size={11} className="flex-shrink-0" />
            </a>
          </div>
          <Badge status={sub.status} />
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-dim)]">
          <span>{fmtDate(sub.submittedAt)}</span>
          {sub.status === 'paid' && <span className="text-[var(--accent)] font-medium">+{fmtMoney(sub.payout)}</span>}
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
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Weekly Rewards</h1>
        <p className="mt-2 text-[var(--text-dim)]">Active challenges. Pick one, post, submit.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-full bg-[var(--elev1)] border border-[var(--border)] w-fit anim-fade-up anim-d-100">
        {[{ k: 'active', l: 'Active' }, { k: 'ended', l: 'Ended' }, { k: 'all', l: 'All' }].map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-all ${filter === t.k ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((c, i) => (
          <Card key={c.id} className={`relative overflow-hidden p-7 anim-fade-up anim-d-${Math.min((i + 1) * 100, 500)}`}>
            <div className="flex items-start justify-between mb-4">
              <Badge status={c.active ? 'active' : 'ended'} />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-dim)]">Reward</div>
                <div className="font-display font-bold text-2xl text-[var(--accent)]">{fmtMoney(c.reward)}</div>
              </div>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight">{c.title}</h3>
            <p className="mt-2 text-sm text-[var(--text-dim)] leading-relaxed">{c.description}</p>
            <ul className="mt-5 space-y-1.5">
              {c.requirements.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-[var(--text)]">
                  <Check size={12} className="text-[var(--accent)] mt-0.5 flex-shrink-0" strokeWidth={3} />
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-5 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-dim)]">
              <span className="flex items-center gap-1.5"><Calendar size={12} /> Closes {fmtDate(c.endDate)}</span>
              {c.active && <span className="text-[var(--text)] font-medium">{daysLeft(c.endDate)}d left</span>}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
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
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Submissions</h1>
        <p className="mt-2 text-[var(--text-dim)]">All links you've submitted, and their status.</p>
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
            className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === t.k ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">Nothing here yet.</p>
        </Card>
      ) : (
        <div className="space-y-2 anim-fade-up anim-d-200">
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
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Logo small />
              <span className="ml-2 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1 rounded">Admin</span>
            </div>
            <nav className="hidden lg:flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setView(t.k)}
                  className={`h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
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
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden w-10 h-10 rounded-full bg-[var(--elev1)] border border-[var(--border)] flex items-center justify-center">
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-[var(--border)] px-5 py-3 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => { setView(t.k); setMenuOpen(false); }}
                className={`w-full h-11 px-4 rounded-2xl text-sm font-medium flex items-center gap-3 transition-all ${view === t.k ? 'bg-[var(--elev2)] text-[var(--text)]' : 'text-[var(--text-dim)]'}`}
              >
                <t.icon size={15} strokeWidth={2.4} />
                {t.label}
              </button>
            ))}
            <button onClick={() => { onLogout(); setMenuOpen(false); }} className="w-full h-11 px-4 rounded-2xl text-sm font-medium flex items-center gap-3 text-[var(--danger)]">
              <LogOut size={15} strokeWidth={2.4} />
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12">
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
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="text-xs uppercase tracking-[0.12em] font-medium text-[var(--text-dim)]">Admin overview</span>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mt-1.5 tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 anim-fade-up anim-d-100">
        <Stat label="Total creators" value={creators.length} icon={Users} />
        <Stat label="Pending review" value={pending} icon={Clock} />
        <Stat label="Approved" value={approved} icon={CheckCircle2} />
        <Stat label="Paid out" value={fmtMoney(paidTotal)} icon={Wallet} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 anim-fade-up anim-d-200">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-xl tracking-tight">Recent submissions</h3>
            <button onClick={() => setView('a-submissions')} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1 transition-colors">
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
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--elev2)]">
                    <div className="w-9 h-9 rounded-full bg-[var(--elev1)] flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {creator?.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{creator?.name}</div>
                      <div className="text-xs text-[var(--text-dim)] truncate">{campaign?.title}</div>
                    </div>
                    <Badge status={s.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-bold text-xl tracking-tight mb-5">Active campaigns</h3>
          <div className="space-y-3">
            {campaigns.filter((c) => c.active).map((c) => (
              <div key={c.id} className="p-3 rounded-2xl bg-[var(--elev2)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{c.title}</span>
                  <span className="font-mono text-xs text-[var(--accent)]">{fmtMoney(c.reward)}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)]">{daysLeft(c.endDate)} days left</div>
              </div>
            ))}
            <Btn variant="outline" size="sm" icon={Plus} onClick={() => setView('a-campaigns')} className="w-full">New campaign</Btn>
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
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Submissions</h1>
        <p className="mt-2 text-[var(--text-dim)]">Review, approve, reject, mark as paid.</p>
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
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === t.k ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-xs ml-auto">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creator…"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--elev1)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
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
    <div className="space-y-6">
      <div className="anim-fade-up flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Creators</h1>
          <p className="mt-2 text-[var(--text-dim)]">{creators.length} active accounts.</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators…"
            className="w-72 max-w-full h-11 pl-11 pr-4 rounded-full bg-[var(--elev1)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 anim-fade-up anim-d-100">
        {filtered.map((c) => {
          const subs = submissions.filter((s) => s.creatorId === c.id);
          const earned = subs.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.payout || 0), 0);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[var(--elev2)] flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">{c.email}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--elev2)]">
                  <div className="text-[var(--text-dim)] flex items-center gap-1 mb-0.5"><Music2 size={11} /> TikTok</div>
                  <div className="font-medium truncate">{c.tiktok}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--elev2)]">
                  <div className="text-[var(--text-dim)] flex items-center gap-1 mb-0.5"><Instagram size={11} /> Instagram</div>
                  <div className="font-medium truncate">{c.instagram}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-dim)]">{subs.length} submissions</span>
                <span className="font-mono text-[var(--accent)]">{fmtMoney(earned)} earned</span>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
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
    <div className="space-y-6">
      <div className="anim-fade-up flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Campaigns</h1>
          <p className="mt-2 text-[var(--text-dim)]">Create, edit, toggle weekly rewards.</p>
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
  const [theme, setTheme] = useState('dark');

  const [creators, setCreators] = useState(initialCreators);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [submissions, setSubmissions] = useState(initialSubmissions);

  // ─── SERVICE LAYER (swap for API calls when wiring backend) ───
  const handleLogin = (creator) => { setUser(creator); setView('dash'); };
  const handleSignup = (form) => {
    const newCreator = { ...form, id: uid('usr'), joined: new Date().toISOString().slice(0, 10) };
    setCreators((cs) => [...cs, newCreator]);
    setUser(newCreator);
    setView('dash');
  };
  const handleAdminLogin = () => { setIsAdmin(true); setView('a-dash'); };
  const handleLogout = () => { setUser(null); setIsAdmin(false); setView('landing'); };

  const handleNewSubmission = (data) => {
    const sub = { ...data, id: uid('sub'), submittedAt: new Date().toISOString().slice(0, 10), status: 'pending', notes: '', payout: campaigns.find((c) => c.id === data.campaignId)?.reward || 0 };
    setSubmissions((s) => [sub, ...s]);
  };

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
  } else if (view === 'login' || view === 'signup') {
    body = <AuthPage mode={view} go={go} onLogin={handleLogin} onSignup={handleSignup} creators={creators} />;
  } else if (view === 'admin-login') {
    body = <AdminLoginPage go={go} onAdminLogin={handleAdminLogin} />;
  } else if (isAdmin) {
    body = (
      <AdminShell view={view} setView={setView} onLogout={handleLogout} theme={theme} setTheme={setTheme}>
        {view === 'a-dash'        && <AdminDashboard   creators={creators} submissions={submissions} campaigns={campaigns} setView={setView} />}
        {view === 'a-submissions' && <AdminSubmissions submissions={submissions} creators={creators} campaigns={campaigns} onUpdateStatus={updateStatus} onUpdateNotes={updateNotes} />}
        {view === 'a-creators'    && <AdminCreators    creators={creators} submissions={submissions} />}
        {view === 'a-campaigns'   && <AdminCampaigns   campaigns={campaigns} onSave={saveCampaign} onDelete={deleteCampaign} onToggleActive={toggleActive} />}
      </AdminShell>
    );
  } else if (user) {
    body = (
      <CreatorShell user={user} view={view} setView={setView} onLogout={handleLogout} theme={theme} setTheme={setTheme}>
        {view === 'dash'    && <CreatorDashboard user={user} campaigns={campaigns} submissions={submissions} onSubmit={handleNewSubmission} setView={setView} />}
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

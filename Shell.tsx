import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Sparkles, Smartphone, Youtube, Megaphone, GraduationCap, Mic, Heart, Users, Wand2, FolderOpen, Activity, CreditCard, Circle, type LucideIcon } from 'lucide-react';
const ICONS: Record<string, LucideIcon> = { Sparkles, Smartphone, Youtube, Megaphone, GraduationCap, Mic, Heart, Users, Wand2, FolderOpen, Activity, CreditCard };
import { Bell, ChevronDown, Coins, HelpCircle, LayoutDashboard, LogOut, Menu, Search, Settings as SettingsIcon, ShieldCheck, X, Plus, Command, BookOpen, Flag, Play } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { CATEGORIES, FEATURES, featureRoute } from '../lib/features';
import { setSettings, useSettings, useT } from '../lib/i18n';
import { useApp, setActiveWorkspace } from '../lib/useApp';
import { Button, cx, Dialog, Textarea, useToast, Field, Input } from './ui';
import { Logo, ReadAloud } from './shared';
import { update, getStorageError } from '../lib/db';
import { uid, ago } from '../lib/id';
import { dur, ease } from '../lib/motion';
import { stopSpeaking } from '../lib/speech';

const catRoute = (id: string) => (id === 'create' ? '/app/create' : id === 'projects' ? '/app/projects' : id === 'billing' ? '/app/billing' : id === 'analytics' ? '/app/analytics' : id === 'agency' ? '/app/agency' : `/app/hub/${id}`);

function NavItems({ onNav }: { onNav?: () => void }) {
  const t = useT();
  const loc = useLocation();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      <SideLink to="/app" icon={<LayoutDashboard className="size-[18px]" />} label={t('nav.home')} end onNav={onNav} />
      {CATEGORIES.map((c) => {
        const I = ICONS[c.icon] ?? Circle;
        const to = catRoute(c.id);
        const active = loc.pathname.startsWith(to) && to !== '/app';
        return <SideLink key={c.id} to={to} icon={<I className="size-[18px]" />} label={t(c.key)} forceActive={active} onNav={onNav} tour={c.id === 'create' ? 'nav-create' : undefined} />;
      })}
    </nav>
  );
}

function SideLink({ to, icon, label, end, forceActive, onNav, tour }: { to: string; icon: ReactNode; label: string; end?: boolean; forceActive?: boolean; onNav?: () => void; tour?: string }) {
  return (
    <NavLink to={to} end={end} onClick={onNav} data-tour={tour} className={({ isActive }) => cx('relative flex items-center gap-3 rounded-xl px-3 h-10 text-[14px] transition-colors', isActive || forceActive ? 'text-paper' : 'text-mute hover:text-paper hover:bg-white/[0.03]')}>
      {({ isActive }) => (
        <>
          {(isActive || forceActive) && <motion.span layoutId="nav-ind" className="absolute inset-0 rounded-xl bg-white/[0.06] hairline" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
          <span className="relative">{icon}</span>
          <span className="relative truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

const HELP: Record<string, { title: string; body: string }> = {
  '/app': { title: 'Your home', body: 'This is your dashboard. Press the big Create button to start a new video. Your recent projects, credits and running jobs are shown here. Everything saves automatically.' },
  '/app/create': { title: 'Creating a video', body: 'Answer a few short questions, one per screen. You can type or press Speak. We build a scene list you can change, then you add photos or clips, and we assemble the video in the editor. Nothing is published without you.' },
  '/app/editor': { title: 'The editor', body: 'The preview is at the top and the timeline is below. Drag clips to move them, drag their edges to trim, and press S to split at the playhead. Space plays and pauses. Control Z undoes. Your work saves automatically. Press Export when you are ready.' },
  '/app/projects': { title: 'Projects and media', body: 'All your projects, uploaded media and finished exports live here. Deleting asks you to confirm and can be undone for a few seconds.' },
  '/app/billing': { title: 'Credits and plans', body: 'Credits pay for exports and AI features. We show the cost before every job. Credits are reserved when a job starts and refunded in full if it fails or you cancel it.' },
  '/app/trust': { title: 'Trust and transparency', body: 'This page explains where your data is stored, how AI is used, and which provider integrations are connected right now.' },
};

function HelpPanel({ open, onClose, onTour }: { open: boolean; onClose: () => void; onTour: () => void }) {
  const loc = useLocation();
  const key = Object.keys(HELP).sort((a, b) => b.length - a.length).find((k) => loc.pathname.startsWith(k)) ?? '/app';
  const h = HELP[key];
  const [report, setReport] = useState('');
  const { user } = useApp();
  const toast = useToast();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { stopSpeaking(); onClose(); }} />
          <motion.aside role="dialog" aria-label="Help" className="fixed right-0 top-0 bottom-0 z-[71] w-[min(420px,100vw)] bg-panel border-l border-line p-6 overflow-y-auto scroll-thin" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: dur.base, ease: ease.out }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display text-3xl">Help</h2><button onClick={() => { stopSpeaking(); onClose(); }} aria-label="Close help" className="size-9 grid place-items-center rounded-lg hover:bg-white/5"><X className="size-4" /></button></div>
            <div className="rounded-2xl hairline p-5 bg-white/[0.02]">
              <div className="font-medium mb-2">{h.title}</div>
              <p className="text-sm text-mute leading-relaxed">{h.body}</p>
              <div className="flex gap-3 mt-4"><ReadAloud text={`${h.title}. ${h.body}`} /><button onClick={onTour} className="inline-flex items-center gap-1.5 text-xs text-mute hover:text-paper"><Play className="size-3.5" /> Take the 30-second tour</button></div>
            </div>
            <div className="mt-6 space-y-2 text-sm">
              <div className="font-medium mb-1">Keyboard shortcuts</div>
              {[['Space', 'Play / pause (editor)'], ['S', 'Split clip at playhead'], ['Delete', 'Remove selected clip'], ['Ctrl/⌘ Z', 'Undo'], ['Ctrl/⌘ Shift Z', 'Redo'], ['Ctrl/⌘ K', 'Search everything'], ['← →', 'Nudge playhead / clip']].map(([k, v]) => (
                <div key={k} className="flex justify-between text-mute"><span>{v}</span><kbd className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5 hairline text-paper">{k}</kbd></div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <Link onClick={onClose} to="/app/docs" className="flex items-center gap-2 text-mute hover:text-paper"><BookOpen className="size-4" /> Setup guide, API & status report</Link>
              <Link onClick={onClose} to="/app/trust" className="flex items-center gap-2 text-mute hover:text-paper"><ShieldCheck className="size-4" /> Trust & Transparency Center</Link>
            </div>
            <div className="mt-8">
              <Field label="Report a problem or unsafe content" hint="Goes to the admin review queue with your account email.">
                <Textarea value={report} onChange={(e) => setReport(e.target.value)} placeholder="What happened?" />
              </Field>
              <Button className="mt-2" size="sm" icon={<Flag className="size-3.5" />} disabled={!report.trim()} onClick={() => { update((d) => { d.reports.unshift({ id: uid('r_'), reporter: user.email, target: loc.pathname, reason: report.trim(), status: 'open', at: Date.now() }); }); setReport(''); toast('Report sent. Thank you.', 'ok'); }}>Send report</Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

const TOUR = [
  { sel: 'nav-create', title: 'Start here', body: 'Create opens a step-by-step wizard. One question per screen.' },
  { sel: 'search', title: 'Find anything', body: 'Search projects, media and all 55 tools. Shortcut: Ctrl/⌘ K.' },
  { sel: 'credits', title: 'Your credits', body: 'See your balance. Every job shows its cost before it runs.' },
  { sel: 'mode', title: 'Beginner or Pro', body: 'Beginner keeps things simple. Switch to Pro for every control.' },
  { sel: 'help', title: 'Help is always here', body: 'Read-aloud help, shortcuts and problem reports.' },
];

function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open) { setI(0); return; }
    const el = document.querySelector(`[data-tour="${TOUR[i].sel}"]`) as HTMLElement | null;
    const visible = el && el.offsetParent !== null;
    setRect(visible ? el!.getBoundingClientRect() : null);
  }, [open, i]);
  if (!open) return null;
  const s = TOUR[i];
  const pos = rect ? { top: Math.min(window.innerHeight - 200, rect.bottom + 12), left: Math.max(12, Math.min(window.innerWidth - 332, rect.left)) } : { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 160 };
  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-label="Product tour">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {rect && <motion.div layout className="absolute rounded-xl ring-2 ring-amber shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute w-80 rounded-2xl bg-paper text-ink p-5 shadow-2xl" style={pos}>
        <div className="font-mono text-[11px] uppercase tracking-widest opacity-60">Step {i + 1} of {TOUR.length}</div>
        <div className="font-display text-2xl mt-1">{s.title}</div>
        <p className="text-sm mt-1 opacity-80">{s.body}</p>
        <div className="flex justify-between mt-4">
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>Skip</button>
          <div className="flex gap-2">
            {i > 0 && <button className="text-sm px-3 h-9 rounded-lg hover:bg-black/5" onClick={() => setI(i - 1)}>Back</button>}
            <button className="text-sm px-4 h-9 rounded-lg bg-ink text-paper" onClick={() => (i < TOUR.length - 1 ? setI(i + 1) : onClose())}>{i < TOUR.length - 1 ? 'Next' : 'Done'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { db, workspace } = useApp();
  const nav = useNavigate();
  const results = useMemo(() => {
    const s = q.toLowerCase().trim();
    const items: { label: string; sub: string; to: string }[] = [];
    db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt && (!s || p.title.toLowerCase().includes(s))).slice(0, 6).forEach((p) => items.push({ label: p.title, sub: 'Project', to: `/app/editor/${p.id}` }));
    FEATURES.filter((f) => !s || f.name.toLowerCase().includes(s) || f.desc.toLowerCase().includes(s)).slice(0, s ? 10 : 6).forEach((f) => items.push({ label: f.name, sub: `Tool · ${f.status}`, to: featureRoute(f) }));
    if (s) db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt && (a.name.toLowerCase().includes(s) || a.tags.some((t) => t.includes(s)))).slice(0, 6).forEach((a) => items.push({ label: a.name, sub: `Media · ${a.type}`, to: `/app/projects?tab=assets&q=${encodeURIComponent(a.name)}` }));
    return items;
  }, [q, db, workspace]);
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [q]);
  const go = (to: string) => { nav(to); onClose(); setQ(''); };
  return (
    <Dialog open={open} onClose={onClose} title="Search">
      <Input autoFocus placeholder="Projects, media, tools…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
        if (e.key === 'Enter' && results[sel]) go(results[sel].to);
      }} aria-label="Search" />
      <ul className="mt-4 space-y-1" role="listbox">
        {results.map((r, i) => (
          <li key={r.to + i} role="option" aria-selected={i === sel}>
            <button onClick={() => go(r.to)} onMouseEnter={() => setSel(i)} className={cx('w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left', i === sel ? 'bg-white/[0.06]' : '')}>
              <span className="truncate">{r.label}</span><span className="text-xs text-dim ml-3 shrink-0">{r.sub}</span>
            </button>
          </li>
        ))}
        {!results.length && <li className="text-sm text-mute py-6 text-center">Nothing matches “{q}”.</li>}
      </ul>
    </Dialog>
  );
}

export default function Shell() {
  const { user, db, workspace, workspaces, balance } = useApp();
  const settings = useSettings();
  const t = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const [tour, setTour] = useState(false);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState<'ws' | 'user' | 'notes' | null>(null);
  const storageErr = getStorageError();
  const unread = db.notices.filter((n) => n.userId === user?.id && !n.read);

  useEffect(() => {
    const h = document.documentElement;
    h.style.setProperty('--text-scale', String(settings.textScale));
    h.dataset.contrast = settings.contrast;
    h.dataset.motion = settings.motion === 'reduced' ? 'reduced' : 'full';
    h.lang = settings.lang;
  }, [settings]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setMenu(null); setDrawer(false); }, [loc.pathname]);
  useEffect(() => { if (user && !settings.toursDone.includes('main') && user.onboarded && loc.pathname === '/app') { const tm = setTimeout(() => setTour(true), 900); return () => clearTimeout(tm); } }, [user, settings.toursDone, loc.pathname]);

  if (!user) return null;
  const isEditor = loc.pathname.startsWith('/app/editor');
  const closeTour = () => { setTour(false); setSettings(user.id, { toursDone: [...new Set([...settings.toursDone, 'main'])] }); };

  return (
    <MotionConfig reducedMotion={settings.motion === 'reduced' ? 'always' : settings.motion === 'full' ? 'never' : 'user'}>
      <div className={cx('min-h-screen grain', settings.mode === 'beginner' && 'beginner')}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-paper focus:text-ink focus:px-4 focus:py-2 focus:rounded-lg">Skip to content</a>
        {/* Sidebar */}
        {!isEditor && (
          <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col border-r border-line bg-coal/80 px-3 py-5 z-30">
            <Link to="/app" className="px-3 mb-6"><Logo /></Link>
            <div className="px-1 mb-4">
              <Button variant="primary" size="lg" className="w-full" icon={<Plus className="size-5" />} onClick={() => nav('/app/create')}>{t('cta.create')}</Button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1"><NavItems /></div>
            <div className="pt-4 mt-2 border-t border-line text-xs text-dim px-3 flex flex-col gap-1.5">
              <Link to="/app/trust" className="hover:text-paper">Trust Center</Link>
              {user.role === 'admin' && <Link to="/app/admin" className="hover:text-paper">Admin console</Link>}
              <Link to="/app/docs" className="hover:text-paper">Docs & status</Link>
            </div>
          </aside>
        )}

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.div className="fixed inset-0 bg-black/60 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
              <motion.aside className="fixed inset-y-0 left-0 w-[280px] bg-coal z-50 p-4 overflow-y-auto lg:hidden" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: dur.base, ease: ease.out }}>
                <div className="flex items-center justify-between mb-5"><Logo /><button onClick={() => setDrawer(false)} aria-label="Close menu" className="size-10 grid place-items-center"><X className="size-5" /></button></div>
                <Button variant="primary" size="lg" className="w-full mb-4" icon={<Plus className="size-5" />} onClick={() => nav('/app/create')}>{t('cta.create')}</Button>
                <NavItems onNav={() => setDrawer(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className={cx(!isEditor && 'lg:pl-[248px]')}>
          {/* Top bar */}
          <header className="sticky top-0 z-20 h-16 flex items-center gap-2 px-3 md:px-6 border-b border-line bg-ink/80 backdrop-blur-md">
            {!isEditor && <button className="lg:hidden size-10 grid place-items-center rounded-lg hover:bg-white/5" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="size-5" /></button>}
            {isEditor && <Link to="/app/projects" className="mr-2"><Logo className="scale-90 origin-left" /></Link>}
            <div className="relative">
              <button onClick={() => setMenu(menu === 'ws' ? null : 'ws')} className="flex items-center gap-2 h-10 px-3 rounded-xl hover:bg-white/5 text-sm max-w-[180px] md:max-w-[240px]" aria-haspopup="menu" aria-expanded={menu === 'ws'}>
                <span className="size-6 rounded-md bg-gradient-to-br from-violet to-amber grid place-items-center text-ink text-xs font-bold shrink-0">{workspace?.name[0]}</span>
                <span className="truncate hidden sm:inline">{workspace?.name}</span><ChevronDown className="size-3.5 text-dim shrink-0" />
              </button>
              <Menu2 open={menu === 'ws'} className="left-0 w-64">
                <div className="px-3 py-2 text-xs text-dim">Workspaces</div>
                {workspaces.map((w) => <button key={w.id} onClick={() => { setActiveWorkspace(w.id); setMenu(null); }} className={cx('w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5', w.id === workspace?.id && 'text-amber')}>{w.name} <span className="text-dim text-xs">· {w.kind}</span></button>)}
                <Link to="/app/agency" className="block px-3 py-2 rounded-lg text-sm text-mute hover:bg-white/5 border-t border-line mt-1">Manage workspaces →</Link>
              </Menu2>
            </div>
            <button data-tour="search" onClick={() => setSearch(true)} className="hidden md:flex items-center gap-2 h-10 px-3 rounded-xl hairline bg-white/[0.02] text-sm text-dim hover:text-paper w-64 ml-2">
              <Search className="size-4" /><span className="flex-1 text-left">{t('search')}…</span><kbd className="font-mono text-[10px] flex items-center gap-0.5"><Command className="size-3" />K</kbd>
            </button>
            <button onClick={() => setSearch(true)} className="md:hidden size-10 grid place-items-center rounded-lg hover:bg-white/5" aria-label="Search"><Search className="size-4" /></button>
            <div className="flex-1" />
            {isEditor && <button data-tour="help" onClick={() => setHelp(true)} className="size-10 grid place-items-center rounded-xl hover:bg-white/5" aria-label={t('help')}><HelpCircle className="size-[18px] text-amber" /></button>}
            <div data-tour="mode" className="hidden sm:flex p-1 rounded-xl hairline bg-coal text-xs" role="radiogroup" aria-label="Interface mode">
              {(['beginner', 'pro'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={settings.mode === m} onClick={() => setSettings(user.id, { mode: m })} className={cx('px-2.5 h-7 rounded-lg transition-colors', settings.mode === m ? 'bg-paper text-ink' : 'text-mute hover:text-paper')}>{t(`mode.${m}`)}</button>
              ))}
            </div>
            <Link data-tour="credits" to="/app/billing" className="flex items-center gap-1.5 h-10 px-3 rounded-xl hover:bg-white/5 text-sm" aria-label={`${balance} credits`}>
              <Coins className="size-4 text-amber" /><span className="tabular font-medium">{balance.toLocaleString()}</span><span className="hidden md:inline text-dim">{t('credits')}</span>
            </Link>
            <div className="relative">
              <button onClick={() => setMenu(menu === 'notes' ? null : 'notes')} className="relative size-10 grid place-items-center rounded-xl hover:bg-white/5" aria-label={`${t('notifications')}${unread.length ? `, ${unread.length} unread` : ''}`}>
                <Bell className="size-[18px]" />{unread.length > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-amber" />}
              </button>
              <Menu2 open={menu === 'notes'} className="right-0 w-[min(360px,90vw)]">
                <div className="flex justify-between items-center px-3 py-2"><span className="text-xs text-dim">{t('notifications')}</span>{unread.length > 0 && <button className="text-xs text-amber" onClick={() => update((d) => d.notices.forEach((n) => { if (n.userId === user.id) n.read = true; }))}>Mark all read</button>}</div>
                <div className="max-h-80 overflow-y-auto scroll-thin">
                  {db.notices.filter((n) => n.userId === user.id).slice(0, 20).map((n) => (
                    <button key={n.id} onClick={() => { update((d) => { const x = d.notices.find((y) => y.id === n.id); if (x) x.read = true; }); if (n.link) nav(n.link); setMenu(null); }} className={cx('w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm', !n.read && 'bg-white/[0.03]')}>
                      <div className={cx(n.tone === 'bad' && 'text-bad', n.tone === 'ok' && 'text-ok')}>{n.text}</div><div className="text-xs text-dim mt-0.5">{ago(n.at)}</div>
                    </button>
                  ))}
                  {!db.notices.some((n) => n.userId === user.id) && <div className="px-3 py-6 text-sm text-mute text-center">No notifications yet.</div>}
                </div>
              </Menu2>
            </div>
            <div className="relative">
              <button onClick={() => setMenu(menu === 'user' ? null : 'user')} className="size-10 rounded-full bg-gradient-to-br from-azure/60 to-violet/60 grid place-items-center text-sm font-semibold" aria-label="Account menu">{user.name[0]?.toUpperCase()}</button>
              <Menu2 open={menu === 'user'} className="right-0 w-56">
                <div className="px-3 py-2"><div className="text-sm font-medium truncate">{user.name}</div><div className="text-xs text-dim truncate">{user.email}</div></div>
                <Link to="/app/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5"><SettingsIcon className="size-4" />{t('settings')}</Link>
                <Link to="/app/billing" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5"><Coins className="size-4" />Billing & credits</Link>
                {user.role === 'admin' && <Link to="/app/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5"><ShieldCheck className="size-4" />Admin console</Link>}
                <button onClick={() => { signOut(); nav('/'); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-bad"><LogOut className="size-4" />{t('signout')}</button>
              </Menu2>
            </div>
          </header>
          {storageErr && <div role="alert" className="bg-bad/15 text-bad text-sm px-6 py-2 border-b border-bad/30">{storageErr}</div>}
          <main id="main" className={cx(!isEditor && 'px-4 md:px-8 lg:px-12 py-8 md:py-10 max-w-[1400px]')}>
            <AnimatePresence mode="wait">
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast, ease: ease.out }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Always-visible help */}
        {!isEditor && (
          <button data-tour="help" onClick={() => setHelp(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-12 pl-3.5 pr-4 rounded-full glass hairline shadow-[var(--shadow-float)] text-sm hover:bg-white/10">
            <HelpCircle className="size-5 text-amber" />{t('help')}
          </button>
        )}
        <HelpPanel open={help} onClose={() => setHelp(false)} onTour={() => { setHelp(false); setTour(true); }} />
        <Tour open={tour} onClose={closeTour} />
        <SearchPalette open={search} onClose={() => setSearch(false)} />
        {menu && <div className="fixed inset-0 z-[15]" onClick={() => setMenu(null)} aria-hidden />}
      </div>
    </MotionConfig>
  );
}

function Menu2({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: dur.fast }} className={cx('absolute top-12 z-[25] rounded-2xl bg-raise hairline p-1.5 shadow-[var(--shadow-float)]', className)}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

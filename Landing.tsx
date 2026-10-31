import { motion, useMotionValue, useScroll, useSpring, useTransform, useReducedMotion, MotionConfig } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, Play, ShieldCheck, Sparkles, Captions, AudioWaveform, Gauge, Layers, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/shared';
import { CATEGORIES, FEATURES } from '../lib/features';
import { PLANS } from '../lib/plans';
import { useSessionId } from '../lib/auth';
import { ease } from '../lib/motion';
import { cx } from '../components/ui';

const CAT_LABEL: Record<string, string> = { create: 'Create', shorts: 'Shorts & Clips', youtube: 'YouTube Studio', ads: 'Ads & Business', learn: 'Learn', podcasts: 'Podcasts & Gaming', personal: 'Personal Videos', agency: 'Agency & Teams', ai: 'AI Tools', projects: 'Projects & Assets', analytics: 'Analytics & Quality', billing: 'Billing & Settings' };

function Magnetic({ children, to, className }: { children: ReactNode; to: string; className?: string }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20 }), sy = useSpring(y, { stiffness: 260, damping: 20 });
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  return (
    <motion.span style={{ x: sx, y: sy, display: 'inline-block' }}>
      <Link ref={ref} to={to}
        onMouseMove={(e) => { if (reduce || !ref.current) return; const r = ref.current.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.25); y.set((e.clientY - r.top - r.height / 2) * 0.35); }}
        onMouseLeave={() => { x.set(0); y.set(0); }}
        className={cx('sweep inline-flex items-center gap-2.5 h-14 pl-7 pr-6 rounded-full bg-paper text-ink font-medium text-[15px] shadow-[0_10px_50px_-12px_rgba(243,238,229,0.55)] hover:bg-white transition-colors', className)}>
        {children}
      </Link>
    </motion.span>
  );
}

function MaskLine({ children, delay, className }: { children: ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span className={cx('block', className)} initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1.1, delay, ease: ease.film }}>{children}</motion.span>
    </span>
  );
}

function SceneCard({ src, label, meta, className, y, video }: { src: string; label: string; meta: ReactNode; className: string; y: ReturnType<typeof useTransform<number, number>>; video?: boolean }) {
  return (
    <motion.div style={{ y }} className={cx('absolute hidden md:block', className)}>
      <motion.div initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2, delay: 0.9, ease: ease.film }}
        className="rounded-2xl overflow-hidden glass hairline shadow-[var(--shadow-float)] p-1.5">
        {video ? <video src={src} muted loop autoPlay playsInline preload="none" poster="/media/scene-forest.jpg" className="w-full aspect-video object-cover rounded-xl" /> : <img src={src} alt="" className="w-full aspect-video object-cover rounded-xl" loading="lazy" />}
        <div className="flex items-center justify-between px-2 pt-2 pb-1 gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-mute whitespace-nowrap">{label}</span>
          <span className="text-[11px] text-paper/90 truncate">{meta}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const session = useSessionId();
  const nav = useNavigate();
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const lowPower = typeof navigator !== 'undefined' && ((navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? 8) <= 4;
  const k = reduce || lowPower ? 0 : 1;
  const bgY = useTransform(scrollY, [0, 900], [0, 180 * k]);
  const bgS = useTransform(scrollY, [0, 900], [1.08, 1.08 + 0.08 * k]);
  const c1 = useTransform(scrollY, [0, 900], [0, -140 * k]);
  const c2 = useTransform(scrollY, [0, 900], [0, -80 * k]);
  const c3 = useTransform(scrollY, [0, 900], [0, -200 * k]);
  const fade = useTransform(scrollY, [0, 500], [1, 0]);
  const [reel, setReel] = useState(false);
  const counts = { working: FEATURES.filter((f) => f.status === 'working').length, partial: FEATURES.filter((f) => f.status === 'partial').length, pending: FEATURES.filter((f) => f.status === 'pending').length };
  const start = session ? '/app' : '/signup';

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain bg-ink text-paper overflow-x-clip">
        {/* Nav */}
        <header className="fixed top-0 inset-x-0 z-50">
          <div className="mx-auto max-w-[1400px] flex items-center justify-between px-5 md:px-10 h-20">
            <Link to="/" aria-label="Obscura home"><Logo /></Link>
            <nav className="hidden md:flex items-center gap-1 glass hairline rounded-full p-1 text-sm" aria-label="Marketing">
              {[['#workflow', 'Workflow'], ['#studio', 'Studio'], ['#tools', 'Tools'], ['#pricing', 'Pricing'], ['#trust', 'Trust']].map(([h, l]) => <a key={h} href={h} className="px-4 h-9 grid place-items-center rounded-full text-mute hover:text-paper hover:bg-white/5">{l}</a>)}
            </nav>
            <div className="flex items-center gap-2">
              {!session && <Link to="/login" className="hidden sm:inline-flex h-10 px-4 items-center text-sm text-mute hover:text-paper">Sign in</Link>}
              <Link to={start} className="sweep inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-paper text-ink text-sm font-medium">{session ? 'Open studio' : 'Get started'}<ArrowUpRight className="size-4" /></Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative h-[100svh] min-h-[680px] overflow-hidden">
          <motion.div style={{ y: bgY, scale: bgS }} className="absolute inset-0">
            <img src="/media/hero.jpg" alt="" className="w-full h-full object-cover object-[50%_60%]" fetchPriority="high" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/10 to-ink" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_30%,rgba(9,9,10,0.75)_80%)]" />

          <SceneCard y={c1} src="/media/scene-city.jpg" label="Scene 02 · B-roll" meta={<span className="text-ok">Matched “night city”</span>} className="left-[4%] top-[24%] w-[260px] rotate-[-4deg]" />
          <SceneCard y={c2} src="/media/sample-waves.mp4" video label="Preview · 9:16" meta={<span>Safe zones <Check className="inline size-3 text-ok" /></span>} className="right-[5%] top-[20%] w-[280px] rotate-[3deg]" />
          <SceneCard y={c3} src="/media/scene-studio.jpg" label="Hook 84/100" meta="“Stop editing like it’s 2015.”" className="right-[12%] bottom-[12%] w-[240px] rotate-[-2deg]" />
          <motion.div style={{ y: c2 }} className="absolute left-[9%] bottom-[14%] hidden lg:block">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 1.1, ease: ease.film }} className="glass hairline rounded-2xl p-3 w-[250px] shadow-[var(--shadow-float)]">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-mute mb-2"><span>Voice · Music</span><span>−14 LUFS</span></div>
              <div className="flex items-center gap-[2px] h-10">{Array.from({ length: 52 }).map((_, i) => <span key={i} className="flex-1 rounded-full bg-gradient-to-t from-violet to-azure" style={{ height: `${20 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 80}%` }} />)}</div>
            </motion.div>
          </motion.div>

          <motion.div style={{ opacity: fade }} className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="inline-flex items-center gap-2 rounded-full glass hairline pl-1 pr-3 py-1 text-xs text-mute mb-8">
              <span className="rounded-full bg-paper text-ink px-2 py-0.5 font-semibold">New</span> The honest AI video studio — real renders, real status
            </motion.div>
            <h1 className="font-display text-[clamp(3.2rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.02em]">
              <MaskLine delay={0.3}>Every idea deserves</MaskLine>
              <MaskLine delay={0.45} className="italic bg-gradient-to-r from-paper via-[#e9d7bf] to-amber bg-clip-text text-transparent">a premiere.</MaskLine>
            </h1>
            <motion.p initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1, delay: 0.9 }} className="mt-7 max-w-xl text-[17px] text-mute leading-relaxed">
              Write, assemble, check and export cinematic videos in one calm studio. Built for creators of every age — one clear step at a time.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.1 }} className="mt-10 flex flex-col sm:flex-row items-center gap-4">
              <Magnetic to={start}>Start creating — free <ArrowRight className="size-4" /></Magnetic>
              <button onClick={() => setReel(true)} className="inline-flex items-center gap-2.5 h-14 px-5 text-[15px] text-paper/90 hover:text-paper"><span className="size-9 rounded-full glass hairline grid place-items-center"><Play className="size-3.5 fill-current" /></span>Watch the sample</button>
            </motion.div>
          </motion.div>
          <div className="absolute bottom-8 inset-x-0 flex justify-center z-10"><div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">Scroll</div></div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="relative mx-auto max-w-[1400px] px-5 md:px-10 py-28 md:py-40 grid lg:grid-cols-[1fr_1.2fr] gap-16">
          <div className="lg:sticky lg:top-32 self-start">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim mb-5">01 — Workflow</div>
            <h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">From a sentence<br /><span className="italic text-mute">to a finished file.</span></h2>
            <p className="mt-6 text-mute max-w-md leading-relaxed">Only the questions that matter. You approve every step, and every job shows its real progress — or a clear reason it couldn’t run.</p>
          </div>
          <div className="relative">
            <svg className="absolute left-[27px] top-6 bottom-6 w-2 h-[calc(100%-48px)]" aria-hidden><line x1="4" y1="0" x2="4" y2="100%" stroke="url(#wf)" strokeWidth="2" className="flow-line" /><defs><linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a8cff" /><stop offset="0.5" stopColor="#74a9ff" /><stop offset="1" stopColor="#e9b56a" /></linearGradient></defs></svg>
            {[
              ['Describe it', 'Type or speak: “a 45-second recipe short for garlic noodles”. The Universal Create button routes you to the right workflow.', Sparkles],
              ['Shape the story', 'Get an editable scene list — from your AI provider when connected, or from a transparent structure template.', Layers],
              ['Bring your media', 'Drop clips, photos and music. Auto B-Roll matches them to scenes by meaning.', AudioWaveform],
              ['Check before you ship', 'Retention Doctor, Safe-Zone Guardian, Accessibility Inspector and the Export Quality Gate review your real timeline.', Gauge],
              ['Export a real file', 'A genuine MP4/WebM rendered from your timeline, with captions burned in and credits shown up front.', Captions],
            ].map(([t, d, I], i) => {
              const Ico = I as typeof Sparkles;
              return (
                <motion.div key={t as string} initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-15%' }} transition={{ duration: 0.8, ease: ease.out }} className="relative flex gap-6 pb-14 last:pb-0">
                  <div className="relative z-10 size-14 shrink-0 rounded-2xl bg-panel hairline grid place-items-center shadow-[0_0_40px_-10px_rgba(154,140,255,0.5)]"><Ico className="size-5 text-paper" /></div>
                  <div className="pt-2">
                    <div className="font-mono text-[11px] text-dim">STEP 0{i + 1}</div>
                    <h3 className="font-display text-3xl mt-1">{t as string}</h3>
                    <p className="text-mute mt-2 max-w-md leading-relaxed">{d as string}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Studio showcase */}
        <section id="studio" className="relative py-24 md:py-32 border-y border-line bg-coal/50">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div><div className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim mb-5">02 — Studio</div><h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">A real multitrack editor.<br /><span className="italic text-mute">Precise, calm, yours.</span></h2></div>
              <p className="text-mute max-w-sm leading-relaxed">Trim, split, snap, restyle captions, balance audio and preview transitions — with undo for everything and autosave on every change.</p>
            </div>
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: ease.film }} className="rounded-3xl hairline bg-panel overflow-hidden shadow-[var(--shadow-float)]">
              <div className="grid md:grid-cols-[220px_1fr_240px] border-b border-line">
                <div className="hidden md:grid grid-cols-2 gap-2 p-3 border-r border-line content-start">
                  {['scene-city', 'scene-forest', 'scene-kitchen', 'scene-studio'].map((s) => <img key={s} src={`/media/${s}.jpg`} alt="" loading="lazy" className="rounded-lg aspect-video object-cover" />)}
                </div>
                <div className="relative aspect-video bg-black">
                  <img src="/media/scene-forest.jpg" alt="Editor preview" loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute bottom-[12%] inset-x-0 text-center"><span className="bg-black/60 px-3 py-1.5 rounded-md text-sm md:text-lg font-semibold">The ridge was quiet before sunrise.</span></div>
                </div>
                <div className="hidden md:block p-4 border-l border-line text-xs space-y-3">
                  <div className="font-mono uppercase tracking-widest text-dim">Caption</div>
                  {[['Font', 'Hanken · 700'], ['Size', '5.2%'], ['Contrast', '11.4:1 ✓'], ['Position', 'Safe zone ✓'], ['Transition', 'Fade 0.4s']].map(([a, b]) => <div key={a} className="flex justify-between"><span className="text-mute">{a}</span><span>{b}</span></div>)}
                </div>
              </div>
              <div className="p-3 space-y-1.5 relative">
                <div className="absolute top-0 bottom-0 left-[38%] w-px bg-amber z-10"><div className="size-2.5 bg-amber rotate-45 -translate-x-[4.5px] -translate-y-1" /></div>
                {[
                  { n: 'Video', c: 'bg-azure/25 border-azure/40', clips: [[0, 22], [22, 18], [40, 26], [66, 30]], img: true },
                  { n: 'Titles', c: 'bg-violet/25 border-violet/40', clips: [[2, 14], [70, 18]] },
                  { n: 'Captions', c: 'bg-paper/15 border-paper/25', clips: [[0, 9], [10, 11], [22, 9], [32, 12], [45, 10], [56, 13], [70, 12], [83, 12]] },
                  { n: 'Music', c: 'bg-amber/20 border-amber/40', clips: [[0, 96]], wave: true },
                ].map((tr) => (
                  <div key={tr.n} className="flex items-center gap-2 h-10">
                    <div className="w-20 text-[11px] text-mute font-mono shrink-0">{tr.n}</div>
                    <div className="relative flex-1 h-full">
                      {tr.clips.map(([l, w], i) => (
                        <div key={i} className={cx('absolute top-0 bottom-0 rounded-md border overflow-hidden', tr.c)} style={{ left: `${l}%`, width: `${w - 0.4}%` }}>
                          {tr.img && <img src={`/media/${['scene-city', 'scene-forest', 'scene-kitchen', 'scene-studio'][i]}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-70" />}
                          {tr.wave && <div className="flex items-center gap-[2px] h-full px-1">{Array.from({ length: 120 }).map((_, j) => <span key={j} className="flex-1 bg-amber/70 rounded-full" style={{ height: `${15 + Math.abs(Math.sin(j * 0.5) * Math.sin(j * 0.13)) * 75}%` }} />)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="mx-auto max-w-[1400px] px-5 md:px-10 py-28 md:py-40">
          <div className="grid lg:grid-cols-2 gap-10 mb-16">
            <div><div className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim mb-5">03 — Tools</div><h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">55 tools.<br /><span className="italic text-mute">One shared studio.</span></h2></div>
            <div className="self-end">
              <p className="text-mute leading-relaxed max-w-md">Every tool uses the same projects, media, editor and export system. Each is labeled honestly.</p>
              <div className="flex flex-wrap gap-3 mt-5 text-sm">
                <span className="rounded-full border border-ok/30 bg-ok/10 text-ok px-3 py-1">{counts.working} working</span>
                <span className="rounded-full border border-amber/30 bg-amber/10 text-amber px-3 py-1">{counts.partial} partial</span>
                <span className="rounded-full border border-line2 text-mute px-3 py-1">{counts.pending} need a provider</span>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line rounded-3xl overflow-hidden hairline">
            {CATEGORIES.map((c, i) => {
              const fs = FEATURES.filter((f) => f.cats.includes(c.id));
              return (
                <motion.div key={c.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: (i % 3) * 0.08 }} className="group bg-ink p-7 hover:bg-panel transition-colors">
                  <div className="flex items-baseline justify-between"><h3 className="font-display text-3xl">{CAT_LABEL[c.id]}</h3><span className="font-mono text-xs text-dim">{String(fs.length).padStart(2, '0')}</span></div>
                  <p className="text-sm text-mute mt-2">{c.blurb}</p>
                  <ul className="mt-5 space-y-1.5 text-sm">
                    {fs.slice(0, 4).map((f) => <li key={f.id} className="flex items-center gap-2"><span className={cx('size-1.5 rounded-full', f.status === 'working' ? 'bg-ok' : f.status === 'partial' ? 'bg-amber' : 'bg-dim')} />{f.name}</li>)}
                    {fs.length > 4 && <li className="text-dim text-xs">+ {fs.length - 4} more</li>}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="relative py-28 md:py-36 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(154,140,255,0.12),transparent_60%),radial-gradient(ellipse_at_80%_60%,rgba(233,181,106,0.10),transparent_55%)]" />
          <div className="relative mx-auto max-w-[1400px] px-5 md:px-10 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim mb-5">04 — Trust</div>
              <h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">We never fake<br /><span className="italic">a render.</span></h2>
              <p className="mt-6 text-mute max-w-md leading-relaxed">No pretend progress bars. No invented analytics. No made-up licenses. If a provider isn’t connected, we say so — and show you how to connect it.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ['Real job status', 'Progress comes from the renderer. Cancel or retry anytime.'],
                ['Credits you can see', 'Cost shown before every job. Full refund on failure.'],
                ['Your rights, recorded', 'License and attribution tracked per asset.'],
                ['Keys stay server-side', 'Provider secrets never reach the browser.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl glass hairline p-6"><ShieldCheck className="size-5 text-amber mb-4" /><div className="font-medium">{t}</div><p className="text-sm text-mute mt-1.5 leading-relaxed">{d}</p></div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-[1400px] px-5 md:px-10 py-28 border-t border-line">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim mb-5">05 — Pricing</div>
          <h2 className="font-display text-5xl md:text-6xl tracking-tight mb-12">Start free. Grow when you’re ready.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p, i) => (
              <div key={p.id} className={cx('rounded-3xl hairline p-7 flex flex-col', i === 1 ? 'bg-paper text-ink' : 'bg-panel')}>
                <div className="font-display text-3xl">{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1"><span className="text-5xl font-display">${p.price}</span><span className={cx('text-sm', i === 1 ? 'text-ink/60' : 'text-dim')}>/month</span></div>
                <p className={cx('text-sm mt-3', i === 1 ? 'text-ink/70' : 'text-mute')}>{p.blurb}</p>
                <ul className="mt-6 space-y-2 text-sm flex-1">
                  {[`${p.monthlyCredits.toLocaleString()} credits / month`, `Exports up to ${p.maxRes}p`, `${p.seats} seat${p.seats > 1 ? 's' : ''}`, 'All analysis tools'].map((x) => <li key={x} className="flex gap-2"><Check className="size-4 shrink-0 mt-0.5" />{x}</li>)}
                </ul>
                <button onClick={() => nav(start)} className={cx('mt-8 h-11 rounded-xl font-medium text-sm', i === 1 ? 'bg-ink text-paper' : 'hairline hover:bg-white/5')}>{p.price === 0 ? 'Start free' : 'Choose ' + p.name}</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-dim mt-6">Paid plans activate once the payments integration is connected by the operator. Until then, all accounts run on Free.</p>
        </section>

        {/* Footer CTA */}
        <footer className="relative border-t border-line overflow-hidden">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10 pt-28 pb-12">
            <h2 className="font-display text-[clamp(3rem,11vw,10rem)] leading-[0.88] tracking-[-0.03em]">Roll camera<span className="italic text-amber">.</span></h2>
            <div className="mt-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <Magnetic to={start}>Open the studio <ArrowRight className="size-4" /></Magnetic>
              <div className="flex gap-6 text-sm text-mute"><Link to="/login" className="hover:text-paper">Sign in</Link><a href="#trust" className="hover:text-paper">Trust</a><a href="#pricing" className="hover:text-paper">Pricing</a></div>
            </div>
            <div className="mt-20 pt-6 border-t border-line flex justify-between text-xs text-dim"><Logo className="scale-75 origin-left" /><span>© {new Date().getFullYear()} Obscura Studio</span></div>
          </div>
        </footer>

        {reel && (
          <div className="fixed inset-0 z-[90] bg-black/90 grid place-items-center p-4" role="dialog" aria-label="Sample video" onClick={() => setReel(false)}>
            <button className="absolute top-5 right-5 size-11 grid place-items-center rounded-full glass" aria-label="Close"><X className="size-5" /></button>
            <video src="/media/sample-waves.mp4" controls autoPlay className="max-w-4xl w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

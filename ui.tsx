import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { dur, ease } from '../lib/motion';
import type { Severity } from '../lib/analyzers';
import type { FeatureStatus } from '../lib/features';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'amber'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode };
export function Button({ variant = 'ghost', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-paper text-ink hover:bg-white sweep shadow-[0_8px_30px_-10px_rgba(243,238,229,0.5)]',
    amber: 'bg-amber text-ink hover:brightness-110 sweep',
    ghost: 'hairline bg-white/[0.03] text-paper hover:bg-white/[0.07] hover:border-line2',
    quiet: 'text-mute hover:text-paper hover:bg-white/[0.05]',
    danger: 'bg-bad/15 text-bad hairline border-bad/30 hover:bg-bad/25',
  }[variant];
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl' }[size];
  return (
    <button {...rest} disabled={disabled || loading} className={cx('inline-flex items-center justify-center font-medium transition-[background,color,border,transform,filter] duration-200 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap', v, s, className)}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-[var(--radius-card)] hairline bg-panel/80', className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-mono text-[11px] uppercase tracking-[0.18em] text-dim', className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-4xl md:text-5xl leading-[1.02] tracking-tight text-balance">{title}</h1>
        {desc && <p className="mt-3 text-mute leading-relaxed">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-dim mt-1.5">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-bad mt-1.5">{error}</span>}
    </label>
  );
}
const inputCls = 'w-full rounded-xl bg-coal hairline px-3.5 py-2.5 text-sm text-paper placeholder:text-dim focus:border-amber/60 focus:outline-none transition-colors';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'min-h-24 resize-y leading-relaxed', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'appearance-none pr-8 bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%23aaa%27 stroke-width=%272%27><path d=%27M2 4l4 4 4-4%27/></svg>")] bg-no-repeat bg-[right_12px_center]', p.className)} />;

export function StatusPill({ status }: { status: FeatureStatus | 'connected' | 'configured' | 'not_configured' | 'error' | 'unreachable' }) {
  const map: Record<string, [string, string]> = {
    working: ['Working', 'text-ok bg-ok/10 border-ok/25'],
    partial: ['Partial', 'text-amber bg-amber/10 border-amber/25'],
    pending: ['Integration required', 'text-mute bg-white/5 border-line2'],
    connected: ['Connected', 'text-ok bg-ok/10 border-ok/25'],
    configured: ['Configured · untested', 'text-azure bg-azure/10 border-azure/25'],
    not_configured: ['Integration required', 'text-mute bg-white/5 border-line2'],
    error: ['Error', 'text-bad bg-bad/10 border-bad/25'],
    unreachable: ['API unreachable', 'text-mute bg-white/5 border-line2'],
  };
  const [label, cls] = map[status];
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', cls)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{label}</span>;
}

export function SeverityIcon({ s, className = 'size-4' }: { s: Severity; className?: string }) {
  if (s === 'ok') return <CheckCircle2 className={cx(className, 'text-ok')} aria-label="OK" />;
  if (s === 'warn') return <AlertTriangle className={cx(className, 'text-warn')} aria-label="Warning" />;
  if (s === 'bad') return <XCircle className={cx(className, 'text-bad')} aria-label="Problem" />;
  return <Info className={cx(className, 'text-azure')} aria-label="Info" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-xl', className)} aria-hidden />;
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 rounded-[var(--radius-card)] border border-dashed border-line2">
      <div className="size-12 rounded-2xl bg-white/[0.04] hairline grid place-items-center text-mute mb-4">{icon}</div>
      <div className="font-display text-2xl">{title}</div>
      <p className="text-sm text-mute mt-1.5 max-w-sm">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; className?: string }) {
  const lid = useId();
  return (
    <div role="tablist" className={cx('inline-flex p-1 rounded-xl hairline bg-coal gap-1 overflow-x-auto max-w-full scroll-thin', className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('relative px-3.5 h-8 text-[13px] rounded-lg transition-colors whitespace-nowrap', value === t.id ? 'text-ink' : 'text-mute hover:text-paper')}>
          {value === t.id && <motion.span layoutId={`tab-${lid}`} className="absolute inset-0 rounded-lg bg-paper" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
          <span className="relative">{t.label}{t.count !== undefined && <span className="ml-1.5 opacity-60 tabular">{t.count}</span>}</span>
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button:not([data-close])')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }} transition={{ duration: dur.base, ease: ease.out }}
            className={cx('relative w-full max-h-[90vh] overflow-auto scroll-thin rounded-3xl bg-panel shadow-[var(--shadow-float)]', wide ? 'max-w-3xl' : 'max-w-lg')}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-panel/95 border-b border-line">
              <h2 className="font-display text-2xl">{title}</h2>
              <button data-close onClick={onClose} aria-label="Close" className="size-9 grid place-items-center rounded-lg text-mute hover:text-paper hover:bg-white/5"><X className="size-4" /></button>
            </div>
            <div className="p-6">{children}</div>
            {footer && <div className="sticky bottom-0 px-6 py-4 border-t border-line bg-panel/95 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Confirm ---------- */
type ConfirmOpts = { title: string; body: string; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; tone: Severity; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(text: string, tone?: Severity, action?: Toast['action']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const push = useCallback((text: string, tone: Severity = 'info', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 8000 : 4500);
  }, []);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), []);
  const close = (v: boolean) => { confirm?.resolve(v); setConfirm(null); };
  return (
    <ToastCtx.Provider value={push}>
      <ConfirmCtx.Provider value={ask}>
        {children}
        <div className="fixed bottom-20 right-4 z-[90] flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: 20 }} transition={{ duration: dur.base, ease: ease.out }}
                className="glass hairline rounded-2xl px-4 py-3 flex items-start gap-3 shadow-[var(--shadow-float)]">
                <SeverityIcon s={t.tone} className="size-4 mt-0.5 shrink-0" />
                <p className="text-sm flex-1 leading-snug">{t.text}</p>
                {t.action && <button className="text-sm font-semibold text-amber hover:underline" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
                <button aria-label="Dismiss" className="text-dim hover:text-paper" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X className="size-3.5" /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <Dialog open={!!confirm} onClose={() => close(false)} title={confirm?.title ?? ''} footer={<><Button variant="quiet" onClick={() => close(false)}>Keep it</Button><Button variant={confirm?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{confirm?.confirm ?? 'Confirm'}</Button></>}>
          <p className="text-mute leading-relaxed">{confirm?.body}</p>
        </Dialog>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)} aria-describedby={id}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.span id={id} role="tooltip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-paper text-ink text-xs font-medium px-2.5 py-1.5 shadow-lg">{label}</motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 rounded-full bg-white/[0.07] overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-violet via-azure to-amber transition-[width] duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-4 py-3 text-left">
      <span><span className="block text-sm font-medium">{label}</span>{desc && <span className="block text-xs text-dim mt-0.5">{desc}</span>}</span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-amber' : 'bg-white/10')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 34 }} className={cx('absolute top-0.5 size-5 rounded-full bg-paper', checked ? 'right-0.5' : 'left-0.5')} />
      </span>
    </button>
  );
}

/** Animated count-up for real metrics */
export function CountUp({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
    if (reduce) { setV(value); from.current = value; return; }
    const start = performance.now(), a = from.current, d = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / d);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={cx('tabular', className)}>{v.toLocaleString()}{suffix}</span>;
}

export function download(blob: Blob | string, name: string) {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

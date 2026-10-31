import { Mic, MicOff, UploadCloud, Wand2, Volume2, FileWarning } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { listen, speak } from '../lib/speech';
import { Button, cx, SeverityIcon, Select, useToast } from './ui';
import type { Finding } from '../lib/analyzers';
import { ACCEPT, ingestFile } from '../lib/media';
import { useApp } from '../lib/useApp';
import type { Asset, Project } from '../lib/types';
import { useSettings } from '../lib/i18n';
import { tc } from '../lib/id';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9a8cff" /><stop offset="0.55" stopColor="#74a9ff" /><stop offset="1" stopColor="#e9b56a" /></linearGradient></defs>
        <circle cx="16" cy="16" r="13" fill="none" stroke="url(#lg)" strokeWidth="2.4" />
        <circle cx="16" cy="16" r="5.2" fill="#f3eee5" />
      </svg>
      <span className="font-display text-[22px] tracking-tight leading-none">Obscura</span>
    </span>
  );
}

export function VoiceButton({ onText, className }: { onText: (t: string) => void; className?: string }) {
  const [on, setOn] = useState(false);
  const stop = useRef<() => void>(() => {});
  const toast = useToast();
  const s = useSettings();
  const toggle = () => {
    if (on) { stop.current(); setOn(false); return; }
    setOn(true);
    stop.current = listen(s.lang === 'en' ? 'en-US' : s.lang, (t) => onText(t), (err) => { setOn(false); if (err) toast(err, 'warn'); });
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? 'Stop voice input' : 'Speak instead of typing'} className={cx('inline-flex items-center gap-2 h-10 px-3 rounded-xl hairline text-sm transition-colors', on ? 'bg-bad/15 text-bad border-bad/30' : 'text-mute hover:text-paper hover:bg-white/5', className)}>
      {on ? <MicOff className="size-4" /> : <Mic className="size-4" />}<span>{on ? 'Listening…' : 'Speak'}</span>
    </button>
  );
}

export function ReadAloud({ text, className }: { text: string; className?: string }) {
  return (
    <button type="button" onClick={() => speak(text)} className={cx('inline-flex items-center gap-1.5 text-xs text-mute hover:text-paper', className)} aria-label="Read this aloud">
      <Volume2 className="size-3.5" /> Read aloud
    </button>
  );
}

export function FindingList({ findings, onFix, onSeek }: { findings: Finding[]; onFix?: (f: Finding) => void; onSeek?: (t: number) => void }) {
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {findings.map((f, i) => (
          <motion.li key={f.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }} exit={{ opacity: 0 }}
            className={cx('rounded-2xl hairline p-4 flex gap-3', f.severity === 'bad' ? 'bg-bad/[0.05]' : f.severity === 'warn' ? 'bg-warn/[0.04]' : 'bg-white/[0.02]')}>
            <SeverityIcon s={f.severity} className="size-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.title}</span>
                {f.time !== undefined && (onSeek ? <button onClick={() => onSeek(f.time!)} className="font-mono text-[11px] text-azure hover:underline">{tc(f.time)}</button> : <span className="font-mono text-[11px] text-dim">{tc(f.time)}</span>)}
              </div>
              <p className="text-sm text-mute mt-1 leading-relaxed">{f.detail}</p>
              {f.fix && <p className="text-sm mt-1.5"><span className="text-dim">Fix: </span>{f.fix}</p>}
            </div>
            {f.fixId && onFix && <Button size="sm" variant="ghost" icon={<Wand2 className="size-3.5" />} onClick={() => onFix(f)}>Fix</Button>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function Dropzone({ onDone, compact, accept = ACCEPT, label }: { onDone?: (assets: Asset[]) => void; compact?: boolean; accept?: string; label?: string }) {
  const { user, workspace, allow } = useApp();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<{ name: string; i: number; n: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const handle = async (files: FileList | File[]) => {
    if (!allow('edit')) { toast('You have view-only access to this workspace.', 'warn'); return; }
    const list = [...files];
    const done: Asset[] = [];
    const errs: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy({ name: list[i].name, i: i + 1, n: list.length });
      const r = await ingestFile(list[i], { userId: user.id, workspaceId: workspace.id });
      if (r.asset) done.push(r.asset);
      else if (r.duplicateOf) { done.push(r.duplicateOf); toast(`“${list[i].name}” is already in your library — reused the existing copy.`, 'info'); }
      else if (r.error) errs.push(r.error);
    }
    setBusy(null);
    setErrors(errs);
    if (done.length) { toast(`${done.length} file${done.length > 1 ? 's' : ''} ready`, 'ok'); onDone?.(done); }
  };
  return (
    <div>
      <div role="button" tabIndex={0} aria-label={label ?? 'Upload media: drop files here or press Enter to browse'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) handle(e.dataTransfer.files); }}
        className={cx('relative cursor-pointer rounded-2xl border border-dashed transition-all grid place-items-center text-center', compact ? 'p-4' : 'p-10', over ? 'border-amber bg-amber/[0.06] scale-[1.01]' : 'border-line2 hover:border-mute/50 hover:bg-white/[0.02]')}>
        <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => { if (e.target.files?.length) handle(e.target.files); e.target.value = ''; }} />
        {busy ? (
          <div className="text-sm"><div className="font-medium">Checking & saving {busy.i} of {busy.n}</div><div className="text-dim mt-1 truncate max-w-64">{busy.name}</div><div className="mt-3 h-1 w-48 mx-auto rounded bg-white/10 overflow-hidden"><div className="h-full bg-amber transition-all" style={{ width: `${(busy.i / busy.n) * 100}%` }} /></div></div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className={cx('text-mute', compact ? 'size-5' : 'size-8')} />
            <div className={cx('font-medium', compact ? 'text-sm' : '')}>{label ?? 'Drop video, audio or images'}</div>
            {!compact && <div className="text-xs text-dim">MP4, WebM, MOV · MP3, WAV, M4A · PNG, JPG, WebP — up to 500 MB each. Files are checked and stored on this device.</div>}
          </div>
        )}
      </div>
      {errors.length > 0 && <ul className="mt-2 space-y-1">{errors.map((e) => <li key={e} className="text-xs text-bad flex gap-1.5"><FileWarning className="size-3.5 shrink-0" />{e}</li>)}</ul>}
    </div>
  );
}

export function ProjectPicker({ value, onChange, className }: { value?: string; onChange: (id: string) => void; className?: string }) {
  const { db, workspace } = useApp();
  const projects = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt);
  if (!projects.length) return <div className={cx('text-sm text-mute', className)}>No projects yet. <Link to="/app/create" className="text-amber hover:underline">Create one</Link> first.</div>;
  return (
    <Select aria-label="Choose a project" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cx('max-w-xs', className)}>
      <option value="" disabled>Choose a project…</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.title}{p.demo ? ' (demo)' : ''}</option>)}
    </Select>
  );
}

export function AssetThumb({ asset, className }: { asset?: Asset; className?: string }) {
  if (!asset) return <div className={cx('bg-raise grid place-items-center text-dim text-xs', className)}>—</div>;
  if (asset.thumb) return <img src={asset.thumb} alt="" className={cx('object-cover', className)} loading="lazy" />;
  if (asset.peaks) return (
    <div className={cx('bg-[#1a1626] flex items-center gap-[1px] px-1 overflow-hidden', className)} aria-hidden>
      {asset.peaks.filter((_, i) => i % 8 === 0).map((p, i) => <span key={i} className="flex-1 bg-violet/80 rounded-full" style={{ height: `${Math.max(6, p * 90)}%` }} />)}
    </div>
  );
  return <div className={cx('bg-raise', className)} />;
}

export function Section({ title, desc, children, actions }: { title: string; desc?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div><h2 className="font-display text-2xl md:text-3xl">{title}</h2>{desc && <p className="text-sm text-mute mt-1">{desc}</p>}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function useProjectParam(): [Project | undefined, (id: string) => void] {
  const { db, workspace } = useApp();
  const params = new URLSearchParams(window.location.search);
  const [id, setId] = useState(params.get('project') ?? db.projects.find((p) => p.workspaceId === workspace?.id && !p.deletedAt)?.id ?? '');
  const p = db.projects.find((x) => x.id === id && !x.deletedAt);
  const set = (v: string) => { setId(v); const u = new URL(window.location.href); u.searchParams.set('project', v); window.history.replaceState(null, '', u); };
  return [p, set];
}

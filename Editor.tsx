import { ArrowLeft, Captions, Clapperboard, Download, FileUp, Grid3x3, Magnet, Pause, Play, Plus, Redo2, Sparkles, Type, Undo2, Wand2, ZoomIn, ZoomOut, SkipBack, Check, Loader2, Camera, MessageSquare, AudioLines, Gauge } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Dialog, Empty, Input, Select, Tabs, Tip, cx, useConfirm, useToast, download } from '../components/ui';
import { AssetThumb, Dropzone } from '../components/shared';
import Timeline from '../components/editor/Timeline';
import Inspector from '../components/editor/Inspector';
import ExportDialog from '../components/editor/ExportDialog';
import { useApp } from '../lib/useApp';
import { useHistory } from '../lib/useHistory';
import { Engine } from '../lib/engine';
import { ASPECTS, CAPTION_STYLE, TITLE_STYLE, clipForAsset, makeClip, parseSRT, projectDuration, saveProject, snapshot, toSRT, toVTT, trackEnd } from '../lib/project';
import { parseRevision, REVISION_EXAMPLES, applyFix, type Revision } from '../lib/edits';
import { accessibilityInspector, retentionDoctor, PLATFORM_ZONES } from '../lib/analyzers';
import { uid, tc } from '../lib/id';
import { useSettings } from '../lib/i18n';
import { audit, update } from '../lib/db';
import type { Aspect, Clip, Project, Track } from '../lib/types';

type BinTab = 'media' | 'text' | 'captions';

export default function EditorPage() {
  const { id } = useParams();
  const { db, user, allow } = useApp();
  const p = db.projects.find((x) => x.id === id && !x.deletedAt);
  if (!p) return <div className="p-10"><Empty icon={<Clapperboard className="size-5" />} title="Project not found" desc="It may have been deleted, or you don’t have access." action={<Link to="/app/projects"><Button>Back to projects</Button></Link>} /></div>;
  if (!allow('view', p.workspaceId)) return <div className="p-10"><Empty icon={<Clapperboard className="size-5" />} title="No access" desc="Ask the workspace owner to invite you." /></div>;
  return <Editor key={p.id} initial={p} readOnly={!allow('edit', p.workspaceId)} userId={user.id} />;
}

function Editor({ initial, readOnly, userId }: { initial: Project; readOnly: boolean; userId: string }) {
  const { db } = useApp();
  const settings = useSettings();
  const pro = settings.mode === 'pro';
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const h = useHistory<Project>(initial);
  const proj = h.present;
  const assetsArr = useMemo(() => db.assets.filter((a) => a.workspaceId === proj.workspaceId), [db.assets, proj.workspaceId]);
  const assets = useMemo(() => new Map(assetsArr.map((a) => [a.id, a])), [assetsArr]);
  const library = assetsArr.filter((a) => !a.deletedAt && a.source !== 'render');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pps, setPps] = useState(60);
  const [bin, setBin] = useState<BinTab>('media');
  const [saved, setSaved] = useState<'saved' | 'saving'>('saved');
  const [exportOpen, setExportOpen] = useState(false);
  const [zones, setZones] = useState<string>('');
  const [rev, setRev] = useState('');
  const [revPlan, setRevPlan] = useState<Revision[] | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'media' | 'inspect'>('media');
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const timeRef = useRef(0);
  const stopAt = useRef<number | null>(null);
  const duration = projectDuration(proj);

  // Engine lifecycle
  useEffect(() => {
    if (!canvas.current) return;
    const e = new Engine(canvas.current, proj, assetsArr, { short: 540 });
    engine.current = e;
    e.onRedraw = () => { if (!playingRef.current) e.draw(timeRef.current); };
    e.prepare().then(() => e.draw(timeRef.current));
    return () => { e.destroy(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.setProject(proj, assetsArr);
    e.prepare().then(() => { if (!playingRef.current) { e.sync(timeRef.current, false); e.draw(timeRef.current); } });
    if (!playingRef.current) { e.sync(timeRef.current, false); e.draw(timeRef.current); }
  }, [proj, assetsArr]);

  // Autosave (debounced) — writes to the project record
  const saveTimer = useRef<number | undefined>(undefined);
  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    const cur = projRef.current;
    saveProject(cur.id, { tracks: cur.tracks, scenes: cur.scenes, title: cur.title, aspect: cur.aspect, fps: cur.fps, script: cur.script });
    setSaved('saved');
  }, []);
  const projRef = useRef(proj);
  projRef.current = proj;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (readOnly) return;
    setSaved('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 500);
  }, [proj, readOnly, flush]);
  useEffect(() => () => { if (!readOnly) flush(); }, [flush, readOnly]);
  useEffect(() => { snapshot(initial.id, 'Opened in editor (recovery point)'); }, [initial.id]);

  // Playback loop
  const playingRef = useRef(false);
  const seek = useCallback((t: number) => {
    const v = Math.max(0, Math.min(t, Math.max(duration, 0)));
    timeRef.current = v;
    setTime(v);
    const e = engine.current;
    if (e && !playingRef.current) { e.sync(v, false); e.draw(v); }
  }, [duration]);
  const play = useCallback(() => {
    if (playingRef.current || !engine.current) return;
    if (timeRef.current >= duration - 0.05) timeRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    const t0 = performance.now(), base = timeRef.current;
    let last = 0;
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const t = base + (now - t0) / 1000;
      const end = stopAt.current ?? duration;
      if (t >= end) { pause(); seek(Math.min(end, duration)); stopAt.current = null; return; }
      timeRef.current = t;
      engine.current?.sync(t, true);
      engine.current?.draw(t);
      if (now - last > 66) { setTime(t); last = now; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);
  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    engine.current?.pauseAll();
    setTime(timeRef.current);
  }, []);
  const previewRange = (a: number, b: number) => { pause(); seek(a); stopAt.current = b; setTimeout(play, 60); };

  // Clip helpers
  const loc = (cid: string | null) => { if (!cid) return null; for (const t of proj.tracks) { const c = t.clips.find((x) => x.id === cid); if (c) return { track: t, clip: c }; } return null; };
  const sel = loc(selected);
  const mutate = (fn: (p: Project) => void) => { if (readOnly) { toast('View-only: you can’t change this project.', 'warn'); return; } h.commit((cur) => { const n = structuredClone(cur); fn(n); return n; }); };
  const updateClip = (patch: Partial<Clip>, mode: 'begin' | 'live' | 'end' | 'commit') => {
    if (!selected || readOnly) return;
    if (mode === 'begin') return h.begin();
    if (mode === 'end') return h.end();
    const n = structuredClone(projRef.current);
    for (const t of n.tracks) { const c = t.clips.find((x) => x.id === selected); if (c) Object.assign(c, patch); }
    if (mode === 'live') h.live(n); else h.commit(n);
  };
  const split = () => {
    const target = sel && timeRef.current > sel.clip.start + 0.05 && timeRef.current < sel.clip.start + sel.clip.duration - 0.05 ? sel : null;
    const fallback = !target ? proj.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => ({ track: t, clip: c }))).find(({ clip }) => timeRef.current > clip.start + 0.05 && timeRef.current < clip.start + clip.duration - 0.05 && clip.kind !== 'caption') : null;
    const tg = target ?? fallback;
    if (!tg) { toast('Move the playhead over a clip to split it.', 'info'); return; }
    const t = timeRef.current;
    mutate((n) => {
      const tr = n.tracks.find((x) => x.id === tg.track.id)!;
      const c = tr.clips.find((x) => x.id === tg.clip.id)!;
      const cut = t - c.start;
      const b: Clip = { ...structuredClone(c), id: uid('c_'), start: +t.toFixed(3), duration: +(c.duration - cut).toFixed(3), offset: c.kind === 'video' || c.kind === 'audio' ? +(c.offset + cut).toFixed(3) : c.offset, transition: 'none', fadeIn: 0 };
      c.duration = +cut.toFixed(3);
      c.fadeOut = 0;
      tr.clips.push(b);
    });
  };
  const del = async () => {
    if (!sel) return;
    mutate((n) => { n.tracks.forEach((t) => { t.clips = t.clips.filter((c) => c.id !== sel.clip.id); }); });
    setSelected(null);
    toast('Clip removed.', 'info', { label: 'Undo', run: () => h.undo() });
  };
  const duplicate = () => {
    if (!sel) return;
    mutate((n) => { const tr = n.tracks.find((t) => t.id === sel.track.id)!; tr.clips.push({ ...structuredClone(sel.clip), id: uid('c_'), start: +(sel.clip.start + sel.clip.duration).toFixed(3) }); });
  };
  const addAsset = (assetId: string, trackId?: string, at?: number) => {
    const a = assets.get(assetId);
    if (!a) return;
    mutate((n) => {
      const kind: Track['kind'] = a.type === 'audio' ? 'audio' : 'video';
      let tr = trackId ? n.tracks.find((t) => t.id === trackId) : undefined;
      if (tr && !(tr.kind === kind || (tr.kind === 'overlay' && a.type === 'image') || (tr.kind === 'audio' && a.type === 'video'))) tr = undefined;
      tr = tr ?? n.tracks.find((t) => t.kind === kind && !t.locked);
      if (!tr) { tr = { id: uid('t_'), kind, name: kind === 'audio' ? 'Audio' : 'Video', muted: false, locked: false, hidden: false, clips: [] }; n.tracks.push(tr); }
      const start = at ?? trackEnd(tr);
      const c = clipForAsset(a, +start.toFixed(3));
      if (tr.kind === 'audio' && a.type === 'video') c.kind = 'video';
      if (tr.kind === 'overlay') c.transform = { scale: 0.35, x: 0.28, y: -0.28 };
      tr.clips.push(c);
      setSelected(c.id);
    });
  };
  const addText = (preset: 'title' | 'lower' | 'end' | 'wave') => {
    const t = timeRef.current;
    mutate((n) => {
      const ov = n.tracks.find((x) => x.kind === 'overlay')!;
      let c: Clip;
      if (preset === 'title') c = makeClip({ kind: 'text', start: t, duration: 3, text: 'Your title', style: { ...TITLE_STYLE }, transition: 'fade', fadeIn: 0.5, fadeOut: 0.3 });
      else if (preset === 'lower') c = makeClip({ kind: 'text', start: t, duration: 4, text: 'Name · Role', style: { ...CAPTION_STYLE, font: 'sans', size: 3.6, align: 'left', x: 0.08, y: 0.78, bg: 'rgba(0,0,0,0.6)', weight: 600 }, transition: 'slide', fadeIn: 0.4 });
      else if (preset === 'end') c = makeClip({ kind: 'text', start: Math.max(0, duration - 3), duration: 3, text: 'Follow for more →', style: { ...TITLE_STYLE, size: 8 }, transition: 'fade', fadeIn: 0.5 });
      else {
        const audio = library.find((a) => a.type === 'audio' && a.peaks);
        if (!audio) { toast('Upload an audio file first to add a waveform.', 'info'); return; }
        c = makeClip({ kind: 'wave', assetId: audio.id, start: 0, duration: audio.duration, color: '#e9b56a', style: { ...CAPTION_STYLE, y: 0.62 } });
      }
      ov.clips.push(c);
      setSelected(c.id);
    });
  };
  const addCaption = () => mutate((n) => { const cap = n.tracks.find((x) => x.kind === 'caption')!; const c = makeClip({ kind: 'caption', start: +timeRef.current.toFixed(2), duration: 2.5, text: 'New caption', style: { ...CAPTION_STYLE } }); cap.clips.push(c); setSelected(c.id); });
  const importSRT = () => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = '.srt,.vtt,text/plain';
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) return;
      const clips = parseSRT(await f.text());
      if (!clips.length) { toast('No captions found in that file. Check it’s a valid SRT or VTT.', 'bad'); return; }
      mutate((n) => { n.tracks.find((x) => x.kind === 'caption')!.clips = clips; });
      toast(`Imported ${clips.length} captions.`, 'ok');
    };
    i.click();
  };
  const caps = proj.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips);

  // Keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') { e.preventDefault(); if (playingRef.current) pause(); else play(); }
      else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); h.redo(); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); h.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); h.redo(); }
      else if (e.key.toLowerCase() === 's' && !mod) { e.preventDefault(); split(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); del(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = (e.shiftKey ? 1 : 1 / proj.fps) * (e.key === 'ArrowLeft' ? -1 : 1);
        if (sel && e.altKey) updateClip({ start: Math.max(0, +(sel.clip.start + step).toFixed(3)) }, 'commit');
        else seek(timeRef.current + step);
      } else if (e.key === 'Home') seek(0);
      else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const runRevision = () => {
    const plan = parseRevision(rev, proj);
    if (!plan) { toast(`I didn’t understand that yet. Try: “${REVISION_EXAMPLES[Math.floor(Math.random() * REVISION_EXAMPLES.length)]}”.`, 'info'); return; }
    setRevPlan(plan);
  };
  const applyRevision = () => {
    if (!revPlan) return;
    mutate((n) => { let cur = n; for (const r of revPlan) cur = r.apply(cur); Object.assign(n, cur); });
    update((d) => { d.prefs.unshift({ id: uid('pf_'), userId, key: 'revision', value: revPlan.map((r) => r.summary).join(' + '), at: Date.now() }); });
    audit(userId, 'revision.apply', proj.id, revPlan.map((r) => r.summary).join('; '));
    toast('Applied. Press Undo to revert.', 'ok', { label: 'Undo', run: () => h.undo() });
    setRevPlan(null); setRev('');
  };

  const quick = useMemo(() => {
    const r = retentionDoctor(proj).filter((f) => f.severity === 'bad' || f.severity === 'warn').length;
    const a = accessibilityInspector(proj).filter((f) => f.severity === 'bad' || f.severity === 'warn').length;
    return { r, a };
  }, [proj]);
  const zone = zones ? PLATFORM_ZONES[zones] : null;
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);
  const [aw, ah] = proj.aspect.split(':').map(Number);
  const fit = box.w && box.h ? (box.w / box.h > aw / ah ? { w: Math.floor(box.h * aw / ah), h: Math.floor(box.h) } : { w: Math.floor(box.w), h: Math.floor(box.w * ah / aw) }) : { w: 0, h: 0 };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-ink">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-line bg-coal/60 shrink-0 overflow-x-auto scroll-thin">
        <Button size="sm" variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => { flush(); nav('/app/projects'); }} aria-label="Back to projects" />
        <input value={proj.title} onChange={(e) => h.live({ ...proj, title: e.target.value })} onFocus={h.begin} onBlur={h.end} disabled={readOnly} aria-label="Project title" className="bg-transparent font-display text-xl min-w-0 w-40 md:w-64 px-2 rounded-lg hover:bg-white/5 focus:bg-white/5 focus:outline-none" />
        {proj.demo && <span className="text-[10px] uppercase tracking-wider bg-amber text-ink rounded px-1.5 py-0.5 font-semibold">Demo</span>}
        <span className="text-xs text-dim flex items-center gap-1 shrink-0" aria-live="polite">{readOnly ? 'View only' : saved === 'saving' ? <><Loader2 className="size-3 animate-spin" />Saving…</> : <><Check className="size-3 text-ok" />Saved</>}</span>
        <div className="flex items-center gap-0.5 ml-2">
          <Tip label="Undo (Ctrl/⌘ Z)"><Button size="sm" variant="quiet" icon={<Undo2 className="size-4" />} onClick={h.undo} disabled={!h.canUndo} aria-label="Undo" /></Tip>
          <Tip label="Redo (Ctrl/⌘ Shift Z)"><Button size="sm" variant="quiet" icon={<Redo2 className="size-4" />} onClick={h.redo} disabled={!h.canRedo} aria-label="Redo" /></Tip>
        </div>
        <form className="hidden md:flex items-center flex-1 max-w-lg ml-2" onSubmit={(e) => { e.preventDefault(); runRevision(); }}>
          <div className="relative flex-1">
            <Wand2 className="size-4 text-violet absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={rev} onChange={(e) => setRev(e.target.value)} disabled={readOnly} placeholder="Ask for a change… “make captions bigger and vertical”" aria-label="Revision request" className="w-full h-9 rounded-xl bg-white/[0.04] hairline pl-9 pr-3 text-sm placeholder:text-dim focus:outline-none focus:border-violet/50" />
          </div>
        </form>
        <div className="flex-1 md:hidden" />
        <Link to={`/app/tool/retention?project=${proj.id}`} onClick={flush} className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-mute hover:text-paper hover:bg-white/5" title="Retention Doctor"><Gauge className="size-3.5" />{quick.r ? <span className="text-warn">{quick.r}</span> : <Check className="size-3 text-ok" />}</Link>
        <Link to={`/app/tool/a11y?project=${proj.id}`} onClick={flush} className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-mute hover:text-paper hover:bg-white/5" title="Accessibility Inspector"><Captions className="size-3.5" />{quick.a ? <span className="text-warn">{quick.a}</span> : <Check className="size-3 text-ok" />}</Link>
        <Link to={`/app/review/${proj.id}`} onClick={flush} className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-mute hover:text-paper hover:bg-white/5"><MessageSquare className="size-3.5" />Review</Link>
        <Button size="sm" variant="primary" icon={<Clapperboard className="size-4" />} onClick={() => { flush(); setExportOpen(true); }} disabled={duration <= 0}>Export</Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] lg:grid-rows-[minmax(0,1fr)_minmax(220px,38vh)]">
        <div className="min-h-0 grid lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          {/* Bin */}
          <aside className={cx('border-r border-line bg-panel/50 min-h-0 flex-col', mobilePanel === 'media' ? 'hidden lg:flex' : 'hidden lg:flex')}>
            <BinPanel tab={bin} setTab={setBin} library={library} onAdd={(id) => addAsset(id, undefined, timeRef.current)} addText={addText} addCaption={addCaption} importSRT={importSRT} caps={caps} title={proj.title}
              genCaptions={() => { mutate((n) => Object.assign(n, applyFix(n, 'captions-from-scenes'))); toast('Captions generated from scene narration.', 'ok'); }} readOnly={readOnly} />
          </aside>

          {/* Preview */}
          <div className="min-h-0 min-w-0 flex flex-col items-center p-3 md:p-5 gap-3 bg-[radial-gradient(ellipse_at_center,#141418,#09090a_70%)] h-[46vh] lg:h-auto">
            <div ref={stage} className="relative flex-1 min-h-0 w-full flex items-center justify-center">
              <div className="relative" style={{ width: fit.w, height: fit.h }}>
                <canvas ref={canvas} className="w-full h-full rounded-lg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] bg-black" aria-label="Video preview" role="img" />
                {zone && (
                  <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden" aria-hidden>
                    <div className="absolute inset-x-0 top-0 bg-bad/25 border-b border-bad/60" style={{ height: `${zone.top * 100}%` }} />
                    <div className="absolute inset-x-0 bottom-0 bg-bad/25 border-t border-bad/60" style={{ height: `${zone.bottom * 100}%` }} />
                    <div className="absolute right-0 bg-bad/20 border-l border-bad/50" style={{ top: `${zone.top * 100}%`, bottom: `${zone.bottom * 100}%`, width: `${zone.right * 100}%` }} />
                    <div className="absolute left-2 top-2 text-[10px] font-mono bg-black/70 rounded px-1.5 py-0.5">{zone.label} UI</div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full max-w-xl">
              <Button size="sm" variant="quiet" icon={<SkipBack className="size-4" />} onClick={() => seek(0)} aria-label="Go to start" />
              <button onClick={() => (playing ? pause() : play())} disabled={duration <= 0} className="size-11 rounded-full bg-paper text-ink grid place-items-center hover:bg-white disabled:opacity-40" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current translate-x-[1px]" />}</button>
              <span className="font-mono text-xs tabular text-mute w-28">{tc(time)} / {tc(duration)}</span>
              <input type="range" min={0} max={Math.max(0.1, duration)} step={0.01} value={time} onChange={(e) => { pause(); seek(Number(e.target.value)); }} className="flex-1" aria-label="Seek" />
              <Select value={zones} onChange={(e) => setZones(e.target.value)} className="w-auto py-1.5 text-xs" aria-label="Show platform safe zones">
                <option value="">Safe zones off</option>{Object.entries(PLATFORM_ZONES).map(([k, z]) => <option key={k} value={k}>{z.label}</option>)}
              </Select>
            </div>
          </div>

          {/* Inspector */}
          <aside className="hidden lg:block border-l border-line bg-panel/50 min-h-0 overflow-y-auto scroll-thin p-4">
            {sel ? (
              <Inspector project={proj} clip={sel.clip} track={sel.track} asset={sel.clip.assetId ? assets.get(sel.clip.assetId) : undefined} update={updateClip} onSplit={split} onDelete={del} onDuplicate={duplicate} onPreview={previewRange} />
            ) : (
              <ProjectPanel proj={proj} readOnly={readOnly} setAspect={(a) => mutate((n) => { n.aspect = a; })} setFps={(f) => mutate((n) => { n.fps = f; })} pro={pro} onSnapshot={() => { flush(); snapshot(proj.id, 'Manual snapshot'); toast('Snapshot saved. Compare in Version Diff.', 'ok'); }} />
            )}
          </aside>
        </div>

        {/* Mobile panels */}
        <div className="lg:hidden border-t border-line bg-panel/60">
          <div className="flex gap-1 p-2">{(['media', 'inspect'] as const).map((m) => <button key={m} onClick={() => setMobilePanel(m)} className={cx('flex-1 h-10 rounded-lg text-sm', mobilePanel === m ? 'bg-paper text-ink' : 'text-mute')}>{m === 'media' ? 'Add' : sel ? 'Edit clip' : 'Project'}</button>)}</div>
          <div className="max-h-[34vh] overflow-y-auto p-3">
            {mobilePanel === 'media' ? <BinPanel tab={bin} setTab={setBin} library={library} onAdd={(id) => addAsset(id, undefined, timeRef.current)} addText={addText} addCaption={addCaption} importSRT={importSRT} caps={caps} title={proj.title} genCaptions={() => mutate((n) => Object.assign(n, applyFix(n, 'captions-from-scenes')))} readOnly={readOnly} />
              : sel ? <Inspector project={proj} clip={sel.clip} track={sel.track} asset={sel.clip.assetId ? assets.get(sel.clip.assetId) : undefined} update={updateClip} onSplit={split} onDelete={del} onDuplicate={duplicate} onPreview={previewRange} />
              : <ProjectPanel proj={proj} readOnly={readOnly} setAspect={(a) => mutate((n) => { n.aspect = a; })} setFps={(f) => mutate((n) => { n.fps = f; })} pro={pro} onSnapshot={() => { flush(); snapshot(proj.id, 'Manual snapshot'); toast('Snapshot saved.', 'ok'); }} />}
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-line bg-coal flex flex-col min-h-[220px] h-[38vh] lg:h-auto">
          <div className="flex items-center gap-2 px-3 h-10 border-b border-line text-xs shrink-0">
            <Button size="sm" variant="quiet" icon={<Grid3x3 className="size-3.5" />} onClick={split} disabled={readOnly}>Split <kbd className="font-mono text-[10px] opacity-60 ml-1">S</kbd></Button>
            <span className="text-dim hidden md:flex items-center gap-1"><Magnet className="size-3.5 text-azure" />Snapping on</span>
            <div className="flex-1" />
            <span className="text-dim hidden md:inline">{proj.tracks.reduce((a, t) => a + t.clips.length, 0)} clips</span>
            <Button size="sm" variant="quiet" icon={<ZoomOut className="size-3.5" />} onClick={() => setPps((v) => Math.max(12, v / 1.4))} aria-label="Zoom out" />
            <input type="range" min={12} max={240} value={pps} onChange={(e) => setPps(Number(e.target.value))} className="w-24" aria-label="Timeline zoom" />
            <Button size="sm" variant="quiet" icon={<ZoomIn className="size-3.5" />} onClick={() => setPps((v) => Math.min(240, v * 1.4))} aria-label="Zoom in" />
          </div>
          <div className="flex-1 min-h-0">
            {proj.tracks.some((t) => t.clips.length) || true ? (
              <Timeline project={proj} assets={assets} time={time} pps={pps} selected={selected} onSelect={setSelected} onSeek={(t) => { pause(); seek(t); }}
                onBegin={() => { if (!readOnly) h.begin(); }} onLive={(n) => { if (!readOnly) h.live(n); }} onEnd={() => { if (!readOnly) h.end(); }}
                onTrack={(tid, patch) => mutate((n) => { Object.assign(n.tracks.find((t) => t.id === tid)!, patch); })}
                onDropAsset={(aid, tid, t) => addAsset(aid, tid, t)} duration={duration} />
            ) : null}
          </div>
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} project={proj} onApply={(n) => h.commit(n)} flush={flush} />
      <Dialog open={!!revPlan} onClose={() => setRevPlan(null)} title="Preview changes" footer={<><Button variant="quiet" onClick={() => setRevPlan(null)}>Cancel</Button><Button variant="primary" icon={<Sparkles className="size-4" />} onClick={applyRevision}>Apply changes</Button></>}>
        <p className="text-sm text-mute mb-4">For “{rev}”, I’ll make these edits. You can undo afterwards.</p>
        <ul className="space-y-2">{revPlan?.map((r, i) => <li key={i} className="flex gap-2 rounded-xl hairline p-3 text-sm"><Wand2 className="size-4 text-violet shrink-0 mt-0.5" />{r.summary}</li>)}</ul>
        <p className="text-xs text-dim mt-4">Rule-based revision agent. Open-ended requests need the text provider.</p>
      </Dialog>
      {false && confirm}
    </div>
  );
}

function BinPanel({ tab, setTab, library, onAdd, addText, addCaption, importSRT, caps, title, genCaptions, readOnly }: { tab: BinTab; setTab: (t: BinTab) => void; library: ReturnType<typeof useApp>['db']['assets']; onAdd: (id: string) => void; addText: (p: 'title' | 'lower' | 'end' | 'wave') => void; addCaption: () => void; importSRT: () => void; caps: Clip[]; title: string; genCaptions: () => void; readOnly: boolean }) {
  const [q, setQ] = useState('');
  const list = library.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.tags.some((t) => t.includes(q.toLowerCase())));
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-line"><Tabs tabs={[{ id: 'media', label: 'Media', count: library.length }, { id: 'text', label: 'Text' }, { id: 'captions', label: 'Captions', count: caps.length }]} value={tab} onChange={setTab} className="w-full" /></div>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-3">
        {tab === 'media' && (
          <>
            {!readOnly && <Dropzone compact />}
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search media or tags" className="py-2 text-xs" aria-label="Search media" />
            <div className="grid grid-cols-2 gap-2">
              {list.map((a) => (
                <div key={a.id} draggable={!readOnly} onDragStart={(e) => { e.dataTransfer.setData('text/asset-id', a.id); e.dataTransfer.effectAllowed = 'copy'; }} className="group relative rounded-lg overflow-hidden hairline bg-raise cursor-grab">
                  <AssetThumb asset={a} className="w-full aspect-video" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4"><div className="text-[10px] truncate">{a.name}</div>{a.duration > 0 && <div className="text-[9px] font-mono text-mute">{tc(a.duration)}</div>}</div>
                  {!readOnly && <button onClick={() => onAdd(a.id)} aria-label={`Add ${a.name} at playhead`} className="absolute top-1 right-1 size-7 rounded-md bg-paper text-ink grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100"><Plus className="size-4" /></button>}
                  {a.demo && <span className="absolute top-1 left-1 text-[8px] uppercase bg-amber text-ink rounded px-1 font-bold">demo</span>}
                </div>
              ))}
            </div>
            {!list.length && <p className="text-xs text-dim text-center py-4">{library.length ? 'No matches.' : 'Upload media to start.'}</p>}
            <p className="text-[11px] text-dim">Drag onto a track, or press + to add at the playhead.</p>
          </>
        )}
        {tab === 'text' && (
          <div className="space-y-2">
            {([['title', 'Title', 'Big serif title, centered'], ['lower', 'Lower third', 'Name and role, slides in'], ['end', 'End card', 'Call to action at the end'], ['wave', 'Audiogram waveform', 'Animated bars from an audio file']] as const).map(([k, l, d]) => (
              <button key={k} disabled={readOnly} onClick={() => addText(k)} className="w-full text-left rounded-xl hairline p-3 hover:bg-white/[0.04] disabled:opacity-40 flex gap-3 items-center">
                {k === 'wave' ? <AudioLines className="size-4 text-amber" /> : <Type className="size-4 text-violet" />}<span><span className="block text-sm">{l}</span><span className="block text-[11px] text-dim">{d}</span></span>
              </button>
            ))}
          </div>
        )}
        {tab === 'captions' && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" icon={<Sparkles className="size-3.5" />} onClick={genCaptions} disabled={readOnly}>Generate from scene narration</Button>
            <Button size="sm" className="w-full" icon={<Plus className="size-3.5" />} onClick={addCaption} disabled={readOnly}>Add caption at playhead</Button>
            <Button size="sm" className="w-full" icon={<FileUp className="size-3.5" />} onClick={importSRT} disabled={readOnly}>Import SRT / VTT</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="quiet" icon={<Download className="size-3.5" />} disabled={!caps.length} onClick={() => download(new Blob([toSRT(caps)], { type: 'text/plain' }), `${title}.srt`)}>SRT</Button>
              <Button size="sm" variant="quiet" icon={<Download className="size-3.5" />} disabled={!caps.length} onClick={() => download(new Blob([toVTT(caps)], { type: 'text/vtt' }), `${title}.vtt`)}>VTT</Button>
            </div>
            <p className="text-[11px] text-dim">Automatic transcription from audio needs a speech-to-text provider.</p>
            <ul className="space-y-1 pt-2">{[...caps].sort((a, b) => a.start - b.start).map((c) => <li key={c.id} className="text-xs flex gap-2"><span className="font-mono text-dim shrink-0">{tc(c.start)}</span><span className="truncate">{c.text}</span></li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectPanel({ proj, setAspect, setFps, pro, onSnapshot, readOnly }: { proj: Project; setAspect: (a: Aspect) => void; setFps: (f: number) => void; pro: boolean; onSnapshot: () => void; readOnly: boolean }) {
  return (
    <div className="space-y-5">
      <div><div className="font-mono text-[10px] uppercase tracking-widest text-dim">Project</div><p className="text-xs text-mute mt-1">Select a clip on the timeline to edit it.</p></div>
      <div>
        <div className="text-xs font-medium mb-2">Format</div>
        <div className="grid grid-cols-2 gap-1.5">{ASPECTS.map((a) => <button key={a.id} disabled={readOnly} onClick={() => setAspect(a.id)} aria-pressed={proj.aspect === a.id} className={cx('rounded-lg hairline px-2 py-2 text-xs text-left', proj.aspect === a.id ? 'bg-paper text-ink' : 'hover:bg-white/5')}>{a.id}<span className={cx('block text-[10px]', proj.aspect === a.id ? 'text-ink/60' : 'text-dim')}>{a.hint}</span></button>)}</div>
      </div>
      {pro && <label className="block text-xs"><span className="font-medium">Frame rate</span><Select value={proj.fps} onChange={(e) => setFps(Number(e.target.value))} className="mt-1.5 py-1.5 text-xs" disabled={readOnly}>{[24, 25, 30, 60].map((f) => <option key={f} value={f}>{f} fps</option>)}</Select></label>}
      <Button size="sm" icon={<Camera className="size-3.5" />} onClick={onSnapshot}>Save snapshot</Button>
      <div className="space-y-1.5 text-xs">
        <div className="font-medium mb-1">Checks & tools</div>
        {[['retention', 'Retention Doctor'], ['safezone', 'Safe-Zone Guardian'], ['a11y', 'Accessibility Inspector'], ['quality', 'Export Quality Gate'], ['revision', 'Revision Agent'], ['diff', 'Version Diff'], ['license', 'License Tracker']].map(([id, l]) => <Link key={id} to={`/app/tool/${id}?project=${proj.id}`} className="block text-mute hover:text-paper">{l} →</Link>)}
      </div>
    </div>
  );
}

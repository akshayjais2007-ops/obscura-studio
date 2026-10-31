import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Film, Type, Captions as CapIcon, Music, Image as ImgIcon } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import type { Asset, Clip, Project, Track } from '../../lib/types';
import { cx } from '../ui';
import { tc } from '../../lib/id';

const COLORS: Record<Track['kind'], string> = {
  video: 'bg-azure/20 border-azure/45',
  overlay: 'bg-violet/22 border-violet/45',
  caption: 'bg-paper/12 border-paper/30',
  audio: 'bg-amber/16 border-amber/45',
};
const ICON: Record<Track['kind'], typeof Film> = { video: Film, overlay: Type, caption: CapIcon, audio: Music };
const ACCEPTS: Record<Track['kind'], Clip['kind'][]> = { video: ['video', 'image', 'color'], overlay: ['text', 'image', 'wave', 'color'], caption: ['caption'], audio: ['audio'] };

const Wave = memo(function Wave({ peaks, from, to, color }: { peaks: number[]; from: number; to: number; color: string }) {
  const slice = useMemo(() => {
    const a = Math.max(0, Math.floor(from * peaks.length)), b = Math.min(peaks.length, Math.ceil(to * peaks.length));
    const s = peaks.slice(a, b);
    const n = 80;
    if (s.length <= n) return s;
    const step = s.length / n;
    return Array.from({ length: n }, (_, i) => Math.max(...s.slice(Math.floor(i * step), Math.floor((i + 1) * step) + 1)));
  }, [peaks, from, to]);
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${slice.length} 100`} aria-hidden>
      {slice.map((p, i) => { const h = Math.max(4, p * 90); return <rect key={i} x={i + 0.15} width={0.7} y={50 - h / 2} height={h} rx={0.3} fill={color} />; })}
    </svg>
  );
});

interface Props {
  project: Project;
  assets: Map<string, Asset>;
  time: number;
  pps: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  onBegin: () => void;
  onLive: (p: Project) => void;
  onEnd: () => void;
  onTrack: (id: string, patch: Partial<Track>) => void;
  onDropAsset: (assetId: string, trackId: string, t: number) => void;
  duration: number;
}

export default function Timeline({ project, assets, time, pps, selected, onSelect, onSeek, onBegin, onLive, onEnd, onTrack, onDropAsset, duration }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [snapX, setSnapX] = useState<number | null>(null);
  const [dropTrack, setDropTrack] = useState<string | null>(null);
  const width = Math.max(duration + 12, 30) * pps;
  const HEAD = 148;

  const xToTime = (clientX: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEAD + el.scrollLeft) / pps);
  };

  const startScrub = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSeek(xToTime(e.clientX));
    const move = (ev: PointerEvent) => onSeek(xToTime(ev.clientX));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDrag = (e: React.PointerEvent, track: Track, clip: Clip, mode: 'move' | 'l' | 'r') => {
    if (track.locked) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(clip.id);
    onBegin();
    const x0 = e.clientX;
    const orig = { ...clip };
    const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
    const maxMedia = asset && (asset.type === 'video' || asset.type === 'audio') && asset.duration ? asset.duration : Infinity;
    const points = [0, time, ...project.tracks.flatMap((t) => t.clips.filter((c) => c.id !== clip.id).flatMap((c) => [c.start, c.start + c.duration]))];
    const thr = 8 / pps;
    const snap = (v: number) => { let best = v, d = thr; for (const p of points) { const dd = Math.abs(p - v); if (dd < d) { d = dd; best = p; } } return { v: best, hit: best !== v || points.includes(v) ? best : null }; };
    let trackId = track.id;
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - x0) / pps;
      const next = structuredClone(project);
      // allow moving to another compatible track
      if (mode === 'move') {
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-track-id]') as HTMLElement | null;
        const tid = over?.dataset.trackId;
        const tgt = tid ? next.tracks.find((t) => t.id === tid) : undefined;
        if (tgt && !tgt.locked && ACCEPTS[tgt.kind].includes(clip.kind)) trackId = tgt.id;
      }
      next.tracks.forEach((t) => { t.clips = t.clips.filter((c) => c.id !== clip.id); });
      const c: Clip = { ...orig };
      let hit: number | null = null;
      if (mode === 'move') {
        let s = Math.max(0, orig.start + dt);
        const a = snap(s), b = snap(s + orig.duration);
        if (Math.abs(a.v - s) <= Math.abs(b.v - (s + orig.duration)) && a.v !== s) { s = a.v; hit = a.v; }
        else if (b.v !== s + orig.duration) { s = b.v - orig.duration; hit = b.v; }
        c.start = +Math.max(0, s).toFixed(3);
      } else if (mode === 'l') {
        let s = Math.min(orig.start + orig.duration - 0.2, Math.max(0, orig.start + dt));
        if (c.kind === 'video' || c.kind === 'audio') s = Math.max(s, orig.start - orig.offset);
        const sn = snap(s); if (sn.v !== s) { s = sn.v; hit = s; }
        const delta = s - orig.start;
        c.start = +s.toFixed(3);
        c.duration = +(orig.duration - delta).toFixed(3);
        if (c.kind === 'video' || c.kind === 'audio') c.offset = +Math.max(0, orig.offset + delta).toFixed(3);
      } else {
        let e2 = Math.max(orig.start + 0.2, orig.start + orig.duration + dt);
        const sn = snap(e2); if (sn.v !== e2) { e2 = sn.v; hit = e2; }
        c.duration = +Math.min(e2 - orig.start, maxMedia - orig.offset).toFixed(3);
      }
      next.tracks.find((t) => t.id === trackId)!.clips.push(c);
      setSnapX(hit !== null ? hit * pps : null);
      onLive(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setSnapX(null); onEnd(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const ticks = useMemo(() => {
    const step = pps >= 120 ? 1 : pps >= 50 ? 2 : pps >= 25 ? 5 : 10;
    return Array.from({ length: Math.ceil(width / pps / step) + 1 }, (_, i) => i * step);
  }, [width, pps]);

  return (
    <div ref={scroller} className="relative overflow-auto scroll-thin h-full select-none" role="region" aria-label="Timeline">
      <div style={{ width: width + HEAD }} className="relative min-h-full">
        {/* Ruler */}
        <div className="sticky top-0 z-20 flex h-8 bg-coal border-b border-line">
          <div className="sticky left-0 z-30 shrink-0 bg-coal border-r border-line font-mono text-[11px] text-amber flex items-center px-3" style={{ width: HEAD }}>{tc(time, true, project.fps)}</div>
          <div className="relative flex-1 cursor-ew-resize" onPointerDown={startScrub} aria-label="Scrub timeline" role="slider" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={+time.toFixed(2)} tabIndex={0}>
            {ticks.map((t) => (
              <div key={t} className="absolute top-0 bottom-0 border-l border-line2" style={{ left: t * pps }}>
                <span className="absolute top-1.5 left-1 font-mono text-[10px] text-dim">{tc(t)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Tracks */}
        {project.tracks.map((track) => {
          const Icon = ICON[track.kind];
          return (
            <div key={track.id} className="flex border-b border-line" style={{ height: track.kind === 'caption' ? 40 : track.kind === 'audio' ? 52 : 60 }}>
              <div className="sticky left-0 z-10 shrink-0 bg-panel border-r border-line flex items-center gap-1 px-2" style={{ width: HEAD }}>
                <Icon className="size-3.5 text-dim shrink-0" aria-hidden />
                <span className="text-[12px] truncate flex-1" title={track.name}>{track.name}</span>
                {(track.kind === 'audio' || track.kind === 'video') && <button onClick={() => onTrack(track.id, { muted: !track.muted })} aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`} aria-pressed={track.muted} className="size-6 grid place-items-center rounded text-dim hover:text-paper">{track.muted ? <VolumeX className="size-3.5 text-bad" /> : <Volume2 className="size-3.5" />}</button>}
                {track.kind !== 'audio' && <button onClick={() => onTrack(track.id, { hidden: !track.hidden })} aria-label={track.hidden ? `Show ${track.name}` : `Hide ${track.name}`} aria-pressed={track.hidden} className="size-6 grid place-items-center rounded text-dim hover:text-paper">{track.hidden ? <EyeOff className="size-3.5 text-bad" /> : <Eye className="size-3.5" />}</button>}
                <button onClick={() => onTrack(track.id, { locked: !track.locked })} aria-label={track.locked ? `Unlock ${track.name}` : `Lock ${track.name}`} aria-pressed={track.locked} className="size-6 grid place-items-center rounded text-dim hover:text-paper">{track.locked ? <Lock className="size-3.5 text-amber" /> : <Unlock className="size-3.5" />}</button>
              </div>
              <div data-track-id={track.id} className={cx('relative flex-1', dropTrack === track.id && 'bg-amber/[0.06]', track.locked && 'bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_12px)]')}
                onPointerDown={(e) => { if (e.target === e.currentTarget) { onSelect(null); startScrub(e); } }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/asset-id')) { e.preventDefault(); setDropTrack(track.id); } }}
                onDragLeave={() => setDropTrack(null)}
                onDrop={(e) => { e.preventDefault(); setDropTrack(null); const id = e.dataTransfer.getData('text/asset-id'); if (id) onDropAsset(id, track.id, xToTime(e.clientX)); }}>
                {track.clips.map((c) => {
                  const a = c.assetId ? assets.get(c.assetId) : undefined;
                  const sel = selected === c.id;
                  const w = Math.max(4, c.duration * pps);
                  const label = c.text ?? a?.name ?? (c.kind === 'color' ? 'Title card' : c.kind);
                  return (
                    <div key={c.id} role="button" tabIndex={0} aria-label={`${c.kind} clip ${label}, starts ${tc(c.start)}, ${c.duration.toFixed(1)} seconds`} aria-pressed={sel}
                      onPointerDown={(e) => startDrag(e, track, c, 'move')} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(c.id); }}
                      className={cx('group absolute top-1 bottom-1 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-shadow', COLORS[track.kind], sel && 'ring-2 ring-amber shadow-[0_0_0_1px_#000,0_6px_20px_-6px_rgba(233,181,106,0.5)] z-[5]', track.hidden && 'opacity-40', !a && c.assetId && 'bg-bad/20 border-bad/60')}
                      style={{ left: c.start * pps, width: w }}>
                      {a?.thumb && (c.kind === 'video' || c.kind === 'image') && <div className="absolute inset-0 opacity-60" style={{ backgroundImage: `url(${a.thumb})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' }} />}
                      {a?.peaks && (c.kind === 'audio' || c.kind === 'wave' || (c.kind === 'video' && track.kind === 'audio')) && a.duration > 0 && <Wave peaks={a.peaks} from={c.offset / a.duration} to={(c.offset + c.duration) / a.duration} color={c.volume === 0 || track.muted ? '#555' : '#e9b56a'} />}
                      {c.kind === 'color' && <div className="absolute inset-0" style={{ background: c.color }} />}
                      {c.fadeIn > 0 && c.transition !== 'none' && <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/50 to-transparent" style={{ width: Math.min(w / 2, c.fadeIn * pps) }} aria-hidden />}
                      <div className="relative flex items-center gap-1 px-2 h-full">
                        {c.kind === 'image' && <ImgIcon className="size-3 shrink-0 opacity-70" />}
                        <span className="text-[11px] truncate font-medium drop-shadow">{label}</span>
                      </div>
                      {!track.locked && <>
                        <div onPointerDown={(e) => startDrag(e, track, c, 'l')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/25 hover:!bg-amber" aria-hidden />
                        <div onPointerDown={(e) => startDrag(e, track, c, 'r')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/25 hover:!bg-amber" aria-hidden />
                      </>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-px bg-amber z-[15] pointer-events-none" style={{ left: HEAD + time * pps }}>
          <div className="size-3 bg-amber rotate-45 -translate-x-[5.5px] translate-y-[22px]" />
        </div>
        {snapX !== null && <div className="absolute top-8 bottom-0 w-px bg-azure z-[16] pointer-events-none shadow-[0_0_8px_#74a9ff]" style={{ left: HEAD + snapX }} aria-hidden />}
      </div>
    </div>
  );
}

import { Copy, Play, Scissors, Trash2, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import type { Asset, Clip, Project, TextStyle, Track, Transition } from '../../lib/types';
import { Button, Select, cx } from '../ui';
import { tc } from '../../lib/id';
import { useSettings } from '../../lib/i18n';

interface Props {
  project: Project;
  clip: Clip;
  track: Track;
  asset?: Asset;
  update: (patch: Partial<Clip>, mode: 'begin' | 'live' | 'end' | 'commit') => void;
  onSplit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: (start: number, end: number) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-xs"><span className="text-mute">{label}</span>{children}</label>;
}
const num = 'w-full bg-coal hairline rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-amber/60';

export default function Inspector({ clip, track, asset, update, onSplit, onDelete, onDuplicate, onPreview }: Props) {
  const s = useSettings();
  const pro = s.mode === 'pro';
  const bind = (key: keyof Clip, parse = (v: string) => Number(v)) => ({
    onFocus: () => update({}, 'begin'),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [key]: parse(e.target.value) } as Partial<Clip>, 'live'),
    onBlur: () => update({}, 'end'),
  });
  const style = clip.style;
  const setStyle = (p: Partial<TextStyle>, mode: 'begin' | 'live' | 'end' | 'commit' = 'commit') => update({ style: { ...style!, ...p } }, mode);
  const rangeStyle = (k: keyof TextStyle, min: number, max: number, step: number) => (
    <input type="range" min={min} max={max} step={step} value={Number(style![k])} aria-label={String(k)}
      onPointerDown={() => update({}, 'begin')} onPointerUp={() => update({}, 'end')} onKeyDown={() => update({}, 'begin')} onKeyUp={() => update({}, 'end')}
      onChange={(e) => setStyle({ [k]: Number(e.target.value) } as Partial<TextStyle>, 'live')} className="w-full" />
  );
  const rangeClip = (k: 'volume' | 'fadeIn' | 'fadeOut', min: number, max: number, step: number) => (
    <input type="range" min={min} max={max} step={step} value={clip[k]} aria-label={k}
      onPointerDown={() => update({}, 'begin')} onPointerUp={() => update({}, 'end')} onKeyDown={() => update({}, 'begin')} onKeyUp={() => update({}, 'end')}
      onChange={(e) => update({ [k]: Number(e.target.value) }, 'live')} className="w-full" />
  );
  const rangeT = (k: 'scale' | 'x' | 'y', min: number, max: number, step: number) => (
    <input type="range" min={min} max={max} step={step} value={clip.transform[k]} aria-label={`Transform ${k}`}
      onPointerDown={() => update({}, 'begin')} onPointerUp={() => update({}, 'end')} onKeyDown={() => update({}, 'begin')} onKeyUp={() => update({}, 'end')}
      onChange={(e) => update({ transform: { ...clip.transform, [k]: Number(e.target.value) } }, 'live')} className="w-full" />
  );
  const media = clip.kind === 'video' || clip.kind === 'audio';
  const visual = clip.kind === 'video' || clip.kind === 'image';

  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-dim">{track.name} · {clip.kind}</div>
        <div className="text-sm font-medium mt-1 truncate">{clip.text ?? asset?.name ?? (clip.kind === 'color' ? 'Title card background' : clip.kind)}</div>
        {asset && <div className="text-[11px] text-dim mt-0.5">{asset.width ? `${asset.width}×${asset.height} · ` : ''}{asset.duration ? tc(asset.duration) : 'still'}{asset.demo ? ' · demo media' : ''}</div>}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" icon={<Scissors className="size-3.5" />} onClick={onSplit}>Split</Button>
        <Button size="sm" icon={<Copy className="size-3.5" />} onClick={onDuplicate}>Duplicate</Button>
        <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={onDelete} aria-label="Delete clip" />
      </div>

      {(clip.kind === 'text' || clip.kind === 'caption') && style && (
        <section className="space-y-2.5">
          <div className="text-xs font-medium">Text</div>
          <textarea value={clip.text ?? ''} {...bind('text', (v) => v as never)} rows={3} className="w-full bg-coal hairline rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber/60" aria-label="Text content" />
          {clip.kind === 'caption' && <Row label="Speaker"><input className={num} value={clip.speaker ?? ''} placeholder="e.g. Host" {...bind('speaker', (v) => v as never)} /></Row>}
          <Row label="Font">
            <Select value={style.font} onChange={(e) => setStyle({ font: e.target.value as TextStyle['font'] })} className="py-1.5 text-xs">
              <option value="display">Serif display</option><option value="sans">Grotesk</option><option value="mono">Mono</option>
            </Select>
          </Row>
          <Row label={`Size ${style.size.toFixed(1)}%`}>{rangeStyle('size', 2, 20, 0.1)}</Row>
          <Row label="Weight"><Select value={style.weight} onChange={(e) => setStyle({ weight: Number(e.target.value) })} className="py-1.5 text-xs">{[300, 400, 500, 600, 700].map((w) => <option key={w} value={w}>{w}</option>)}</Select></Row>
          <Row label="Color"><div className="flex gap-1.5 items-center"><input type="color" value={style.color} onChange={(e) => setStyle({ color: e.target.value })} className="h-7 w-9 rounded bg-transparent" aria-label="Text color" />{['#ffffff', '#f3eee5', '#ffd84a', '#e9b56a', '#9a8cff', '#000000'].map((c) => <button key={c} onClick={() => setStyle({ color: c })} aria-label={`Color ${c}`} className={cx('size-5 rounded-full border border-line2', style.color === c && 'ring-2 ring-amber')} style={{ background: c }} />)}</div></Row>
          <Row label="Box">
            <Select value={style.bg} onChange={(e) => setStyle({ bg: e.target.value })} className="py-1.5 text-xs">
              <option value="">None (shadow)</option><option value="rgba(0,0,0,0.55)">Soft black</option><option value="rgba(0,0,0,0.85)">Solid black</option><option value="rgba(243,238,229,0.92)">Paper</option><option value="rgba(154,140,255,0.85)">Violet</option>
            </Select>
          </Row>
          <Row label="Align"><div className="flex gap-1">{([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, I]) => <button key={a} onClick={() => setStyle({ align: a, x: a === 'left' ? 0.08 : a === 'right' ? 0.92 : 0.5 })} aria-label={`Align ${a}`} aria-pressed={style.align === a} className={cx('size-8 grid place-items-center rounded-lg hairline', style.align === a ? 'bg-paper text-ink' : 'hover:bg-white/5')}><I className="size-3.5" /></button>)}</div></Row>
          <Row label={`Vertical ${Math.round(style.y * 100)}%`}>{rangeStyle('y', 0.04, 0.96, 0.01)}</Row>
        </section>
      )}

      <section className="space-y-2.5">
        <div className="text-xs font-medium">Timing</div>
        <Row label="Start"><input type="number" step={0.1} min={0} className={num} value={clip.start} {...bind('start', (v) => Math.max(0, Number(v)))} /></Row>
        <Row label="Duration"><input type="number" step={0.1} min={0.2} className={num} value={clip.duration} {...bind('duration', (v) => Math.max(0.2, Math.min(Number(v), media && asset?.duration ? asset.duration - clip.offset : Infinity)))} /></Row>
        {media && pro && <Row label="Source in"><input type="number" step={0.1} min={0} className={num} value={clip.offset} {...bind('offset', (v) => Math.max(0, Number(v)))} /></Row>}
      </section>

      {(media || clip.kind === 'wave') && (
        <section className="space-y-2.5">
          <div className="text-xs font-medium">Audio</div>
          <Row label={`Volume ${Math.round(clip.volume * 100)}%`}>{rangeClip('volume', 0, 1.5, 0.01)}</Row>
          {clip.volume > 1.2 && <p className="text-[11px] text-warn">Above 120% may distort.</p>}
        </section>
      )}

      {clip.kind !== 'caption' && (
        <section className="space-y-2.5">
          <div className="text-xs font-medium">Transition</div>
          <Row label="In">
            <Select value={clip.transition} onChange={(e) => { const t = e.target.value as Transition; update({ transition: t, fadeIn: t === 'none' ? 0 : clip.fadeIn || 0.5 }, 'commit'); if (t !== 'none') setTimeout(() => onPreview(Math.max(0, clip.start - 0.5), clip.start + 1.6), 50); }} className="py-1.5 text-xs">
              <option value="none">Cut</option><option value="fade">Fade</option><option value="zoom">Slow zoom</option><option value="slide">Slide in</option>
            </Select>
          </Row>
          <Row label={`Fade in ${clip.fadeIn.toFixed(1)}s`}>{rangeClip('fadeIn', 0, 3, 0.1)}</Row>
          <Row label={`Fade out ${clip.fadeOut.toFixed(1)}s`}>{rangeClip('fadeOut', 0, 3, 0.1)}</Row>
          <Button size="sm" variant="quiet" icon={<Play className="size-3.5" />} onClick={() => onPreview(Math.max(0, clip.start - 0.5), clip.start + Math.min(clip.duration, 2.5))}>Preview transition</Button>
        </section>
      )}

      {(visual || (clip.kind === 'image' && track.kind === 'overlay')) && (
        <section className="space-y-2.5">
          <div className="text-xs font-medium">Crop & position</div>
          <Row label={`Scale ${clip.transform.scale.toFixed(2)}×`}>{rangeT('scale', 0.1, 3, 0.01)}</Row>
          <Row label="Pan X">{rangeT('x', -0.5, 0.5, 0.01)}</Row>
          <Row label="Pan Y">{rangeT('y', -0.5, 0.5, 0.01)}</Row>
          <button className="text-[11px] text-mute hover:text-paper" onClick={() => update({ transform: { scale: 1, x: 0, y: 0 } }, 'commit')}>Reset framing</button>
          <p className="text-[11px] text-dim">Scale ≥ 0.6 fills the frame (crop). Below 0.6 it becomes a picture-in-picture overlay.</p>
        </section>
      )}

      {clip.kind === 'color' && (
        <Row label="Color"><input type="color" value={clip.color ?? '#000000'} onChange={(e) => update({ color: e.target.value }, 'commit')} className="h-8 w-12 rounded bg-transparent" aria-label="Background color" /></Row>
      )}
    </div>
  );
}

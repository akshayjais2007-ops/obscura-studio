// Canvas compositor shared by the editor preview and the real export (MediaRecorder).
import type { Asset, Clip, Project, TextStyle } from './types';
import { blobUrl } from './idb';
import { dims, projectDuration } from './project';

type MediaEl = HTMLVideoElement | HTMLAudioElement;

const FONT: Record<TextStyle['font'], string> = {
  display: '"Instrument Serif", Georgia, serif',
  sans: '"Hanken Grotesk", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: Project;
  assets: Map<string, Asset>;
  short: number;
  exportMode: boolean;
  private media = new Map<string, MediaEl>(); // by clip id
  private images = new Map<string, HTMLImageElement>(); // by asset id
  private urls = new Map<string, string>();
  onRedraw?: () => void;
  private audioCtx?: AudioContext;
  private dest?: MediaStreamAudioDestinationNode;
  private gains = new Map<string, GainNode>();
  missing = new Set<string>();

  constructor(canvas: HTMLCanvasElement, project: Project, assets: Asset[], opts: { short: number; exportMode?: boolean }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.project = project;
    this.assets = new Map(assets.map((a) => [a.id, a]));
    this.short = opts.short;
    this.exportMode = !!opts.exportMode;
    this.resize();
  }

  resize() {
    const { w, h } = dims(this.project.aspect, this.short);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  setProject(p: Project, assets?: Asset[]) {
    this.project = p;
    if (assets) this.assets = new Map(assets.map((a) => [a.id, a]));
    this.resize();
  }

  get duration() { return projectDuration(this.project); }

  attachAudio(ctx: AudioContext, dest: MediaStreamAudioDestinationNode) {
    this.audioCtx = ctx;
    this.dest = dest;
  }

  private async url(assetId: string) {
    if (this.urls.has(assetId)) return this.urls.get(assetId)!;
    const u = await blobUrl(assetId);
    if (u) this.urls.set(assetId, u);
    return u;
  }

  /** Ensure media elements exist for every clip. Resolves when metadata/images are ready. */
  async prepare() {
    const jobs: Promise<void>[] = [];
    for (const t of this.project.tracks) for (const c of t.clips) {
      if (!c.assetId) continue;
      const a = this.assets.get(c.assetId);
      if (!a || a.deletedAt) { this.missing.add(c.assetId); continue; }
      if (a.type === 'image' && !this.images.has(a.id)) {
        const placeholder = new Image();
        this.images.set(a.id, placeholder);
        jobs.push(this.url(a.id).then((u) => new Promise<void>((res) => {
          if (!u) { this.missing.add(a.id); return res(); }
          placeholder.onload = () => { this.onRedraw?.(); res(); };
          placeholder.onerror = () => { this.missing.add(a.id); res(); };
          placeholder.src = u;
        })));
      } else if ((a.type === 'video' || a.type === 'audio') && !this.media.has(c.id) && c.kind !== 'wave') {
        const el = document.createElement(a.type === 'video' ? 'video' : 'audio') as MediaEl;
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        if (el instanceof HTMLVideoElement) el.playsInline = true;
        this.media.set(c.id, el);
        jobs.push(this.url(a.id).then((u) => new Promise<void>((res) => {
          if (!u) { this.missing.add(a.id); return res(); }
          el.onloadeddata = () => { this.onRedraw?.(); res(); };
          el.onerror = () => { this.missing.add(a.id); res(); };
          el.onseeked = () => this.onRedraw?.();
          el.src = u;
          setTimeout(res, 8000);
        })).then(() => {
          if (this.audioCtx && this.dest) {
            try {
              const src = this.audioCtx.createMediaElementSource(el);
              const g = this.audioCtx.createGain();
              src.connect(g).connect(this.dest);
              this.gains.set(c.id, g);
            } catch { /* already connected */ }
          }
        }));
      }
    }
    await Promise.all(jobs);
  }

  /** Keep media element playback aligned with timeline time t. */
  sync(t: number, playing: boolean) {
    const tracks = this.project.tracks;
    const live = new Set<string>();
    for (const tr of tracks) for (const c of tr.clips) {
      const el = this.media.get(c.id);
      if (!el) continue;
      live.add(c.id);
      const active = t >= c.start && t < c.start + c.duration && !tr.hidden;
      const local = c.offset + (t - c.start);
      const vol = tr.muted ? 0 : Math.max(0, Math.min(1.5, c.volume)) * this.fadeAlpha(c, t);
      const g = this.gains.get(c.id);
      if (g) { g.gain.value = vol; el.volume = 1; el.muted = false; }
      else { el.volume = Math.min(1, vol); el.muted = vol === 0; }
      if (active) {
        if (Math.abs(el.currentTime - local) > (playing ? 0.3 : 0.04)) { try { el.currentTime = Math.max(0, local); } catch { /* not seekable yet */ } }
        if (playing && el.paused) el.play().catch(() => { /* autoplay blocked; user gesture needed */ });
        if (!playing && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
        // pre-roll: park the element at its in-point shortly before it starts
        if (t < c.start && c.start - t < 1.2 && Math.abs(el.currentTime - c.offset) > 0.05) { try { el.currentTime = c.offset; } catch { /* ignore */ } }
      }
    }
    for (const [id, el] of this.media) if (!live.has(id)) { el.pause(); }
  }

  pauseAll() { for (const el of this.media.values()) el.pause(); }

  private fadeAlpha(c: Clip, t: number) {
    const local = t - c.start;
    let a = 1;
    if (c.fadeIn > 0 && local < c.fadeIn && (c.transition === 'fade' || c.transition === 'zoom' || c.kind === 'audio' || c.kind === 'video')) a = Math.min(a, local / c.fadeIn);
    if (c.fadeOut > 0 && local > c.duration - c.fadeOut) a = Math.min(a, (c.duration - local) / c.fadeOut);
    return Math.max(0, Math.min(1, a));
  }

  draw(t: number) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // bottom-most track drawn first: video tracks, then overlay, then captions
    const order = ['video', 'overlay', 'caption', 'audio'];
    const tracks = [...this.project.tracks].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const tr of tracks) {
      if (tr.hidden || tr.kind === 'audio') continue;
      for (const c of tr.clips) {
        if (t < c.start || t >= c.start + c.duration) continue;
        ctx.save();
        this.drawClip(c, t, W, H);
        ctx.restore();
      }
    }
  }

  private drawClip(c: Clip, t: number, W: number, H: number) {
    const { ctx } = this;
    const local = t - c.start;
    const p = c.fadeIn > 0 ? Math.min(1, local / c.fadeIn) : 1;
    const ep = 1 - Math.pow(1 - p, 3);
    let alpha = this.fadeAlpha(c, t);
    let dx = 0, extraScale = 1;
    if (c.transition === 'slide' && p < 1) { dx = (1 - ep) * W; alpha = 1; if (c.fadeOut > 0 && local > c.duration - c.fadeOut) alpha = (c.duration - local) / c.fadeOut; }
    if (c.transition === 'zoom') extraScale = 1 + 0.08 * (local / Math.max(1, c.duration));
    if (c.transition === 'none' && c.fadeOut === 0) alpha = 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    if (c.kind === 'color') { ctx.fillStyle = c.color ?? '#000'; ctx.fillRect(dx, 0, W, H); return; }
    if (c.kind === 'image' || c.kind === 'video') {
      const src: CanvasImageSource | undefined = c.kind === 'image' ? this.images.get(c.assetId!) : (this.media.get(c.id) as HTMLVideoElement | undefined);
      const sw = c.kind === 'image' ? (src as HTMLImageElement)?.naturalWidth : (src as HTMLVideoElement)?.videoWidth;
      const sh = c.kind === 'image' ? (src as HTMLImageElement)?.naturalHeight : (src as HTMLVideoElement)?.videoHeight;
      if (!src || !sw || !sh || (c.kind === 'video' && (src as HTMLVideoElement).readyState < 2)) {
        if (c.assetId && this.missing.has(c.assetId)) this.drawMissing(W, H);
        return;
      }
      const isOverlay = c.transform.scale < 0.6;
      const base = isOverlay ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
      const s = base * c.transform.scale * extraScale;
      const w = sw * s, h = sh * s;
      const x = (W - w) / 2 + c.transform.x * W + dx, y = (H - h) / 2 + c.transform.y * H;
      ctx.drawImage(src, x, y, w, h);
      return;
    }
    if (c.kind === 'wave') { this.drawWave(c, t, W, H); return; }
    if ((c.kind === 'text' || c.kind === 'caption') && c.text && c.style) this.drawText(c.text, c.style, W, H, dx, c.kind === 'text' && c.transition !== 'none' ? (1 - ep) * H * 0.02 : 0);
  }

  private drawMissing(W: number, H: number) {
    const { ctx } = this;
    ctx.fillStyle = '#1a1416';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f0716b';
    ctx.font = `600 ${Math.round(Math.min(W, H) * 0.04)}px ${FONT.sans}`;
    ctx.textAlign = 'center';
    ctx.fillText('Missing media', W / 2, H / 2);
  }

  private drawWave(c: Clip, t: number, W: number, H: number) {
    const a = c.assetId ? this.assets.get(c.assetId) : undefined;
    const peaks = a?.peaks;
    if (!peaks?.length || !a?.duration) return;
    const { ctx } = this;
    const bars = 48;
    const pos = (c.offset + (t - c.start)) / a.duration;
    const center = Math.floor(pos * peaks.length);
    const bw = (W * 0.7) / bars;
    const y = (c.style?.y ?? 0.7) * H;
    ctx.fillStyle = c.color ?? '#e8b25c';
    for (let i = 0; i < bars; i++) {
      const v = peaks[Math.max(0, Math.min(peaks.length - 1, center - bars / 2 + i))] ?? 0;
      const h = Math.max(4, v * H * 0.22);
      const x = W * 0.15 + i * bw;
      ctx.beginPath();
      ctx.roundRect(x + bw * 0.2, y - h / 2, bw * 0.6, h, bw * 0.3);
      ctx.fill();
    }
  }

  private drawText(text: string, s: TextStyle, W: number, H: number, dx = 0, dy = 0) {
    const { ctx } = this;
    const size = Math.round((s.size / 100) * Math.min(W, H));
    ctx.font = `${s.weight} ${size}px ${FONT[s.font]}`;
    ctx.textBaseline = 'middle';
    const maxW = W * 0.86;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    const lh = size * 1.18;
    const totalH = lines.length * lh;
    const cx = s.x * W + dx;
    const top = s.y * H - totalH / 2 + dy;
    ctx.textAlign = s.align;
    const widths = lines.map((l) => ctx.measureText(l).width);
    if (s.bg) {
      const pad = size * 0.35;
      ctx.fillStyle = s.bg;
      lines.forEach((_, i) => {
        const w = widths[i];
        const x0 = s.align === 'center' ? cx - w / 2 : s.align === 'left' ? cx : cx - w;
        ctx.beginPath();
        ctx.roundRect(x0 - pad, top + i * lh - pad * 0.2, w + pad * 2, lh + pad * 0.4, size * 0.18);
        ctx.fill();
      });
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.25;
      ctx.shadowOffsetY = size * 0.04;
    }
    ctx.fillStyle = s.color;
    lines.forEach((l, i) => ctx.fillText(l, cx, top + i * lh + lh / 2));
    ctx.shadowColor = 'transparent';
  }

  destroy() {
    for (const el of this.media.values()) { el.pause(); el.removeAttribute('src'); el.load(); }
    this.media.clear();
    this.images.clear();
  }
}

export function pickMime() {
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export function exportSupported() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && !!pickMime();
}

/** Real-time export: plays the timeline into a canvas + audio graph and records it. */
export async function renderProject(project: Project, assets: Asset[], opts: { short: number; signal: AbortSignal; onProgress: (p: number) => void }): Promise<{ blob: Blob; mime: string; width: number; height: number; duration: number }> {
  if (!exportSupported()) throw new Error('This browser can’t record video. Use a recent Chrome, Edge or Firefox, or connect a cloud render provider.');
  const duration = projectDuration(project);
  if (duration <= 0) throw new Error('The timeline is empty — add at least one clip.');
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  const engine = new Engine(canvas, project, assets, { short: opts.short, exportMode: true });
  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();
  // keep an always-on silent source so the audio track exists even with no media audio
  const osc = audioCtx.createConstantSource();
  const silent = audioCtx.createGain();
  silent.gain.value = 0;
  osc.connect(silent).connect(dest);
  osc.start();
  engine.attachAudio(audioCtx, dest);
  await engine.prepare();
  if (engine.missing.size) {
    engine.destroy(); audioCtx.close();
    throw new Error(`${engine.missing.size} media file(s) are missing. Run the Export Quality Gate to remove or replace them.`);
  }
  const fps = project.fps || 30;
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.short >= 1080 ? 8_000_000 : opts.short >= 720 ? 5_000_000 : 2_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((res) => { rec.onstop = () => res(); });
  engine.sync(0, false);
  engine.draw(0);
  await new Promise((r) => setTimeout(r, 300));
  rec.start(500);
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal.aborted) { reject(new DOMException('Canceled', 'AbortError')); return; }
      const t = (performance.now() - t0) / 1000;
      if (t >= duration) { resolve(); return; }
      engine.sync(t, true);
      engine.draw(t);
      opts.onProgress(t / duration);
      if (document.hidden) setTimeout(tick, 1000 / fps); else requestAnimationFrame(tick);
    };
    tick();
  }).finally(() => {
    if (rec.state !== 'inactive') rec.stop();
    engine.pauseAll();
  });
  await done;
  engine.destroy();
  osc.stop();
  audioCtx.close();
  const type = mime.split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 1000) throw new Error('The recorder produced an empty file. Keep this tab visible during export and try again.');
  return { blob, mime: type, width: canvas.width, height: canvas.height, duration };
}

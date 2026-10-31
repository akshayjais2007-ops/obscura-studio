import { putBlob } from './idb';
import { getDB, update, audit } from './db';
import { uid } from './id';
import type { Asset } from './types';

export const ACCEPT = 'video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/webm,image/png,image/jpeg,image/webp,image/gif';
export const MAX_BYTES = 500 * 1024 * 1024;

/** Upload check: sniff magic bytes so a renamed file can't pose as media. Pure on the header bytes. */
export function sniff(h: Uint8Array): Asset['type'] | null {
  const s = (o: number, str: string) => [...str].every((c, i) => h[o + i] === c.charCodeAt(0));
  if (h[0] === 0x89 && s(1, 'PNG')) return 'image';
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return 'image';
  if (s(0, 'GIF8')) return 'image';
  if (s(0, 'RIFF') && s(8, 'WEBP')) return 'image';
  if (s(0, 'RIFF') && s(8, 'WAVE')) return 'audio';
  if (s(0, 'OggS')) return 'audio';
  if (s(0, 'ID3') || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return 'audio';
  if (s(4, 'ftyp')) {
    const brand = String.fromCharCode(h[8], h[9], h[10], h[11]);
    return brand.startsWith('M4A') ? 'audio' : 'video';
  }
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return 'video'; // webm/mkv
  return null;
}

export async function sha256(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read this image.'));
    i.src = url;
  });
}

function loadMedia(url: string, kind: 'video' | 'audio') {
  return new Promise<HTMLVideoElement | HTMLAudioElement>((res, rej) => {
    const el = document.createElement(kind);
    el.preload = 'auto';
    el.muted = true;
    el.onloadedmetadata = () => res(el);
    el.onerror = () => rej(new Error(`This ${kind} format can’t be played in your browser. Try MP4 (H.264) or WebM.`));
    el.src = url;
  });
}

function thumbFrom(src: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  const tw = 240;
  c.width = tw;
  c.height = Math.round((tw * h) / w) || 135;
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export async function computePeaks(blob: Blob, count = 400): Promise<{ peaks: number[]; buffer: AudioBuffer } | null> {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const data = buffer.getChannelData(0);
    const block = Math.floor(data.length / count) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < count; i++) {
      let m = 0;
      for (let j = i * block; j < (i + 1) * block && j < data.length; j += 16) m = Math.max(m, Math.abs(data[j]));
      peaks.push(+m.toFixed(3));
    }
    return { peaks, buffer };
  } catch {
    return null;
  }
}

/** Energy windows (RMS) at `hop` seconds. Pure given samples. */
export function energyEnvelope(samples: Float32Array, sampleRate: number, hop = 0.05) {
  const size = Math.floor(sampleRate * hop);
  const out: number[] = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let s = 0;
    for (let j = i; j < i + size; j += 2) s += samples[j] * samples[j];
    out.push(Math.sqrt(s / (size / 2)));
  }
  return out;
}

/** Onset/beat detection: energy spikes above local mean. Pure. Returns times in seconds. */
export function detectBeats(env: number[], hop = 0.05, sensitivity = 1.35, minGap = 0.28) {
  const beats: number[] = [];
  const win = Math.round(1 / hop);
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    const a = Math.max(0, i - win), b = Math.min(env.length, i + win);
    let mean = 0;
    for (let j = a; j < b; j++) mean += env[j];
    mean /= b - a;
    const t = i * hop;
    if (env[i] > mean * sensitivity && env[i] >= env[i - 1] && env[i] >= env[i + 1] && env[i] > 0.02 && t - last >= minGap) {
      beats.push(+t.toFixed(3));
      last = t;
    }
  }
  return beats;
}

/** Loudest moments, at least `gap` seconds apart. Pure. */
export function findHighlights(env: number[], hop = 0.05, count = 5, windowSec = 2, gap = 8) {
  const w = Math.max(1, Math.round(windowSec / hop));
  const scores: { t: number; s: number }[] = [];
  for (let i = 0; i + w <= env.length; i += Math.max(1, Math.round(w / 2))) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += env[j];
    scores.push({ t: i * hop, s: s / w });
  }
  scores.sort((a, b) => b.s - a.s);
  const picked: { t: number; s: number }[] = [];
  for (const c of scores) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.abs(p.t - c.t) >= gap)) picked.push(c);
  }
  const max = picked[0]?.s || 1;
  return picked.sort((a, b) => a.t - b.t).map((p) => ({ time: +p.t.toFixed(2), score: Math.round((p.s / max) * 100) }));
}

export interface IngestResult { asset?: Asset; duplicateOf?: Asset; error?: string }

export async function ingestFile(file: File, ctx: { userId: string; workspaceId: string; source?: Asset['source']; license?: string; attribution?: string; tags?: string[]; demo?: boolean }): Promise<IngestResult> {
  if (file.size > MAX_BYTES) return { error: `“${file.name}” is larger than 500 MB. Compress it or trim it first.` };
  if (file.size === 0) return { error: `“${file.name}” is empty.` };
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = sniff(head);
  if (!type) return { error: `“${file.name}” isn’t a supported video, audio or image file.` };
  const hash = await sha256(file);
  const dup = getDB().assets.find((a) => a.hash === hash && a.workspaceId === ctx.workspaceId && !a.deletedAt);
  if (dup) return { duplicateOf: dup };
  const url = URL.createObjectURL(file);
  let width = 0, height = 0, duration = 0, thumb: string | undefined, peaks: number[] | undefined;
  try {
    if (type === 'image') {
      const img = await loadImage(url);
      width = img.naturalWidth; height = img.naturalHeight; duration = 0;
      thumb = thumbFrom(img, width, height);
    } else {
      const el = await loadMedia(url, type);
      duration = isFinite(el.duration) ? el.duration : 0;
      if (type === 'video') {
        const v = el as HTMLVideoElement;
        width = v.videoWidth; height = v.videoHeight;
        await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = Math.min(1, duration / 3); setTimeout(res, 3000); });
        try { thumb = thumbFrom(v, width, height); } catch { thumb = undefined; }
      }
      const p = await computePeaks(file);
      if (p) { peaks = p.peaks; if (!duration) duration = p.buffer.duration; }
    }
  } catch (e) {
    URL.revokeObjectURL(url);
    return { error: (e as Error).message };
  }
  URL.revokeObjectURL(url);
  const id = uid('as_');
  await putBlob(id, file);
  const asset: Asset = {
    id, workspaceId: ctx.workspaceId, ownerId: ctx.userId, name: file.name, type, mime: file.type || type, size: file.size,
    duration: +duration.toFixed(3), width, height, hash, tags: ctx.tags ?? autoTags(file.name), source: ctx.source ?? 'upload',
    license: ctx.license ?? '', attribution: ctx.attribution ?? '', thumb, peaks, demo: ctx.demo, createdAt: Date.now(),
  };
  update((d) => { d.assets.unshift(asset); });
  audit(ctx.userId, 'asset.upload', id, file.name);
  return { asset };
}

export function autoTags(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^\d+$/.test(w)).slice(0, 6);
}

export async function decodeEnvelope(blob: Blob) {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const env = energyEnvelope(buffer.getChannelData(0), buffer.sampleRate);
    return { env, duration: buffer.duration };
  } finally {
    ctx.close();
  }
}

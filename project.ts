import { audit, getDB, update } from './db';
import { uid } from './id';
import type { Aspect, Asset, Clip, Project, Scene, TextStyle, Track } from './types';

export const ASPECTS: { id: Aspect; label: string; hint: string }[] = [
  { id: '16:9', label: 'Landscape 16:9', hint: 'YouTube, websites' },
  { id: '9:16', label: 'Vertical 9:16', hint: 'Shorts, Reels, TikTok' },
  { id: '1:1', label: 'Square 1:1', hint: 'Feeds, LinkedIn' },
  { id: '4:5', label: 'Portrait 4:5', hint: 'Instagram feed' },
];

export function dims(aspect: Aspect, short: number) {
  const [a, b] = aspect.split(':').map(Number);
  if (a >= b) return { w: Math.round((short * a) / b / 2) * 2, h: short };
  return { w: short, h: Math.round((short * b) / a / 2) * 2 };
}

export const CAPTION_STYLE: TextStyle = { font: 'sans', size: 5.2, color: '#ffffff', bg: 'rgba(0,0,0,0.55)', weight: 700, x: 0.5, y: 0.82, align: 'center' };
export const TITLE_STYLE: TextStyle = { font: 'display', size: 11, color: '#f4efe6', bg: '', weight: 400, x: 0.5, y: 0.5, align: 'center' };

export function makeClip(p: Partial<Clip> & Pick<Clip, 'kind' | 'start' | 'duration'>): Clip {
  return { id: uid('c_'), offset: 0, volume: 1, transform: { scale: 1, x: 0, y: 0 }, transition: 'none', fadeIn: 0, fadeOut: 0, ...p };
}

export function defaultTracks(): Track[] {
  const t = (kind: Track['kind'], name: string): Track => ({ id: uid('t_'), kind, name, muted: false, locked: false, hidden: false, clips: [] });
  return [t('video', 'Video 1'), t('overlay', 'Titles & overlays'), t('caption', 'Captions'), t('audio', 'Music'), t('audio', 'Voice')];
}

export function newScene(p: Partial<Scene> = {}): Scene {
  return { id: uid('s_'), title: 'Scene', narration: '', visual: '', duration: 4, characters: '', location: '', timeOfDay: '', ...p };
}

export function createProject(userId: string, workspaceId: string, p: Partial<Project> = {}) {
  const now = Date.now();
  const project: Project = {
    id: uid('p_'), workspaceId, ownerId: userId, title: 'Untitled video', aspect: '16:9', fps: 30, template: 'blank', script: '',
    scenes: [], tracks: defaultTracks(), stage: 'idea', review: 'draft', createdAt: now, updatedAt: now, ...p,
  };
  update((d) => { d.projects.unshift(project); });
  audit(userId, 'project.create', project.id, project.title);
  return project;
}

export function saveProject(id: string, patch: Partial<Project>) {
  update((d) => {
    const p = d.projects.find((x) => x.id === id);
    if (p) Object.assign(p, patch, { updatedAt: Date.now() });
  });
}

export function projectDuration(p: Pick<Project, 'tracks'>) {
  let end = 0;
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, c.start + c.duration);
  return +end.toFixed(3);
}

/** Split narration into readable caption chunks with timing. Pure. */
export function captionsFromText(text: string, start: number, total?: number, maxWords = 7): Clip[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [];
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || /[.!?;:]$/.test(w)) { chunks.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) chunks.push(cur.join(' '));
  const wps = 2.6;
  const natural = chunks.map((c) => Math.max(1.1, c.split(' ').length / wps));
  const sum = natural.reduce((a, b) => a + b, 0);
  const scale = total ? total / sum : 1;
  let t = start;
  return chunks.map((c, i) => {
    const d = +(natural[i] * scale).toFixed(2);
    const clip = makeClip({ kind: 'caption', start: +t.toFixed(2), duration: d, text: c, style: { ...CAPTION_STYLE } });
    t += d;
    return clip;
  });
}

const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};

export function toSRT(clips: Clip[]) {
  return [...clips].sort((a, b) => a.start - b.start).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.duration)}\n${c.speaker ? `[${c.speaker}] ` : ''}${c.text ?? ''}\n`).join('\n');
}
export function toVTT(clips: Clip[]) {
  return 'WEBVTT\n\n' + [...clips].sort((a, b) => a.start - b.start).map((c) => `${srtTime(c.start).replace(',', '.')} --> ${srtTime(c.start + c.duration).replace(',', '.')}\n${c.text ?? ''}\n`).join('\n');
}

export function parseSRT(src: string): Clip[] {
  const out: Clip[] = [];
  const blocks = src.replace(/\r/g, '').split(/\n\n+/);
  const toSec = (s: string) => { const [h, m, rest] = s.trim().split(':'); const [sec, ms] = rest.split(/[,.]/); return +h * 3600 + +m * 60 + +sec + +(ms ?? 0) / 1000; };
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean);
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->');
    try {
      const start = toSec(a), end = toSec(z.split(' ').filter(Boolean)[0]);
      if (end > start) out.push(makeClip({ kind: 'caption', start, duration: +(end - start).toFixed(3), text: lines.slice(ti + 1).join(' '), style: { ...CAPTION_STYLE } }));
    } catch { /* skip malformed */ }
  }
  return out;
}

export function clipForAsset(a: Asset, start: number, imageDur = 4): Clip {
  if (a.type === 'audio') return makeClip({ kind: 'audio', assetId: a.id, start, duration: a.duration || 5 });
  if (a.type === 'video') return makeClip({ kind: 'video', assetId: a.id, start, duration: a.duration || 5 });
  return makeClip({ kind: 'image', assetId: a.id, start, duration: imageDur, transition: 'fade', fadeIn: 0.4 });
}

export function trackFor(p: Project, a: Asset) {
  const kind = a.type === 'audio' ? 'audio' : 'video';
  return p.tracks.find((t) => t.kind === kind && !t.locked);
}

export function trackEnd(t: Track) {
  return t.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
}

/** Build a timeline from scenes: media or title cards + captions. Pure on inputs. */
export function assembleFromScenes(p: Project, assets: Asset[], opts: { captions: boolean; titleStyle?: TextStyle; captionStyle?: TextStyle; transition?: Clip['transition'] }): Track[] {
  const tracks = defaultTracks();
  const [video, overlay, caps] = tracks;
  let t = 0;
  for (const s of p.scenes) {
    const a = s.assetId ? assets.find((x) => x.id === s.assetId) : undefined;
    const dur = Math.max(1.5, s.duration);
    if (a && a.type !== 'audio') {
      const first = t === 0;
      video.clips.push(makeClip({ kind: a.type === 'video' ? 'video' : 'image', assetId: a.id, start: t, duration: a.type === 'video' && a.duration ? Math.min(dur, a.duration) : dur, transition: first ? 'none' : opts.transition ?? 'fade', fadeIn: first ? 0 : 0.4, transform: { scale: a.type === 'image' ? 1.05 : 1, x: 0, y: 0 } }));
    } else {
      video.clips.push(makeClip({ kind: 'color', color: '#111014', start: t, duration: dur }));
      overlay.clips.push(makeClip({ kind: 'text', text: s.title, start: t, duration: dur, style: { ...(opts.titleStyle ?? TITLE_STYLE) }, transition: 'fade', fadeIn: 0.5, fadeOut: 0.3 }));
    }
    if (opts.captions && s.narration.trim()) {
      caps.clips.push(...captionsFromText(s.narration, t, dur).map((c) => ({ ...c, style: { ...(opts.captionStyle ?? c.style!) } })));
    }
    t += dur;
  }
  return tracks;
}

export function snapshot(projectId: string, label: string) {
  const p = getDB().projects.find((x) => x.id === projectId);
  if (!p) return;
  update((d) => {
    d.snapshots.unshift({ id: uid('snap_'), projectId, label, at: Date.now(), data: structuredClone({ title: p.title, aspect: p.aspect, script: p.script, scenes: p.scenes, tracks: p.tracks }) });
    const mine = d.snapshots.filter((s) => s.projectId === projectId);
    if (mine.length > 30) d.snapshots = d.snapshots.filter((s) => s.projectId !== projectId || mine.slice(0, 30).includes(s));
  });
}

export function scriptFromScenes(scenes: Scene[]) {
  return scenes.map((s, i) => `## ${i + 1}. ${s.title}\n${s.narration}`).join('\n\n');
}

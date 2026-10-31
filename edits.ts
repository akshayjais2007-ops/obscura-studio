// Pure project transforms used by analyzer "Fix" buttons and the Revision Agent. Each returns a new project.
import type { Aspect, BrandKit, Project } from './types';
import { captionsFromText, makeClip, projectDuration, TITLE_STYLE, CAPTION_STYLE } from './project';

const clone = (p: Project): Project => structuredClone(p);

export function applyFix(p0: Project, fixId: string, ctx: { kit?: BrandKit; hook?: string } = {}): Project {
  const p = clone(p0);
  const [kind, a, b] = fixId.split(':');
  const overlay = p.tracks.find((t) => t.kind === 'overlay');
  const caps = p.tracks.find((t) => t.kind === 'caption');
  const video = p.tracks.find((t) => t.kind === 'video');
  const allClips = () => p.tracks.flatMap((t) => t.clips);
  switch (kind) {
    case 'add-hook':
      overlay?.clips.push(makeClip({ kind: 'text', start: 0, duration: 2.8, text: ctx.hook || p.scenes[0]?.title || p.title, style: { ...TITLE_STYLE, size: 9, y: 0.4 }, transition: 'fade', fadeIn: 0.3, fadeOut: 0.3 }));
      break;
    case 'add-cta': {
      const d = projectDuration(p);
      overlay?.clips.push(makeClip({ kind: 'text', start: Math.max(0, d - 3), duration: 3, text: 'Follow for more →', style: { ...TITLE_STYLE, size: 8 }, transition: 'fade', fadeIn: 0.4 }));
      break;
    }
    case 'split-first': {
      if (!video) break;
      const first = [...video.clips].sort((x, y) => x.start - y.start)[0];
      if (!first) break;
      const at = p.aspect === '9:16' ? 2.5 : 4;
      if (first.duration <= at + 0.5) break;
      const second = { ...structuredClone(first), id: first.id + 'b', start: first.start + at, duration: first.duration - at, offset: first.offset + at, transition: 'zoom' as const, fadeIn: 0.3, transform: { ...first.transform, scale: first.transform.scale * 1.15 } };
      first.duration = at;
      video.clips.push(second);
      break;
    }
    case 'tighten': {
      if (!video) break;
      const sorted = [...video.clips].sort((x, y) => x.start - y.start);
      let t = sorted[0]?.start ?? 0;
      const shift = new Map<string, number>();
      for (const c of sorted) {
        const old = { s: c.start, e: c.start + c.duration };
        if (c.kind === 'image' || c.kind === 'color') c.duration = Math.max(1, +(c.duration * 0.8).toFixed(2));
        c.start = +t.toFixed(2);
        shift.set(c.id, c.start - old.s);
        t += c.duration;
      }
      // scale captions and overlays proportionally to the new runtime
      const ratio = t / Math.max(0.01, (sorted.at(-1)?.start ?? 0) + (sorted.at(-1)?.duration ?? 0) - (sorted[0]?.start ?? 0) || t);
      for (const tr of p.tracks) if (tr.kind === 'caption' || tr.kind === 'overlay') tr.clips.forEach((c) => { c.start = +(c.start * ratio).toFixed(2); c.duration = +(c.duration * ratio).toFixed(2); });
      break;
    }
    case 'close-gaps': {
      if (!video) break;
      let t = 0;
      [...video.clips].sort((x, y) => x.start - y.start).forEach((c) => { if (c.start > t) c.start = +t.toFixed(3); t = c.start + c.duration; });
      break;
    }
    case 'captions-from-scenes': {
      if (!caps) break;
      let t = 0;
      const out = [];
      for (const s of p.scenes) { if (s.narration.trim()) out.push(...captionsFromText(s.narration, t, s.duration)); t += s.duration; }
      if (!out.length && p.script.trim()) out.push(...captionsFromText(p.script.replace(/^##.*$/gm, ''), 0, projectDuration(p) || undefined));
      caps.clips = out;
      break;
    }
    case 'slow-caption':
      allClips().filter((c) => c.kind === 'caption').forEach((c) => { const need = Math.max(1.1, (c.text?.length ?? 0) / 17); if (c.duration < need) c.duration = +need.toFixed(2); });
      if (caps) { const s = [...caps.clips].sort((x, y) => x.start - y.start); for (let i = 1; i < s.length; i++) if (s[i].start < s[i - 1].start + s[i - 1].duration) s[i].start = +(s[i - 1].start + s[i - 1].duration).toFixed(2); }
      break;
    case 'boost-contrast':
      allClips().filter((c) => c.style).forEach((c) => { c.style!.color = '#ffffff'; if (!c.style!.bg || c.kind === 'caption') c.style!.bg = 'rgba(0,0,0,0.72)'; });
      break;
    case 'bigger-text':
      allClips().filter((c) => c.style && c.style.size < 3.5).forEach((c) => { c.style!.size = 4.5; });
      break;
    case 'aspect':
      p.aspect = a as Aspect;
      break;
    case 'movey': {
      const c = allClips().find((x) => x.id === a);
      if (c?.style) c.style.y = Math.max(0.05, Math.min(0.95, +b));
      break;
    }
    case 'remove-missing':
      break; // handled by caller with asset list (see removeMissing)
    case 'brand-colors':
      if (ctx.kit) allClips().filter((c) => c.style && c.kind === 'text').forEach((c) => { c.style!.color = ctx.kit!.colors[0]; });
      break;
    case 'brand-fonts':
      if (ctx.kit) allClips().filter((c) => c.style).forEach((c) => { c.style!.font = c.kind === 'text' ? ctx.kit!.headingFont : ctx.kit!.bodyFont; });
      break;
    case 'add-disclaimer': {
      if (!ctx.kit || !caps) break;
      const d = projectDuration(p);
      overlay?.clips.push(makeClip({ kind: 'text', start: Math.max(0, d - 4), duration: 4, text: ctx.kit.disclaimer, style: { ...CAPTION_STYLE, size: 2.8, y: 0.94, bg: '' } }));
      break;
    }
    case 'add-logo': {
      if (!ctx.kit?.logoAssetId || !overlay) break;
      overlay.clips.push(makeClip({ kind: 'image', assetId: ctx.kit.logoAssetId, start: 0, duration: projectDuration(p) || 5, transform: { scale: 0.14, x: 0.4, y: -0.4 } }));
      break;
    }
  }
  return p;
}

export function removeMissing(p0: Project, assetIds: Set<string>) {
  const p = clone(p0);
  p.tracks.forEach((t) => { t.clips = t.clips.filter((c) => !c.assetId || assetIds.has(c.assetId)); });
  return p;
}

const COLORS: Record<string, string> = { yellow: '#ffd84a', white: '#ffffff', black: '#000000', red: '#ff5a52', blue: '#6aa6ff', green: '#5fd38d', amber: '#e8b25c', violet: '#8b7cf6', purple: '#8b7cf6', orange: '#ff9a3c', pink: '#ff7ab6' };

export interface Revision { summary: string; changes: string[]; apply: (p: Project) => Project }

/** Rule-based plain-language revision parser. Returns null when the request isn't understood. */
export function parseRevision(input: string, p: Project): Revision[] | null {
  const parts = input.toLowerCase().split(/\s*(?:,|\band then\b|\bthen\b|\band\b|;)\s*/).filter(Boolean);
  const out: Revision[] = [];
  const mod = (summary: string, fn: (q: Project) => void, changes: string[] = []): Revision => ({ summary, changes, apply: (q) => { const c = clone(q); fn(c); return c; } });
  for (const s of parts) {
    let m: RegExpMatchArray | null;
    if (/caption|subtitle/.test(s) && /(bigger|larger|increase)/.test(s)) out.push(mod('Make captions 20% larger', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'caption').forEach((c) => { c.style!.size = +(c.style!.size * 1.2).toFixed(2); })));
    else if (/caption|subtitle/.test(s) && /(smaller|decrease)/.test(s)) out.push(mod('Make captions 20% smaller', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'caption').forEach((c) => { c.style!.size = +(c.style!.size * 0.8).toFixed(2); })));
    else if (/caption|subtitle/.test(s) && /\b(up|higher)\b/.test(s)) out.push(mod('Move captions up', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'caption').forEach((c) => { c.style!.y = Math.max(0.1, c.style!.y - 0.1); })));
    else if (/caption|subtitle/.test(s) && /\b(down|lower)\b/.test(s)) out.push(mod('Move captions down', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'caption').forEach((c) => { c.style!.y = Math.min(0.92, c.style!.y + 0.08); })));
    else if ((m = s.match(/(caption|subtitle|text|title)s?.*\b(yellow|white|black|red|blue|green|amber|violet|purple|orange|pink)\b/))) {
      const col = COLORS[m[2]]; const kind = /caption|subtitle/.test(m[1]) ? 'caption' : 'text';
      out.push(mod(`Color ${kind === 'caption' ? 'captions' : 'titles'} ${m[2]}`, (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === kind).forEach((c) => { c.style!.color = col; })));
    }
    else if ((m = s.match(/(vertical|portrait|9:16|square|1:1|landscape|horizontal|16:9|4:5)/))) {
      const map: Record<string, Aspect> = { vertical: '9:16', portrait: '9:16', '9:16': '9:16', square: '1:1', '1:1': '1:1', landscape: '16:9', horizontal: '16:9', '16:9': '16:9', '4:5': '4:5' };
      const asp = map[m[1]]; out.push(mod(`Change aspect ratio to ${asp}`, (q) => { q.aspect = asp; }));
    }
    else if ((m = s.match(/(remove|delete|cut)\s+(scene|clip|shot)\s+(\d+)/))) {
      const n = +m[3];
      out.push(mod(`Remove ${m[2]} ${n} and close the gap`, (q) => {
        const v = q.tracks.find((t) => t.kind === 'video'); if (!v) return;
        const sorted = [...v.clips].sort((a, b) => a.start - b.start); const target = sorted[n - 1]; if (!target) return;
        const end = target.start + target.duration, d = target.duration;
        v.clips = v.clips.filter((c) => c.id !== target.id);
        q.tracks.forEach((t) => { t.clips = t.clips.filter((c) => !(t.kind !== 'audio' && c.start >= target.start && c.start + c.duration <= end + 0.01 && c.id !== target.id)); t.clips.forEach((c) => { if (c.start >= end - 0.01) c.start = +(c.start - d).toFixed(2); }); });
        if (m![2] === 'scene' && q.scenes[n - 1]) q.scenes.splice(n - 1, 1);
      }));
    }
    else if (/(speed up|faster|tighten|snappier|quicker)/.test(s)) out.push({ summary: 'Tighten pacing (stills −20%)', changes: [], apply: (q) => applyFix(q, 'tighten') });
    else if (/(add|use).*(fade|transition)/.test(s)) out.push(mod('Add fade transitions between shots', (q) => q.tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips).forEach((c) => { c.transition = 'fade'; c.fadeIn = 0.5; })));
    else if (/(zoom|ken burns)/.test(s)) out.push(mod('Add slow zoom to stills', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'image').forEach((c) => { c.transition = 'zoom'; c.fadeIn = 0.6; })));
    else if (/(remove|no).*(transition|fade)/.test(s)) out.push(mod('Remove transitions', (q) => q.tracks.flatMap((t) => t.clips).forEach((c) => { c.transition = 'none'; c.fadeIn = 0; c.fadeOut = 0; })));
    else if ((m = s.match(/music.*?(\d{1,3})\s*%/))) { const v = +m[1] / 100; out.push(mod(`Set music volume to ${m[1]}%`, (q) => q.tracks.filter((t) => t.kind === 'audio' && /music/i.test(t.name)).flatMap((t) => t.clips).forEach((c) => { c.volume = v; }))); }
    else if (/(lower|quieter|reduce|turn down).*music|music.*(lower|quieter|down)/.test(s)) out.push(mod('Lower music by 40%', (q) => q.tracks.filter((t) => t.kind === 'audio' && /music/i.test(t.name)).flatMap((t) => t.clips).forEach((c) => { c.volume = +(c.volume * 0.6).toFixed(2); })));
    else if (/(louder|raise|boost).*music|music.*(louder|up)/.test(s)) out.push(mod('Raise music by 25%', (q) => q.tracks.filter((t) => t.kind === 'audio' && /music/i.test(t.name)).flatMap((t) => t.clips).forEach((c) => { c.volume = Math.min(1.5, +(c.volume * 1.25).toFixed(2)); })));
    else if (/mute.*(video|clip|original)/.test(s)) out.push(mod('Mute original video audio', (q) => q.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'video').forEach((c) => { c.volume = 0; })));
    else if ((m = s.match(/(?:shorten|trim|cut).*?(\d+)\s*(?:s|sec|seconds)/))) {
      const max = +m[1]; out.push(mod(`Trim the video to ${max}s`, (q) => { q.tracks.forEach((t) => { t.clips = t.clips.filter((c) => c.start < max); t.clips.forEach((c) => { if (c.start + c.duration > max) c.duration = +(max - c.start).toFixed(2); }); }); }));
    }
    else if ((m = input.match(/add (?:a )?title\s+["“']?([^"”']+)["”']?/i)) && /title/.test(s)) { const text = m[1].trim(); out.push(mod(`Add title “${text}” at 0:00`, (q) => { q.tracks.find((t) => t.kind === 'overlay')?.clips.push(makeClip({ kind: 'text', start: 0, duration: 3, text, style: { ...TITLE_STYLE }, transition: 'fade', fadeIn: 0.4, fadeOut: 0.3 })); })); }
    else if (/(add|generate|create).*caption/.test(s)) out.push({ summary: 'Generate captions from scene narration', changes: [], apply: (q) => applyFix(q, 'captions-from-scenes') });
    else if (/(cta|call to action|end card)/.test(s)) out.push({ summary: 'Add an end-card call to action', changes: [], apply: (q) => applyFix(q, 'add-cta') });
  }
  void p;
  return out.length ? out : null;
}

export const REVISION_EXAMPLES = ['Make captions bigger and yellow', 'Make it vertical', 'Speed up and add fade transitions', 'Lower the music', 'Remove scene 2', 'Trim to 30 seconds', 'Add title "Three tips for better sleep"', 'Add a call to action'];

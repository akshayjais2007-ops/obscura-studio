// Deterministic, explainable analyzers. They inspect real project data — they do not guess audience behavior.
import type { Asset, BrandKit, Clip, Project, Scene, TextStyle } from './types';
import { projectDuration } from './project';

export type Severity = 'info' | 'warn' | 'bad' | 'ok';
export interface Finding { id: string; severity: Severity; title: string; detail: string; time?: number; fix?: string; fixId?: string; clipId?: string }

const all = (p: Project) => p.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, track: t })));
const visual = (p: Project) => p.tracks.filter((t) => t.kind === 'video' && !t.hidden).flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
const captions = (p: Project) => p.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips).sort((a, b) => a.start - b.start);

const WEAK_OPENERS = ['hey guys', 'hi guys', 'welcome back', 'in this video', 'today i', 'hello everyone', 'so um', 'before we start', 'don\u2019t forget to subscribe', "don't forget to subscribe"];
const CURIOSITY = ['secret', 'mistake', 'why', 'how', 'never', 'stop', 'nobody', 'truth', 'actually', 'finally', 'hidden', 'worst', 'best', 'only', 'instead', 'wrong', 'until'];

/** Heuristic hook score 0..100 with reasons. */
export function scoreHook(text: string) {
  const t = text.trim();
  const lower = t.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  let s = 50;
  const reasons: { delta: number; why: string }[] = [];
  const add = (d: number, why: string) => { s += d; reasons.push({ delta: d, why }); };
  if (!words.length) return { score: 0, reasons: [{ delta: 0, why: 'Empty hook' }] };
  if (words.length >= 5 && words.length <= 14) add(12, 'Tight length (5–14 words) is easy to read in ~3 seconds');
  else if (words.length > 22) add(-15, 'Too long to land in the first 3 seconds');
  else if (words.length < 5) add(-4, 'Very short — make sure it states a clear promise');
  if (WEAK_OPENERS.some((w) => lower.startsWith(w) || lower.includes(w))) add(-22, 'Starts with a warm-up phrase viewers often skip');
  if (/\d/.test(t)) add(8, 'Specific number adds concreteness');
  if (/\byou(r)?\b/i.test(t)) add(7, 'Speaks directly to the viewer');
  if (/\?$/.test(t)) add(6, 'Opens a question loop');
  const cur = CURIOSITY.filter((w) => lower.includes(w));
  if (cur.length) add(Math.min(12, cur.length * 5), `Curiosity words: ${cur.slice(0, 3).join(', ')}`);
  if (/!{2,}|[A-Z]{6,}/.test(t)) add(-6, 'All-caps or repeated “!” reads as clickbait');
  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons };
}

export function retentionDoctor(p: Project): Finding[] {
  const f: Finding[] = [];
  const dur = projectDuration(p);
  const vis = visual(p);
  const caps = captions(p);
  const short = p.aspect === '9:16';
  if (!vis.length) return [{ id: 'empty', severity: 'bad', title: 'No visuals on the timeline', detail: 'Add clips or images to the video track first.', fix: 'Open the editor and drag media onto Video 1.' }];
  // Hook
  const hookText = [...caps, ...p.tracks.filter((t) => t.kind === 'overlay').flatMap((t) => t.clips)].filter((c) => c.start < 3).map((c) => c.text).join(' ').trim() || p.scenes[0]?.narration.split(/[.!?]/)[0] || '';
  if (!hookText) f.push({ id: 'hook-none', severity: 'bad', title: 'No hook in the first 3 seconds', detail: 'There is no on-screen text or caption before 0:03.', time: 0, fix: 'Add a one-line promise as a title at 0:00.', fixId: 'add-hook' });
  else {
    const h = scoreHook(hookText);
    f.push({ id: 'hook-score', severity: h.score >= 70 ? 'ok' : h.score >= 50 ? 'warn' : 'bad', title: `Hook strength ${h.score}/100`, detail: `“${hookText.slice(0, 90)}” — ${h.reasons.map((r) => r.why).join('; ')}`, time: 0, fix: h.score < 70 ? 'Try Hook Battle Arena to compare alternatives.' : undefined });
  }
  // First cut
  if (vis[0] && vis[0].duration > (short ? 3 : 6)) f.push({ id: 'first-cut', severity: 'warn', title: 'First shot lingers', detail: `The opening shot runs ${vis[0].duration.toFixed(1)}s before the first visual change.`, time: 0, fix: `Split the opening at ${short ? '2.5' : '4'}s or add a title overlay.`, fixId: 'split-first', clipId: vis[0].id });
  // Pacing
  const avg = vis.reduce((a, c) => a + c.duration, 0) / vis.length;
  const target = short ? 2.5 : 5.5;
  f.push({ id: 'pace', severity: avg > target * 1.6 ? 'warn' : 'ok', title: `Average shot length ${avg.toFixed(1)}s`, detail: `Typical target for ${short ? 'vertical shorts' : 'long-form'} is about ${target}s. ${vis.length} shots in ${dur.toFixed(1)}s.`, fix: avg > target * 1.6 ? 'Use “Tighten pacing” to shorten still images by 20%.' : undefined, fixId: avg > target * 1.6 ? 'tighten' : undefined });
  // Static stretches
  vis.filter((c) => c.duration > (short ? 6 : 12) && c.kind !== 'video').forEach((c) => f.push({ id: 'static-' + c.id, severity: 'warn', title: 'Long static image', detail: `A still image stays on screen for ${c.duration.toFixed(1)}s starting at ${c.start.toFixed(1)}s — a likely drop-off point.`, time: c.start, fix: 'Split it, add a zoom transition, or overlay text.', clipId: c.id }));
  // Gaps
  let cursor = 0;
  for (const c of vis) {
    if (c.start - cursor > 0.25) f.push({ id: 'gap-' + c.id, severity: 'bad', title: 'Black gap', detail: `${(c.start - cursor).toFixed(1)}s of empty video at ${cursor.toFixed(1)}s.`, time: cursor, fix: 'Close gaps so the video never cuts to black.', fixId: 'close-gaps' });
    cursor = Math.max(cursor, c.start + c.duration);
  }
  // Captions coverage
  const covered = caps.reduce((a, c) => a + c.duration, 0);
  const pct = dur ? Math.round((covered / dur) * 100) : 0;
  f.push({ id: 'caps', severity: pct < 40 ? 'warn' : 'ok', title: `Captions cover ${pct}% of the video`, detail: 'Many viewers watch muted; captions help them stay.', fix: pct < 40 ? 'Generate captions from scene narration.' : undefined, fixId: pct < 40 ? 'captions-from-scenes' : undefined });
  // Ending
  const lastText = [...caps, ...p.tracks.filter((t) => t.kind === 'overlay').flatMap((t) => t.clips)].filter((c) => c.start > dur - 6).map((c) => c.text?.toLowerCase() ?? '').join(' ');
  if (!/(subscribe|follow|link|visit|watch|next|comment|shop|book|call|learn more|sign up)/.test(lastText)) f.push({ id: 'cta', severity: 'info', title: 'No clear call-to-action at the end', detail: 'The last 6 seconds contain no next step.', time: Math.max(0, dur - 3), fix: 'Add an end card with what viewers should do next.', fixId: 'add-cta' });
  if (dur > (short ? 60 : 1200)) f.push({ id: 'len', severity: 'info', title: 'Long runtime for this format', detail: `${dur.toFixed(0)}s. ${short ? 'Shorts are capped at 60s on some platforms.' : 'Check each section earns its time.'}` });
  return f;
}

/** WCAG relative luminance contrast */
export function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return 0;
    const [r, g, bl] = m.slice(0, 3).map((x) => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
}

function bgHex(style: TextStyle) {
  if (!style.bg) return '#3a3a3a'; // assumes mid-tone footage when no box
  const m = style.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
  return style.bg.startsWith('#') ? style.bg.slice(0, 7) : '#000000';
}

export function accessibilityInspector(p: Project): Finding[] {
  const f: Finding[] = [];
  const caps = captions(p);
  const hasAudio = all(p).some((c) => c.kind === 'audio' || c.kind === 'video');
  if (hasAudio && !caps.length) f.push({ id: 'nocaps', severity: 'bad', title: 'Audio without captions', detail: 'Deaf and hard-of-hearing viewers can’t follow along.', fix: 'Add captions or import an SRT.', fixId: 'captions-from-scenes' });
  caps.forEach((c, i) => {
    const text = c.text ?? '';
    const cps = text.length / Math.max(0.1, c.duration);
    if (cps > 20) f.push({ id: 'cps' + c.id, severity: 'warn', title: `Caption ${i + 1} is too fast`, detail: `${cps.toFixed(0)} characters/second (aim ≤ 17–20).`, time: c.start, fix: 'Lengthen it or split the text.', clipId: c.id, fixId: 'slow-caption' });
    if (c.duration < 1) f.push({ id: 'short' + c.id, severity: 'warn', title: `Caption ${i + 1} flashes by`, detail: `${c.duration.toFixed(2)}s on screen (min ~1s).`, time: c.start, clipId: c.id, fixId: 'slow-caption' });
    if (c.duration > 7) f.push({ id: 'long' + c.id, severity: 'info', title: `Caption ${i + 1} stays very long`, detail: `${c.duration.toFixed(1)}s — split into readable chunks.`, time: c.start, clipId: c.id });
    if (text.length > 84) f.push({ id: 'len' + c.id, severity: 'warn', title: `Caption ${i + 1} is over 2 lines`, detail: `${text.length} characters (aim ≤ 42 per line, 2 lines).`, time: c.start, clipId: c.id });
    const next = caps[i + 1];
    if (next && next.start < c.start + c.duration - 0.05) f.push({ id: 'ov' + c.id, severity: 'warn', title: `Captions ${i + 1} and ${i + 2} overlap`, detail: 'Two captions show at once.', time: next.start, clipId: c.id });
  });
  const textClips = all(p).filter((c) => (c.kind === 'caption' || c.kind === 'text') && c.style);
  const seen = new Set<string>();
  textClips.forEach((c) => {
    const key = c.style!.color + c.style!.bg;
    if (seen.has(key)) return;
    seen.add(key);
    const ratio = contrastRatio(c.style!.color, bgHex(c.style!));
    if (ratio < 4.5) f.push({ id: 'ct' + c.id, severity: 'bad', title: `Low text contrast (${ratio}:1)`, detail: `Text ${c.style!.color} on ${c.style!.bg || 'footage'} is below WCAG AA 4.5:1.`, time: c.start, fix: 'Use a solid caption box or lighter text.', clipId: c.id, fixId: 'boost-contrast' });
    if (c.style!.size < 3.5) f.push({ id: 'sz' + c.id, severity: 'warn', title: 'Small text', detail: `Text size ${c.style!.size}% may be hard to read on phones.`, clipId: c.id, fixId: 'bigger-text' });
  });
  if (!f.length) f.push({ id: 'ok', severity: 'ok', title: 'No accessibility issues found', detail: 'Caption timing, length and contrast look good.' });
  return f;
}

export const PLATFORM_ZONES: Record<string, { label: string; aspect: string; top: number; bottom: number; left: number; right: number }> = {
  shorts: { label: 'YouTube Shorts', aspect: '9:16', top: 0.12, bottom: 0.22, left: 0.06, right: 0.16 },
  tiktok: { label: 'TikTok', aspect: '9:16', top: 0.1, bottom: 0.25, left: 0.06, right: 0.18 },
  reels: { label: 'Instagram Reels', aspect: '9:16', top: 0.12, bottom: 0.24, left: 0.06, right: 0.14 },
  youtube: { label: 'YouTube (16:9)', aspect: '16:9', top: 0.05, bottom: 0.12, left: 0.05, right: 0.05 },
  feed: { label: 'Square feed', aspect: '1:1', top: 0.06, bottom: 0.08, left: 0.06, right: 0.06 },
};

export function safeZoneCheck(p: Project, platform: keyof typeof PLATFORM_ZONES): Finding[] {
  const z = PLATFORM_ZONES[platform];
  const f: Finding[] = [];
  if (z.aspect !== p.aspect) f.push({ id: 'aspect', severity: 'warn', title: `Aspect is ${p.aspect}, ${z.label} expects ${z.aspect}`, detail: 'The platform will crop or letterbox.', fix: `Switch the project to ${z.aspect}.`, fixId: 'aspect:' + z.aspect });
  all(p).filter((c) => (c.kind === 'caption' || c.kind === 'text') && c.style).forEach((c) => {
    const s = c.style!;
    const halfH = (s.size / 100) * 1.2;
    const top = s.y - halfH, bottom = s.y + halfH;
    if (top < z.top) f.push({ id: 'top' + c.id, severity: 'bad', title: `“${(c.text ?? '').slice(0, 30)}” sits under the top UI`, detail: `Top ${Math.round(z.top * 100)}% is covered by ${z.label} controls.`, time: c.start, clipId: c.id, fixId: `movey:${c.id}:${(z.top + halfH + 0.02).toFixed(3)}`, fix: 'Move it down into the safe area.' });
    if (bottom > 1 - z.bottom) f.push({ id: 'bot' + c.id, severity: 'bad', title: `“${(c.text ?? '').slice(0, 30)}” is hidden by captions/buttons`, detail: `Bottom ${Math.round(z.bottom * 100)}% holds titles, buttons and descriptions.`, time: c.start, clipId: c.id, fixId: `movey:${c.id}:${(1 - z.bottom - halfH - 0.02).toFixed(3)}`, fix: 'Move it up into the safe area.' });
    if (s.x > 1 - z.right - 0.15 && s.align !== 'center') f.push({ id: 'r' + c.id, severity: 'warn', title: 'Text near the right-side buttons', detail: 'Like/comment buttons cover the right edge.', clipId: c.id });
  });
  if (!f.length) f.push({ id: 'ok', severity: 'ok', title: `All text is inside ${z.label} safe zones`, detail: 'Nothing is covered by platform UI.' });
  return f;
}

export function qualityGate(p: Project, assets: Asset[], opts: { res: number; maxRes: number }): Finding[] {
  const f: Finding[] = [];
  const dur = projectDuration(p);
  const clips = all(p);
  if (!dur) f.push({ id: 'empty', severity: 'bad', title: 'Timeline is empty', detail: 'Nothing to export.' });
  const missing = clips.filter((c) => c.assetId && !assets.find((a) => a.id === c.assetId && !a.deletedAt));
  if (missing.length) f.push({ id: 'missing', severity: 'bad', title: `${missing.length} clip(s) reference missing media`, detail: 'Their source files were deleted.', fix: 'Remove these clips or re-upload the media.', fixId: 'remove-missing' });
  if (opts.res > opts.maxRes) f.push({ id: 'plan', severity: 'bad', title: `${opts.res}p exceeds your plan (max ${opts.maxRes}p)`, detail: 'Pick a lower resolution or change plan.' });
  const low = clips.filter((c) => c.assetId).map((c) => assets.find((a) => a.id === c.assetId)).filter((a): a is Asset => !!a && a.type !== 'audio' && Math.min(a.width, a.height) > 0 && Math.min(a.width, a.height) < opts.res * 0.75);
  if (low.length) f.push({ id: 'lowres', severity: 'warn', title: `${new Set(low.map((a) => a.id)).size} source(s) below export resolution`, detail: `${[...new Set(low.map((a) => `${a.name} (${a.width}×${a.height})`))].slice(0, 3).join(', ')} will be upscaled and may look soft.` });
  const clipped = clips.filter((c) => c.assetId).map((c) => assets.find((a) => a.id === c.assetId)).filter((a): a is Asset => !!a && !!a.peaks && Math.max(...a.peaks) >= 0.99);
  if (clipped.length) f.push({ id: 'clip', severity: 'warn', title: 'Audio may be clipping', detail: `${[...new Set(clipped.map((a) => a.name))].slice(0, 3).join(', ')} hit full scale. Lower clip volume to ~80%.` });
  const loud = clips.filter((c) => c.volume > 1.2);
  if (loud.length) f.push({ id: 'vol', severity: 'warn', title: `${loud.length} clip(s) boosted above 120%`, detail: 'Boosting can distort audio.' });
  if (!captions(p).length) f.push({ id: 'caps', severity: 'info', title: 'No captions', detail: 'Exports without captions are less accessible.', fixId: 'captions-from-scenes' });
  const gaps = retentionDoctor(p).filter((x) => x.id.startsWith('gap-'));
  if (gaps.length) f.push({ id: 'gaps', severity: 'warn', title: `${gaps.length} black gap(s)`, detail: 'Your export will cut to black.', fixId: 'close-gaps' });
  if (p.fps !== 24 && p.fps !== 25 && p.fps !== 30 && p.fps !== 60) f.push({ id: 'fps', severity: 'warn', title: `Unusual frame rate ${p.fps}`, detail: 'Use 24, 25, 30 or 60 fps.' });
  if (!f.some((x) => x.severity === 'bad')) f.unshift({ id: 'pass', severity: 'ok', title: 'Ready to export', detail: `${dur.toFixed(1)}s at ${opts.res}p, ${p.fps} fps. No blocking issues.` });
  return f;
}

export function parseCharacters(s: string) {
  return s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^([^()]+?)\s*(?:\((.*)\))?$/);
    return { name: (m?.[1] ?? x).trim(), outfit: (m?.[2] ?? '').trim().toLowerCase() };
  });
}

export function continuityCheck(scenes: Scene[]): Finding[] {
  const f: Finding[] = [];
  const lastSeen = new Map<string, { outfit: string; idx: number; location: string; tod: string }>();
  scenes.forEach((s, i) => {
    const prev = scenes[i - 1];
    const sameSequence = prev && prev.location && prev.location.toLowerCase() === s.location.toLowerCase();
    if (sameSequence && prev.timeOfDay && s.timeOfDay && prev.timeOfDay !== s.timeOfDay) f.push({ id: 'tod' + s.id, severity: 'warn', title: `Scene ${i + 1}: time jumps from ${prev.timeOfDay} to ${s.timeOfDay}`, detail: `Both scenes are at “${s.location}”. Add a transition or a time cue if intended.` });
    for (const c of parseCharacters(s.characters)) {
      const key = c.name.toLowerCase();
      const ls = lastSeen.get(key);
      if (ls && c.outfit && ls.outfit && c.outfit !== ls.outfit) {
        const continuous = ls.idx === i - 1 && ls.location.toLowerCase() === s.location.toLowerCase() && (!ls.tod || ls.tod === s.timeOfDay);
        f.push({ id: 'out' + s.id + key, severity: continuous ? 'bad' : 'info', title: `${c.name}'s outfit changes in scene ${i + 1}`, detail: `“${ls.outfit}” (scene ${ls.idx + 1}) → “${c.outfit}”. ${continuous ? 'Same place and time — likely a continuity error.' : 'Different place/time — confirm it is intentional.'}` });
      }
      lastSeen.set(key, { outfit: c.outfit || ls?.outfit || '', idx: i, location: s.location, tod: s.timeOfDay });
    }
    if (!s.location && s.characters) f.push({ id: 'loc' + s.id, severity: 'info', title: `Scene ${i + 1} has no location`, detail: 'Add a location so continuity can be tracked.' });
  });
  if (!scenes.length) f.push({ id: 'none', severity: 'info', title: 'No scenes yet', detail: 'Add scenes with characters, outfits and locations to check continuity.' });
  else if (!f.length) f.push({ id: 'ok', severity: 'ok', title: 'No continuity breaks found', detail: `Checked ${scenes.length} scenes.` });
  return f;
}

export const STRUCTURES: Record<string, { label: string; beats: { name: string; pct: number }[] }> = {
  hso: { label: 'Hook → Story → Offer', beats: [{ name: 'Hook', pct: 0.1 }, { name: 'Story', pct: 0.65 }, { name: 'Offer / CTA', pct: 0.25 }] },
  three: { label: 'Three-act', beats: [{ name: 'Setup', pct: 0.25 }, { name: 'Confrontation', pct: 0.5 }, { name: 'Resolution', pct: 0.25 }] },
  pas: { label: 'Problem → Agitate → Solve', beats: [{ name: 'Problem', pct: 0.2 }, { name: 'Agitate', pct: 0.3 }, { name: 'Solve', pct: 0.4 }, { name: 'CTA', pct: 0.1 }] },
  listicle: { label: 'Listicle (5 points)', beats: [{ name: 'Hook', pct: 0.08 }, ...[1, 2, 3, 4, 5].map((n) => ({ name: `Point ${n}`, pct: 0.16 })), { name: 'Wrap-up', pct: 0.12 }] },
  tutorial: { label: 'Tutorial', beats: [{ name: 'Result preview', pct: 0.08 }, { name: 'Why it matters', pct: 0.12 }, { name: 'Steps', pct: 0.6 }, { name: 'Recap', pct: 0.12 }, { name: 'Next', pct: 0.08 }] },
};

export function simulateStructure(total: number, key: string) {
  const s = STRUCTURES[key];
  let t = 0;
  return s.beats.map((b) => { const seg = { name: b.name, start: +t.toFixed(1), duration: +(b.pct * total).toFixed(1) }; t += b.pct * total; return seg; });
}

export function brandCheck(p: Project, kit: BrandKit | undefined): Finding[] {
  if (!kit) return [{ id: 'nokit', severity: 'info', title: 'No brand kit selected', detail: 'Pick a brand kit to check colors, fonts and disclaimers.' }];
  const f: Finding[] = [];
  const palette = kit.colors.map((c) => c.toLowerCase());
  const texts = all(p).filter((c) => (c.kind === 'text' || c.kind === 'caption') && c.style);
  const off = texts.filter((c) => !palette.includes(c.style!.color.toLowerCase()) && !['#ffffff', '#000000'].includes(c.style!.color.toLowerCase()));
  if (off.length) f.push({ id: 'color', severity: 'warn', title: `${off.length} text item(s) use off-brand colors`, detail: [...new Set(off.map((c) => c.style!.color))].join(', '), fixId: 'brand-colors', fix: `Recolor to ${kit.colors[0]}.` });
  const titles = texts.filter((c) => c.kind === 'text' && c.style!.font !== kit.headingFont);
  if (titles.length) f.push({ id: 'font', severity: 'warn', title: `${titles.length} title(s) don’t use the brand heading font`, detail: `Brand heading font: ${kit.headingFont}.`, fixId: 'brand-fonts' });
  if (kit.disclaimer.trim() && !texts.some((c) => (c.text ?? '').toLowerCase().includes(kit.disclaimer.trim().toLowerCase().slice(0, 20)))) f.push({ id: 'disc', severity: 'bad', title: 'Required disclaimer missing', detail: `“${kit.disclaimer}” doesn’t appear on screen.`, fixId: 'add-disclaimer', fix: 'Add the disclaimer to the end card.' });
  if (kit.logoAssetId && !all(p).some((c) => c.assetId === kit.logoAssetId)) f.push({ id: 'logo', severity: 'info', title: 'Logo not used', detail: 'Your brand logo doesn’t appear in this video.', fixId: 'add-logo' });
  if (!f.length) f.push({ id: 'ok', severity: 'ok', title: 'On brand', detail: 'Colors, fonts and disclaimers match the kit.' });
  return f;
}

/** Match scene text to assets by tag/name overlap. Pure. */
export function matchBroll(scenes: Scene[], assets: Asset[]) {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'you', 'your', 'are', 'was', 'from', 'into', 'our', 'have', 'will', 'just', 'about']);
  return scenes.map((s) => {
    const words = new Set(`${s.visual} ${s.narration} ${s.title}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w)));
    const ranked = assets.filter((a) => a.type !== 'audio').map((a) => {
      const terms = new Set([...a.tags, ...a.name.toLowerCase().split(/[^a-z0-9]+/)]);
      const hits = [...words].filter((w) => [...terms].some((t) => t === w || (t.length > 3 && (t.startsWith(w) || w.startsWith(t)))));
      return { asset: a, score: hits.length, hits };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    return { scene: s, matches: ranked.slice(0, 4), keywords: [...words].slice(0, 8) };
  });
}

/** Claim extraction for fact-checking: sentences carrying checkable assertions. Pure. */
export function extractClaims(text: string) {
  return text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const signals: string[] = [];
    if (/\d/.test(s)) signals.push('number');
    if (/\b(19|20)\d{2}\b/.test(s)) signals.push('date');
    if (/\b(always|never|every|all|none|only|best|worst|first|largest|most|least)\b/i.test(s)) signals.push('absolute');
    if (/\b(study|studies|research|scientists|experts|according|percent|%)\b/i.test(s)) signals.push('attribution');
    if (/\b(causes?|prevents?|cures?|leads to|proves?)\b/i.test(s)) signals.push('causal');
    return { text: s, signals };
  }).filter((c) => c.signals.length > 0);
}

export interface DiffResult { scenes: { added: string[]; removed: string[]; changed: string[] }; script: { type: 'same' | 'add' | 'del'; line: string }[]; timing: string[]; captions: string[]; audio: string[] }

export function lineDiff(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { type: 'same' | 'add' | 'del'; line: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', line: a[i++] });
    else out.push({ type: 'add', line: b[j++] });
  }
  while (i < n) out.push({ type: 'del', line: a[i++] });
  while (j < m) out.push({ type: 'add', line: b[j++] });
  return out;
}

export function diffVersions(a: Pick<Project, 'scenes' | 'script' | 'tracks'>, b: Pick<Project, 'scenes' | 'script' | 'tracks'>): DiffResult {
  const aIds = new Map(a.scenes.map((s) => [s.id, s])), bIds = new Map(b.scenes.map((s) => [s.id, s]));
  const scenes = {
    added: b.scenes.filter((s) => !aIds.has(s.id)).map((s) => s.title),
    removed: a.scenes.filter((s) => !bIds.has(s.id)).map((s) => s.title),
    changed: b.scenes.filter((s) => aIds.has(s.id) && JSON.stringify(aIds.get(s.id)) !== JSON.stringify(s)).map((s) => s.title),
  };
  const clipMap = (p: typeof a) => new Map(p.tracks.flatMap((t) => t.clips.map((c) => [c.id, { c, t: t.kind }] as const)));
  const ac = clipMap(a), bc = clipMap(b);
  const timing: string[] = [], captionsD: string[] = [], audio: string[] = [];
  const label = (c: Clip) => c.text ? `“${c.text.slice(0, 28)}”` : `${c.kind} clip`;
  for (const [id, { c, t }] of bc) {
    const old = ac.get(id);
    const bucket = t === 'caption' ? captionsD : t === 'audio' ? audio : timing;
    if (!old) { bucket.push(`+ Added ${label(c)} at ${c.start.toFixed(1)}s`); continue; }
    if (Math.abs(old.c.start - c.start) > 0.01 || Math.abs(old.c.duration - c.duration) > 0.01) bucket.push(`~ ${label(c)}: ${old.c.start.toFixed(1)}s/${old.c.duration.toFixed(1)}s → ${c.start.toFixed(1)}s/${c.duration.toFixed(1)}s`);
    if (old.c.text !== c.text && c.text !== undefined) captionsD.push(`~ Text: “${old.c.text?.slice(0, 30)}” → “${c.text.slice(0, 30)}”`);
    if (old.c.volume !== c.volume) audio.push(`~ Volume ${Math.round(old.c.volume * 100)}% → ${Math.round(c.volume * 100)}% on ${label(c)}`);
  }
  for (const [id, { c, t }] of ac) if (!bc.has(id)) (t === 'caption' ? captionsD : t === 'audio' ? audio : timing).push(`− Removed ${label(c)} at ${c.start.toFixed(1)}s`);
  return { scenes, script: lineDiff(a.script.split('\n'), b.script.split('\n')), timing, captions: captionsD, audio };
}

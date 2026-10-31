import { Download, Lock, Plus, Sparkles, Trash2, Trophy, Wand2, Play, Music } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Field, Input, Select, StatusPill, Textarea, cx, download, useToast, Progress } from '../../components/ui';
import { AssetThumb, Dropzone, ProjectPicker } from '../../components/shared';
import { useApp } from '../../lib/useApp';
import { scoreHook } from '../../lib/analyzers';
import { useIntegrations } from '../../lib/integrations';
import { enqueue, waitFor, InsufficientCredits } from '../../lib/jobs';
import { audit, update } from '../../lib/db';
import { CAPTION_STYLE, TITLE_STYLE, createProject, defaultTracks, makeClip, projectDuration, saveProject } from '../../lib/project';
import { decodeEnvelope, detectBeats, findHighlights } from '../../lib/media';
import { getBlob, blobUrl } from '../../lib/idb';
import { uid, ago, tc } from '../../lib/id';
import { templateFor } from '../../lib/templates';
import type { Aspect, Clip, StylePreset, Transition } from '../../lib/types';
import { commitProject } from './common';

export function HooksTool({ prompt }: { prompt?: string }) {
  const { isReady } = useIntegrations();
  const { db, user } = useApp();
  const toast = useToast();
  const [topic, setTopic] = useState(prompt ?? '');
  const [hooks, setHooks] = useState<string[]>(['In this video I will show you how to sleep better', 'You’re ruining your sleep in the first 10 minutes of your night', 'Why do I wake up at 3am? The real answer.']);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [wins, setWins] = useState<Record<string, number>>({});
  const scored = hooks.map((h) => ({ h, ...scoreHook(h), w: wins[h] ?? 0 })).sort((a, b) => b.w - a.w || b.score - a.score);
  const gen = async () => {
    if (!topic.trim()) { toast('Add a topic first.', 'warn'); return; }
    setBusy(true);
    try { const id = enqueue(user.id, 'ai_hooks', `Hooks · ${topic.slice(0, 40)}`, { topic }, { credits: db.config.costs.aiHooks }); const j = await waitFor(id); if (j.status === 'succeeded') { const hs = ((j.result?.data as { hooks?: string[] })?.hooks) ?? []; setHooks((x) => [...new Set([...x, ...hs])]); } else toast(j.error ?? 'Failed — refunded.', 'bad'); }
    catch (e) { toast(e instanceof InsufficientCredits ? e.message : (e as Error).message, 'warn'); } finally { setBusy(false); }
  };
  const battle = () => { if (hooks.length < 2) return; const a = Math.floor(Math.random() * hooks.length); let b = Math.floor(Math.random() * hooks.length); while (b === a) b = Math.floor(Math.random() * hooks.length); setPair([a, b]); };
  const pick = (i: number) => { const h = hooks[i]; setWins((w) => ({ ...w, [h]: (w[h] ?? 0) + 1 })); update((d) => { d.prefs.unshift({ id: uid('pf_'), userId: user.id, key: 'hook-winner', value: h, at: Date.now() }); }); battle(); };
  return (
    <div className="grid xl:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-3">
        {scored.map((s, i) => (
          <Card key={s.h} className="p-4">
            <div className="flex items-start gap-4">
              <div className="font-display text-4xl w-14 shrink-0 tabular" style={{ color: s.score >= 70 ? 'var(--color-ok)' : s.score >= 50 ? 'var(--color-amber)' : 'var(--color-bad)' }}>{s.score}</div>
              <div className="flex-1"><div className="font-medium">{i === 0 && s.w > 0 && <Trophy className="inline size-4 text-amber mr-1.5" />}{s.h}</div><ul className="text-xs text-mute mt-1.5 space-y-0.5">{s.reasons.map((r, j) => <li key={j} className={r.delta < 0 ? 'text-bad/90' : ''}>{r.delta > 0 ? '+' : ''}{r.delta} · {r.why}</li>)}</ul>{s.w > 0 && <div className="text-xs text-amber mt-1">{s.w} battle win{s.w > 1 ? 's' : ''}</div>}</div>
              <button onClick={() => setHooks(hooks.filter((x) => x !== s.h))} aria-label="Remove hook" className="text-dim hover:text-bad"><Trash2 className="size-4" /></button>
            </div>
          </Card>
        ))}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setHooks([...hooks, draft.trim()]); setDraft(''); } }}><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write another hook…" aria-label="New hook" /><Button type="submit" icon={<Plus className="size-4" />}>Add</Button></form>
        <p className="text-xs text-dim">Scores are a transparent heuristic (length, specificity, curiosity, weak openers) — not a prediction of views.</p>
      </div>
      <div className="space-y-4">
        <Card className="p-5 space-y-3">
          <div className="font-medium">Generate hooks</div>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Video topic" aria-label="Topic" />
          <Button className="w-full" icon={isReady('text') ? <Sparkles className="size-4" /> : <Lock className="size-4" />} disabled={!isReady('text')} loading={busy} onClick={gen}>Generate 6 · {db.config.costs.aiHooks} credits</Button>
          {!isReady('text') && <p className="text-xs text-dim">Text provider: <StatusPill status="not_configured" /></p>}
        </Card>
        <Card className="p-5">
          <div className="font-medium mb-3">Battle</div>
          {pair ? (<div className="space-y-2">{pair.map((i) => <button key={i} onClick={() => pick(i)} className="w-full text-left rounded-xl hairline p-3 text-sm hover:bg-paper hover:text-ink transition-colors">{hooks[i]}</button>)}<p className="text-xs text-dim">Pick the one you’d stop scrolling for. Winners are remembered in Creator Memory.</p></div>)
            : <Button className="w-full" icon={<Trophy className="size-4" />} onClick={battle} disabled={hooks.length < 2}>Start head-to-head</Button>}
        </Card>
      </div>
    </div>
  );
}

export function StyleDNATool() {
  const { db, workspace, user } = useApp();
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const styles = db.styles.filter((s) => s.workspaceId === workspace?.id);
  const [name, setName] = useState('');
  const fromProject = () => {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) { toast('Pick a project to capture its style.', 'warn'); return; }
    const cap = p.tracks.flatMap((t) => t.clips).find((c) => c.kind === 'caption')?.style ?? CAPTION_STYLE;
    const vis = p.tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips);
    const tr = (vis.find((c) => c.transition !== 'none')?.transition ?? 'none') as Transition;
    const pace = vis.filter((c) => c.kind === 'image').reduce((a, c, _, arr) => a + c.duration / arr.length, 0) || 4;
    const s: StylePreset = { id: uid('st_'), workspaceId: workspace.id, name: name.trim() || `${p.title} style`, caption: { ...cap }, transition: tr, fade: vis.find((c) => c.fadeIn)?.fadeIn ?? 0.4, aspect: p.aspect, pace: +pace.toFixed(1), createdAt: Date.now() };
    update((d) => { d.styles.push(s); d.prefs.unshift({ id: uid('pf_'), userId: user.id, key: 'style', value: s.name, at: Date.now() }); });
    setName('');
    toast(`Saved “${s.name}”.`, 'ok');
  };
  const apply = (s: StylePreset) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) { toast('Pick a project to apply to.', 'warn'); return; }
    const n = structuredClone(p);
    n.tracks.forEach((t) => t.clips.forEach((c) => { if (c.kind === 'caption') c.style = { ...s.caption }; if (t.kind === 'video' && c.kind !== 'color') { c.transition = s.transition; c.fadeIn = s.transition === 'none' ? 0 : s.fade; } }));
    const undo = commitProject(p, n, `Applied style ${s.name}`);
    toast(`Applied “${s.name}” to ${p.title}.`, 'ok', { label: 'Undo', run: undo });
  };
  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-col md:flex-row gap-3 md:items-end">
        <Field label="Project"><ProjectPicker value={projectId} onChange={setProjectId} /></Field>
        <Field label="Preset name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Calm documentary" /></Field>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={fromProject}>Capture style from project</Button>
      </Card>
      {!styles.length ? <Empty icon={<Wand2 className="size-5" />} title="No Style DNA yet" desc="Capture the caption look, transitions and pacing of a video you love, then reuse it." /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{styles.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="aspect-video rounded-lg bg-gradient-to-br from-[#1a1626] to-[#0f0f11] grid place-items-end p-3 mb-4"><span className="mx-auto px-2 py-1 rounded" style={{ color: s.caption.color, background: s.caption.bg || 'transparent', fontFamily: s.caption.font === 'display' ? 'Instrument Serif' : s.caption.font === 'mono' ? 'JetBrains Mono' : 'Hanken Grotesk', fontWeight: s.caption.weight, fontSize: Math.max(11, s.caption.size * 3) }}>Caption preview</span></div>
            <div className="font-display text-2xl">{s.name}</div>
            <div className="text-xs text-dim mt-1">{s.aspect} · {s.transition} · {s.pace}s per still</div>
            <div className="flex gap-1 mt-4"><Button size="sm" onClick={() => apply(s)} disabled={!projectId}>Apply to project</Button><Button size="sm" variant="quiet" icon={<Trash2 className="size-3.5" />} aria-label="Delete preset" onClick={() => update((d) => { d.styles = d.styles.filter((x) => x.id !== s.id); })} /></div>
          </Card>
        ))}</div>
      )}
    </div>
  );
}

export function MemoryTool() {
  const { db, user, workspace } = useApp();
  const prefs = db.prefs.filter((p) => p.userId === user.id);
  const projects = db.projects.filter((p) => p.ownerId === user.id && !p.deletedAt);
  const renders = db.assets.filter((a) => a.ownerId === user.id && a.source === 'render' && !a.deletedAt && a.type === 'video');
  const aspects = projects.reduce<Record<string, number>>((m, p) => ({ ...m, [p.aspect]: (m[p.aspect] ?? 0) + 1 }), {});
  const avg = projects.length ? projects.reduce((a, p) => a + projectDuration(p), 0) / projects.length : 0;
  void workspace;
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <Card className="p-5">
        <div className="font-medium mb-1">Approved preferences</div>
        <p className="text-xs text-dim mb-4">Only things you explicitly accepted: applied revisions, hook battle winners and saved styles. Delete anything.</p>
        <ul className="space-y-1.5">{prefs.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-xl hairline px-3 py-2 text-sm"><span className="text-[10px] uppercase tracking-wider text-dim w-24 shrink-0">{p.key}</span><span className="flex-1 truncate">{p.value}</span><span className="text-xs text-dim">{ago(p.at)}</span><button aria-label="Forget" onClick={() => update((d) => { d.prefs = d.prefs.filter((x) => x.id !== p.id); })} className="text-dim hover:text-bad"><Trash2 className="size-3.5" /></button></li>)}</ul>
        {!prefs.length && <p className="text-sm text-dim">Nothing remembered yet.</p>}
      </Card>
      <Card className="p-5 h-fit space-y-3 text-sm">
        <div className="font-medium">Your real history</div>
        <div className="flex justify-between"><span className="text-mute">Projects</span><span>{projects.length}</span></div>
        <div className="flex justify-between"><span className="text-mute">Exports</span><span>{renders.length}</span></div>
        <div className="flex justify-between"><span className="text-mute">Average length</span><span>{tc(avg)}</span></div>
        <div className="flex justify-between"><span className="text-mute">Favorite format</span><span>{Object.entries(aspects).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}</span></div>
        <p className="text-xs text-dim pt-2 border-t border-line">Views, watch time and CTR need platform analytics: <StatusPill status="not_configured" /></p>
      </Card>
    </div>
  );
}

export function ExperimentsTool() {
  const { db, user, workspace } = useApp();
  const toast = useToast();
  const exps = db.experiments.filter((e) => e.userId === user.id);
  const projects = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt);
  const [name, setName] = useState('');
  const [hyp, setHyp] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const create = () => {
    if (!name.trim() || picked.length < 2) { toast('Name it and pick at least two variant projects.', 'warn'); return; }
    update((d) => { d.experiments.unshift({ id: uid('ex_'), userId: user.id, name: name.trim(), hypothesis: hyp.trim(), variants: picked.map((id, i) => ({ projectId: id, label: String.fromCharCode(65 + i) })), createdAt: Date.now() }); });
    setName(''); setHyp(''); setPicked([]);
  };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <Card className="p-5 space-y-4 h-fit">
        <div className="font-medium">New experiment</div>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring sale — hook test" /></Field>
        <Field label="Hypothesis"><Textarea value={hyp} onChange={(e) => setHyp(e.target.value)} rows={2} placeholder="A problem-first hook beats a product-first hook" /></Field>
        <div><div className="text-sm font-medium mb-2">Variants</div><div className="space-y-1 max-h-48 overflow-auto scroll-thin">{projects.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />{p.title}</label>)}</div></div>
        <Button variant="primary" onClick={create}>Create experiment</Button>
      </Card>
      <div className="space-y-3">
        {exps.map((e) => (
          <Card key={e.id} className="p-5">
            <div className="flex justify-between"><div className="font-display text-2xl">{e.name}</div><button aria-label="Delete experiment" onClick={() => update((d) => { d.experiments = d.experiments.filter((x) => x.id !== e.id); })} className="text-dim hover:text-bad"><Trash2 className="size-4" /></button></div>
            {e.hypothesis && <p className="text-sm text-mute mt-1">{e.hypothesis}</p>}
            <div className="grid sm:grid-cols-2 gap-2 mt-4">{e.variants.map((v) => { const p = db.projects.find((x) => x.id === v.projectId); return <div key={v.projectId} className="rounded-xl hairline p-3 text-sm flex justify-between items-center"><span><b className="mr-2">{v.label}</b>{p?.title ?? 'deleted project'}</span><span className="text-xs text-dim">— no metrics</span></div>; })}</div>
            <p className="text-xs text-dim mt-3">Results stay empty until an ads/analytics account is connected. We never estimate performance.</p>
          </Card>
        ))}
        {!exps.length && <Empty icon={<Trophy className="size-5" />} title="No experiments" desc="Group ad variants and record what you’re testing." />}
      </div>
    </div>
  );
}

export function LectureKitTool({ prompt }: { prompt?: string }) {
  const [text, setText] = useState(prompt ?? '');
  const nav = useNavigate();
  const kit = useMemo(() => {
    const sents = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.split(' ').length > 3);
    const stop = new Set('the a an and or but of to in on for with is are was were be been this that these those it its as at by from we you they he she i our your their can will would should could not have has had do does did so if then than there here also which what when where who how about into more most such very just like'.split(' '));
    const freq = new Map<string, number>();
    sents.forEach((s) => s.toLowerCase().split(/[^a-z-]+/).forEach((w) => { if (w.length > 3 && !stop.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1); }));
    const terms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
    const scored = sents.map((s, i) => ({ s, i, score: s.toLowerCase().split(/[^a-z-]+/).reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(s.split(' ').length) + (/\d/.test(s) ? 2 : 0) + (/\b(is|are|means|refers to|defined as)\b/.test(s) ? 3 : 0) }));
    const notes = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.min(10, Math.ceil(sents.length / 3))).sort((a, b) => a.i - b.i).map((x) => x.s);
    const cards = sents.map((s) => s.match(/^(?:An?|The)?\s*([A-Z]?[\w\s-]{2,40}?)\s+(?:is|are|means|refers to|is defined as)\s+(.{8,})$/i)).filter(Boolean).slice(0, 15).map((m) => ({ q: `What is ${m![1].trim().toLowerCase()}?`, a: m![2].replace(/[.]$/, '') }));
    return { notes, terms, cards, count: sents.length };
  }, [text]);
  const md = `# Study notes\n\n## Key points\n${kit.notes.map((n) => `- ${n}`).join('\n')}\n\n## Key terms\n${kit.terms.join(', ')}\n\n## Flashcards\n${kit.cards.map((c) => `**Q:** ${c.q}\n**A:** ${c.a}\n`).join('\n')}`;
  const [flip, setFlip] = useState<number | null>(null);
  return (
    <div className="grid xl:grid-cols-2 gap-6">
      <div>
        <Field label="Paste a lecture transcript" hint="Automatic transcription from audio needs a speech-to-text provider."><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} placeholder="Photosynthesis is the process plants use to turn light into chemical energy…" /></Field>
        <div className="flex gap-2 mt-3"><Button icon={<Download className="size-4" />} disabled={!kit.count} onClick={() => download(new Blob([md], { type: 'text/markdown' }), 'study-notes.md')}>Download notes (.md)</Button>
          <Button variant="quiet" disabled={!kit.count} onClick={() => nav(`/app/create?flow=textbook&prompt=${encodeURIComponent(kit.terms[0] ?? 'Lecture recap')}`)}>Make a recap video</Button></div>
      </div>
      <div className="space-y-4">
        <Card className="p-5"><div className="font-medium mb-2">Key points ({kit.notes.length})</div><ul className="text-sm text-mute space-y-1.5 list-disc pl-5">{kit.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>{!kit.notes.length && <p className="text-sm text-dim">Paste text to extract notes.</p>}</Card>
        <Card className="p-5"><div className="font-medium mb-2">Key terms</div><div className="flex flex-wrap gap-1.5">{kit.terms.map((t) => <span key={t} className="text-xs rounded-full hairline px-2.5 py-1">{t}</span>)}</div></Card>
        <Card className="p-5"><div className="font-medium mb-3">Flashcards ({kit.cards.length})</div><div className="grid sm:grid-cols-2 gap-2">{kit.cards.map((c, i) => <button key={i} onClick={() => setFlip(flip === i ? null : i)} className={cx('rounded-xl hairline p-4 text-left text-sm min-h-24 transition-colors', flip === i ? 'bg-paper text-ink' : 'hover:bg-white/5')}>{flip === i ? c.a : c.q}</button>)}</div>{!kit.cards.length && <p className="text-sm text-dim">Flashcards come from definition sentences (“X is …”).</p>}</Card>
      </div>
    </div>
  );
}

export function BeatsTool({ memory }: { memory?: boolean }) {
  const { db, workspace, user } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt && a.source !== 'render');
  const [musicId, setMusic] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [beats, setBeats] = useState<number[] | null>(null);
  const [every, setEvery] = useState(memory ? 4 : 2);
  const [aspect, setAspect] = useState<Aspect>(memory ? '16:9' : '9:16');
  const [busy, setBusy] = useState(false);
  const [sens, setSens] = useState(1.35);
  const music = assets.find((a) => a.id === musicId);
  const analyze = async () => {
    if (!music) return;
    setBusy(true);
    try { const b = await getBlob(music.id); if (!b) throw new Error('Music file not found on this device.'); const { env } = await decodeEnvelope(b); const bt = detectBeats(env, 0.05, sens); setBeats(bt); toast(`Found ${bt.length} beats.`, 'ok'); }
    catch (e) { toast((e as Error).message || 'Couldn’t decode this audio file.', 'bad'); } finally { setBusy(false); }
  };
  const build = () => {
    if (!music || !beats?.length || !picked.length) return;
    const cuts = [0, ...beats.filter((_, i) => i % every === every - 1)].filter((t, i, a) => i === 0 || t - a[i - 1] > 0.25);
    const end = music.duration;
    const tracks = defaultTracks();
    const video = tracks[0];
    cuts.forEach((t, i) => {
      const next = cuts[i + 1] ?? Math.min(end, t + 4);
      if (next <= t) return;
      const a = assets.find((x) => x.id === picked[i % picked.length])!;
      video.clips.push(makeClip({ kind: a.type === 'video' ? 'video' : 'image', assetId: a.id, start: +t.toFixed(3), duration: +(next - t).toFixed(3), transition: memory ? 'zoom' : 'none', fadeIn: memory ? 0.6 : 0, transform: { scale: 1.05, x: 0, y: 0 } }));
    });
    const dur = Math.min(end, cuts.at(-1)! + 4);
    tracks[3].clips.push(makeClip({ kind: 'audio', assetId: music.id, start: 0, duration: +dur.toFixed(3), volume: 0.9, fadeOut: 1.5 }));
    const p = createProject(user.id, workspace.id, { title: memory ? 'Memory film' : 'Beat-synced montage', aspect, tracks, template: memory ? 'memory-film' : 'beats', stage: 'editing' });
    audit(user.id, 'beats.build', p.id, `${cuts.length} cuts`);
    nav(`/app/editor/${p.id}`);
  };
  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-5">
        <Dropzone compact label="Add photos, clips or music" />
        <Card className="p-5">
          <div className="font-medium mb-3">1 · Choose music</div>
          <Select value={musicId} onChange={(e) => { setMusic(e.target.value); setBeats(null); }} aria-label="Music"><option value="">Pick an audio file…</option>{assets.filter((a) => a.type === 'audio' || a.type === 'video').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          {music?.peaks && (
            <div className="relative h-20 mt-4 rounded-lg bg-raise overflow-hidden">
              <AssetThumb asset={{ ...music, thumb: undefined }} className="absolute inset-0 w-full h-full" />
              {beats?.map((b, i) => <div key={i} className={cx('absolute top-0 bottom-0 w-px', i % every === every - 1 ? 'bg-amber' : 'bg-white/20')} style={{ left: `${(b / music.duration) * 100}%` }} />)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button icon={<Music className="size-4" />} disabled={!music} loading={busy} onClick={analyze}>Detect beats</Button>
            <label className="text-xs text-mute flex items-center gap-2">Sensitivity<input type="range" min={1.1} max={2} step={0.05} value={sens} onChange={(e) => setSens(Number(e.target.value))} /></label>
            {beats && <span className="text-xs text-dim">{beats.length} beats · ~{music ? Math.round((beats.length / music.duration) * 60) : 0} per min</span>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-medium mb-3">2 · Pick visuals ({picked.length}) — used in order</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{assets.filter((a) => a.type !== 'audio').map((a) => { const i = picked.indexOf(a.id); return <button key={a.id} onClick={() => setPicked(i >= 0 ? picked.filter((x) => x !== a.id) : [...picked, a.id])} className={cx('relative rounded-lg overflow-hidden hairline', i >= 0 && 'ring-2 ring-amber')} aria-pressed={i >= 0}><AssetThumb asset={a} className="w-full aspect-video" />{i >= 0 && <span className="absolute top-1 left-1 size-5 rounded-full bg-amber text-ink text-[10px] font-bold grid place-items-center">{i + 1}</span>}</button>; })}</div>
          {!assets.some((a) => a.type !== 'audio') && <p className="text-sm text-dim">Upload photos or clips above.</p>}
        </Card>
      </div>
      <Card className="p-5 h-fit space-y-4">
        <div className="font-medium">3 · Build</div>
        <Field label="Cut every"><Select value={every} onChange={(e) => setEvery(Number(e.target.value))}><option value={1}>Beat (energetic)</option><option value={2}>2 beats</option><option value={4}>Bar — 4 beats (gentle)</option><option value={8}>2 bars (slow)</option></Select></Field>
        <Field label="Format"><Select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)}><option value="9:16">Vertical 9:16</option><option value="16:9">Landscape 16:9</option><option value="1:1">Square 1:1</option></Select></Field>
        <Button variant="primary" className="w-full" icon={<Wand2 className="size-4" />} disabled={!beats?.length || !picked.length} onClick={build}>Build montage & open editor</Button>
        <p className="text-[11px] text-dim">Beat detection runs on your device using audio energy onsets. Free.</p>
      </Card>
    </div>
  );
}

export function HighlightsTool({ mode }: { mode: 'gaming' | 'stream' | 'podcast' }) {
  const { db, workspace, user } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt && a.source !== 'render' && (mode === 'podcast' ? a.type !== 'image' : a.type === 'video'));
  const [srcId, setSrc] = useState('');
  const [hl, setHl] = useState<{ time: number; score: number }[] | null>(null);
  const [len, setLen] = useState(mode === 'podcast' ? 30 : 15);
  const [count, setCount] = useState(5);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const vref = useRef<HTMLVideoElement>(null);
  const src = assets.find((a) => a.id === srcId);
  useEffect(() => { if (src) blobUrl(src.id).then(setUrl); }, [src]);
  const analyze = async () => {
    if (!src) return;
    setBusy(true);
    try { const b = await getBlob(src.id); if (!b) throw new Error('File not found.'); const { env } = await decodeEnvelope(b); const h = findHighlights(env, 0.05, count, Math.min(4, len / 3), Math.max(len, 8)); setHl(h); setSel(new Set(h.map((_, i) => i))); }
    catch (e) { toast((e as Error).message || 'Couldn’t read the audio in this file.', 'bad'); } finally { setBusy(false); }
  };
  const build = () => {
    if (!src || !hl) return;
    const tracks = defaultTracks();
    const picks = hl.filter((_, i) => sel.has(i));
    let t = 0;
    picks.forEach((h, i) => {
      const start = Math.max(0, h.time - len * 0.35);
      const d = Math.min(len, (src.duration || start + len) - start);
      if (mode === 'podcast') {
        tracks[4].clips.push(makeClip({ kind: 'audio', assetId: src.id, start: t, duration: d, offset: start, fadeIn: 0.3, fadeOut: 0.5 }));
        if (src.type === 'video') tracks[0].clips.push(makeClip({ kind: 'video', assetId: src.id, start: t, duration: d, offset: start, volume: 0 }));
        else tracks[0].clips.push(makeClip({ kind: 'color', color: '#14121c', start: t, duration: d }));
        tracks[1].clips.push(makeClip({ kind: 'wave', assetId: src.id, start: t, duration: d, offset: start, color: '#e9b56a', style: { ...CAPTION_STYLE, y: 0.6 } }));
        tracks[1].clips.push(makeClip({ kind: 'text', start: t, duration: d, text: `Clip ${i + 1}`, style: { ...TITLE_STYLE, size: 6, y: 0.22 } }));
      } else {
        tracks[0].clips.push(makeClip({ kind: 'video', assetId: src.id, start: t, duration: d, offset: start, transform: { scale: 1, x: 0, y: 0 }, transition: i ? 'fade' : 'none', fadeIn: i ? 0.25 : 0 }));
        if (mode === 'stream') tracks[2].clips.push(makeClip({ kind: 'caption', start: t, duration: Math.min(3, d), text: 'Add your caption here', style: { ...CAPTION_STYLE, y: 0.7 } }));
      }
      t += d;
    });
    const p = createProject(user.id, workspace.id, { title: `${src.name.replace(/\.[^.]+$/, '')} — ${mode === 'podcast' ? 'audiogram clips' : 'highlights'}`, aspect: mode === 'stream' ? '9:16' : mode === 'podcast' ? '1:1' : '16:9', tracks, template: mode, stage: 'editing' });
    nav(`/app/editor/${p.id}`);
  };
  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-5">
        <Dropzone compact label={mode === 'podcast' ? 'Upload an episode (audio or video)' : 'Upload gameplay or a stream recording'} />
        <Card className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="Source"><Select value={srcId} onChange={(e) => { setSrc(e.target.value); setHl(null); }}><option value="">Pick a file…</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.name} · {tc(a.duration)}</option>)}</Select></Field>
            <Field label="Clip length (s)"><Input type="number" min={5} max={90} value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-24" /></Field>
            <Field label="How many"><Input type="number" min={1} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20" /></Field>
            <Button icon={<Sparkles className="size-4" />} disabled={!src} loading={busy} onClick={analyze}>Find moments</Button>
          </div>
          {busy && <Progress value={0.5} className="mt-4" />}
        </Card>
        {url && src?.type === 'video' && <video ref={vref} src={url} controls className="w-full rounded-xl bg-black max-h-80" />}
        {url && src?.type === 'audio' && <audio src={url} controls className="w-full" ref={vref as never} />}
        {hl && (
          <Card className="p-5">
            <div className="font-medium mb-3">{hl.length} loudest moments</div>
            <ul className="space-y-1.5">{hl.map((h, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl hairline px-3 py-2 text-sm">
                <input type="checkbox" checked={sel.has(i)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(i); else s.delete(i); setSel(s); }} aria-label={`Include moment at ${tc(h.time)}`} />
                <button onClick={() => { if (vref.current) { vref.current.currentTime = Math.max(0, h.time - 2); vref.current.play(); } }} className="font-mono text-azure flex items-center gap-1"><Play className="size-3" />{tc(h.time)}</button>
                <div className="flex-1 h-1.5 rounded bg-white/5 overflow-hidden"><div className="h-full bg-amber" style={{ width: `${h.score}%` }} /></div><span className="text-xs text-dim w-10 text-right">{h.score}</span>
              </li>
            ))}</ul>
          </Card>
        )}
      </div>
      <Card className="p-5 h-fit space-y-3">
        <div className="font-medium">{mode === 'gaming' ? 'Highlight reel' : mode === 'stream' ? 'Vertical shorts' : 'Audiogram clips'}</div>
        <p className="text-sm text-mute">{mode === 'gaming' ? 'Spikes in game audio — shouts, explosions, crowd reactions — usually mark the best moments.' : mode === 'stream' ? 'Clips are reframed to 9:16 (center crop; adjust Pan X in the editor) with caption slots.' : 'Square clips with an animated waveform and title — ready for social.'}</p>
        <Button variant="primary" className="w-full" disabled={!hl || !sel.size} onClick={build}>Create project from {sel.size} moment{sel.size === 1 ? '' : 's'}</Button>
        <p className="text-[11px] text-dim">Detection uses audio energy, on your device. Transcripts, summaries and speaker labels need speech-to-text: <StatusPill status="not_configured" /></p>
      </Card>
    </div>
  );
}

export function TemplateLauncher({ id, prompt }: { id: string; prompt?: string }) {
  const t = templateFor(id);
  const nav = useNavigate();
  return (
    <Card className="p-6 md:p-8 max-w-3xl">
      <div className="font-display text-3xl">{t.name} workflow</div>
      <p className="text-mute mt-2">{t.fields.length} short questions → an editable scene list → add your media → assemble on a real timeline. Default format {t.aspect}.</p>
      <ul className="mt-5 space-y-1.5 text-sm">{t.fields.map((f) => <li key={f.key} className="flex gap-2"><span className="text-amber">→</span>{f.label}</li>)}</ul>
      <p className="text-xs text-dim mt-4">{t.mediaHint}</p>
      <Button variant="primary" size="lg" className="mt-6" icon={<Sparkles className="size-5" />} onClick={() => nav(`/app/create?flow=${id}${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`)}>Start</Button>
      {id === 'longform' && <p className="text-sm text-mute mt-6">After assembling, use <Link className="text-amber hover:underline" to="/app/tool/publish">Publishing Pack</Link> for chapters, and <Link className="text-amber hover:underline" to="/app/tool/retention">Retention Doctor</Link> for pacing.</p>}
    </Card>
  );
}

export { saveProject as _sp };
export type { Clip };

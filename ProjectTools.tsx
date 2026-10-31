import { Copy, Download, RotateCcw, Sparkles, Wand2, Lock, ExternalLink, Image as ImageIcon, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, Select, StatusPill, Tabs, Textarea, cx, download, useConfirm, useToast } from '../../components/ui';
import { AssetThumb, FindingList } from '../../components/shared';
import { useApp } from '../../lib/useApp';
import { accessibilityInspector, brandCheck, continuityCheck, diffVersions, extractClaims, matchBroll, PLATFORM_ZONES, qualityGate, retentionDoctor, safeZoneCheck, scoreHook, simulateStructure, STRUCTURES, type Finding } from '../../lib/analyzers';
import { applyFix, parseRevision, removeMissing, REVISION_EXAMPLES, type Revision } from '../../lib/edits';
import { captionsFromText, createProject, dims, makeClip, projectDuration, snapshot, toSRT, toVTT, defaultTracks, saveProject } from '../../lib/project';
import { renderCost } from '../../lib/plans';
import { tc, uid, ago, bytes } from '../../lib/id';
import { commitProject, PendingPanel } from './common';
import { useIntegrations, searchStock } from '../../lib/integrations';
import { ingestFile } from '../../lib/media';
import { enqueue, waitFor, InsufficientCredits } from '../../lib/jobs';
import { audit, update } from '../../lib/db';
import { blobUrl, getBlob, putBlob } from '../../lib/idb';
import type { Asset, Clip, Project, Scene } from '../../lib/types';

type P = { project: Project };

function useFixer(project: Project) {
  const toast = useToast();
  return (next: Project, label: string) => {
    const undo = commitProject(project, next, label);
    toast(`${label} — done.`, 'ok', { label: 'Undo', run: undo });
  };
}

function Analyzer({ project, run, title }: P & { run: (p: Project) => Finding[]; title: string }) {
  const fix = useFixer(project);
  const { db } = useApp();
  const findings = run(project);
  const score = Math.max(0, 100 - findings.reduce((a, f) => a + (f.severity === 'bad' ? 20 : f.severity === 'warn' ? 8 : 0), 0));
  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-6">
      <FindingList findings={findings} onFix={(f) => f.fixId && fix(f.fixId === 'remove-missing' ? removeMissing(project, new Set(db.assets.filter((a) => !a.deletedAt).map((a) => a.id))) : applyFix(project, f.fixId), f.fix ?? f.title)} />
      <Card className="p-5 h-fit lg:sticky lg:top-24">
        <div className="text-xs text-dim">{title}</div>
        <div className="font-display text-6xl mt-2">{score}</div>
        <div className="text-xs text-mute mt-1">Checklist score from {findings.length} checks</div>
        <div className="mt-4 space-y-1 text-xs">{(['bad', 'warn', 'info', 'ok'] as const).map((s) => <div key={s} className="flex justify-between"><span className="text-mute capitalize">{s === 'bad' ? 'Problems' : s === 'warn' ? 'Warnings' : s === 'info' ? 'Notes' : 'Passing'}</span><span className="tabular">{findings.filter((f) => f.severity === s).length}</span></div>)}</div>
        <Link to={`/app/editor/${project.id}`}><Button size="sm" className="w-full mt-5">Open in editor</Button></Link>
        <p className="text-[11px] text-dim mt-3">Every fix saves a snapshot first and can be undone.</p>
      </Card>
    </div>
  );
}

export function RetentionTool({ project }: P) { return <Analyzer project={project} run={retentionDoctor} title="Retention readiness" />; }
export function A11yTool({ project }: P) { return <Analyzer project={project} run={accessibilityInspector} title="Accessibility" />; }
export function QualityTool({ project }: P) {
  const { db, plan } = useApp();
  const [res, setRes] = useState(720);
  const assets = db.assets.filter((a) => a.workspaceId === project.workspaceId);
  return (<>
    <div className="flex items-center gap-2 mb-5 text-sm"><span className="text-mute">Check for</span><Select value={res} onChange={(e) => setRes(Number(e.target.value))} className="w-36">{[480, 720, 1080].map((r) => <option key={r} value={r}>{r}p</option>)}</Select><span className="text-dim text-xs">Your plan allows up to {plan.maxRes}p.</span></div>
    <Analyzer project={project} run={(p) => qualityGate(p, assets, { res, maxRes: plan.maxRes })} title="Export readiness" />
  </>);
}

export function SafeZoneTool({ project }: P) {
  const [platform, setPlatform] = useState<keyof typeof PLATFORM_ZONES>(project.aspect === '9:16' ? 'shorts' : project.aspect === '1:1' ? 'feed' : 'youtube');
  const fix = useFixer(project);
  const z = PLATFORM_ZONES[platform];
  const findings = safeZoneCheck(project, platform);
  const texts = project.tracks.flatMap((t) => t.clips).filter((c) => c.style && (c.kind === 'text' || c.kind === 'caption'));
  const { w, h } = dims(project.aspect, 200);
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <Tabs className="mb-5" value={platform} onChange={setPlatform} tabs={Object.entries(PLATFORM_ZONES).map(([k, v]) => ({ id: k as keyof typeof PLATFORM_ZONES, label: v.label }))} />
        <FindingList findings={findings} onFix={(f) => f.fixId && fix(applyFix(project, f.fixId), f.fix ?? 'Moved into safe zone')} />
      </div>
      <Card className="p-5 h-fit">
        <div className="text-xs text-dim mb-3">Layout map · {project.aspect} vs {z.label}</div>
        <div className="relative mx-auto bg-raise rounded-lg overflow-hidden" style={{ width: w, height: h }}>
          <div className="absolute inset-x-0 top-0 bg-bad/30" style={{ height: `${z.top * 100}%` }} />
          <div className="absolute inset-x-0 bottom-0 bg-bad/30" style={{ height: `${z.bottom * 100}%` }} />
          <div className="absolute right-0 bg-bad/20" style={{ top: `${z.top * 100}%`, bottom: `${z.bottom * 100}%`, width: `${z.right * 100}%` }} />
          {texts.map((c) => <div key={c.id} className={cx('absolute -translate-x-1/2 -translate-y-1/2 rounded-sm text-[8px] px-1 truncate max-w-[80%]', c.kind === 'caption' ? 'bg-paper/80 text-ink' : 'bg-violet/80')} style={{ left: `${c.style!.x * 100}%`, top: `${c.style!.y * 100}%` }}>{c.text}</div>)}
        </div>
        <p className="text-[11px] text-dim mt-3">Red areas are covered by the platform’s buttons, titles and progress bar.</p>
      </Card>
    </div>
  );
}

export function ContinuityTool({ project }: P) {
  const [scenes, setScenes] = useState<Scene[]>(project.scenes);
  useEffect(() => setScenes(project.scenes), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const findings = continuityCheck(scenes);
  const upd = (id: string, p: Partial<Scene>) => { const n = scenes.map((s) => (s.id === id ? { ...s, ...p } : s)); setScenes(n); saveProject(project.id, { scenes: n }); };
  return (
    <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6">
      <div className="space-y-2">
        <div className="text-sm text-mute mb-2">Scene sheet — write characters as “Name (outfit)”, separated by commas. Changes save automatically.</div>
        {scenes.map((s, i) => (
          <div key={s.id} className="rounded-2xl hairline p-3 grid md:grid-cols-[28px_1fr_1.4fr_1fr_110px] gap-2 items-center">
            <span className="font-mono text-xs text-dim">{i + 1}</span>
            <span className="text-sm truncate">{s.title}</span>
            <Input aria-label={`Characters in scene ${i + 1}`} value={s.characters} onChange={(e) => upd(s.id, { characters: e.target.value })} placeholder="Maya (red coat)" className="py-1.5 text-xs" />
            <Input aria-label={`Location of scene ${i + 1}`} value={s.location} onChange={(e) => upd(s.id, { location: e.target.value })} placeholder="Location" className="py-1.5 text-xs" />
            <Select aria-label={`Time of day in scene ${i + 1}`} value={s.timeOfDay} onChange={(e) => upd(s.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })} className="py-1.5 text-xs"><option value="">Time…</option><option value="dawn">Dawn</option><option value="day">Day</option><option value="dusk">Dusk</option><option value="night">Night</option></Select>
          </div>
        ))}
        {!scenes.length && <p className="text-sm text-dim">This project has no scenes. Projects made with Create have a scene list.</p>}
      </div>
      <FindingList findings={findings} />
    </div>
  );
}

export function BrollTool({ project }: P) {
  const { db, user } = useApp();
  const { isReady } = useIntegrations();
  const fix = useFixer(project);
  const toast = useToast();
  const [stockQ, setStockQ] = useState('');
  const [stockRes, setStockRes] = useState<{ id: number; thumb: string; full: string; photographer: string; url: string }[]>([]);
  const [stockBusy, setStockBusy] = useState(false);
  const assets = db.assets.filter((a) => a.workspaceId === project.workspaceId && !a.deletedAt && a.source !== 'render');
  const runStockSearch = async (q: string) => {
    if (!q.trim()) return;
    setStockBusy(true);
    try {
      const r = await searchStock(q.trim());
      setStockRes(r);
    } catch (e) {
      toast((e as Error).message, 'warn');
    } finally {
      setStockBusy(false);
    }
  };
  const importStock = async (item: { id: number; thumb: string; full: string; photographer: string; url: string }, scene?: Scene) => {
    try {
      const resp = await fetch(item.full);
      const blob = await resp.blob();
      const file = new File([blob], `stock-${item.id}.jpg`, { type: blob.type || 'image/jpeg' });
      const res = await ingestFile(file, { userId: user.id, workspaceId: project.workspaceId, source: 'stock', license: 'Pexels License', attribution: `Photo by ${item.photographer} (${item.url})`, tags: stockQ.toLowerCase().split(/\s+/).filter(Boolean) });
      const a = res.asset ?? res.duplicateOf;
      if (a && scene) place(scene, a);
      else if (a) toast(`Added stock photo by ${item.photographer} to media library.`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  };
  const matches = useMemo(() => matchBroll(project.scenes, assets), [project.scenes, assets]);
  const place = (scene: Scene, a: Asset) => {
    const n = structuredClone(project);
    const idx = n.scenes.findIndex((s) => s.id === scene.id);
    n.scenes[idx].assetId = a.id;
    const start = n.scenes.slice(0, idx).reduce((x, s) => x + Math.max(1.5, s.duration), 0);
    const video = n.tracks.find((t) => t.kind === 'video')!;
    video.clips = video.clips.filter((c) => !(Math.abs(c.start - start) < 0.05));
    video.clips.push(makeClip({ kind: a.type === 'video' ? 'video' : 'image', assetId: a.id, start, duration: Math.max(1.5, a.type === 'video' && a.duration ? Math.min(scene.duration, a.duration) : scene.duration), transition: 'fade', fadeIn: 0.4 }));
    const ov = n.tracks.find((t) => t.kind === 'overlay');
    if (ov) ov.clips = ov.clips.filter((c) => !(c.kind === 'text' && Math.abs(c.start - start) < 0.05 && c.text === scene.title));
    fix(n, `Placed “${a.name}” on scene ${idx + 1}`);
  };
  if (!project.scenes.length) return <p className="text-sm text-mute">This project has no scene list to match against. Create projects through the guided creator to use Auto B-Roll.</p>;
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Search Stock B-Roll (/api/stock)</div>
          {!isReady('stock') && <StatusPill status="not_configured" />}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runStockSearch(stockQ); }}>
          <Input value={stockQ} onChange={(e) => setStockQ(e.target.value)} placeholder="Search Pexels / stock library (e.g. forest sunrise, night city, studio)..." />
          <Button type="submit" loading={stockBusy}>Search stock</Button>
        </form>
        {stockRes.length > 0 && (
          <div className="flex gap-3 overflow-x-auto scroll-thin pb-1">
            {stockRes.map((item) => (
              <div key={item.id} className="shrink-0 w-44 rounded-xl hairline overflow-hidden bg-panel">
                <img src={item.thumb} alt={item.photographer} className="w-full aspect-video object-cover" />
                <div className="p-2 text-[11px]">
                  <div className="truncate text-mute">{item.photographer}</div>
                  <button type="button" onClick={() => importStock(item, project.scenes[0])} className="text-amber hover:underline mt-1">Import & place on Scene 1</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {matches.map(({ scene, matches: ms, keywords }, i) => (
        <Card key={scene.id} className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><div className="font-medium">{i + 1}. {scene.title}</div><div className="text-xs text-dim">keywords: {keywords.join(', ') || '—'}</div></div>
          <div className="flex gap-3 mt-3 overflow-x-auto scroll-thin pb-1">
            {ms.map((m) => (
              <button key={m.asset.id} onClick={() => place(scene, m.asset)} className={cx('shrink-0 w-40 text-left rounded-xl hairline overflow-hidden hover:border-amber/60', scene.assetId === m.asset.id && 'ring-2 ring-amber')}>
                <AssetThumb asset={m.asset} className="w-full aspect-video" />
                <div className="p-2 text-[11px]"><div className="truncate">{m.asset.name}</div><div className="text-dim">matches: {m.hits.join(', ')}</div></div>
              </button>
            ))}
            {!ms.length && <p className="text-sm text-dim py-4">No matching media. Add tags in Projects & Assets → Media, or upload footage with descriptive names.</p>}
          </div>
        </Card>
      ))}
      <Button variant="quiet" onClick={() => toast('Tip: rename files descriptively (e.g. “city-night-rain.mp4”) — names become tags automatically.', 'info')}>How matching works</Button>
    </div>
  );
}

export function SoundTool({ project }: P) {
  const fix = useFixer(project);
  const [duck, setDuck] = useState(0.3);
  const audioTracks = project.tracks.filter((t) => t.kind === 'audio' || t.kind === 'video');
  const setVol = (clipId: string, v: number) => { const n = structuredClone(project); n.tracks.forEach((t) => t.clips.forEach((c) => { if (c.id === clipId) c.volume = v; })); saveProject(project.id, { tracks: n.tracks }); };
  const autoDuck = () => {
    const n = structuredClone(project);
    const music = n.tracks.filter((t) => t.kind === 'audio' && /music/i.test(t.name));
    const voiceIv = n.tracks.filter((t) => (t.kind === 'audio' && !/music/i.test(t.name)) || t.kind === 'video').flatMap((t) => t.clips.filter((c) => (c.kind === 'audio' || c.kind === 'video') && c.volume > 0).map((c) => [c.start, c.start + c.duration] as [number, number]));
    if (!music.length || !voiceIv.length) return;
    for (const mt of music) {
      const out: Clip[] = [];
      for (const c of mt.clips) {
        const cuts = new Set<number>([c.start, c.start + c.duration]);
        voiceIv.forEach(([a, b]) => { if (a > c.start && a < c.start + c.duration) cuts.add(a); if (b > c.start && b < c.start + c.duration) cuts.add(b); });
        const pts = [...cuts].sort((x, y) => x - y);
        for (let i = 0; i < pts.length - 1; i++) {
          const s = pts[i], e = pts[i + 1];
          if (e - s < 0.05) continue;
          const mid = (s + e) / 2;
          const voiced = voiceIv.some(([a, b]) => mid > a && mid < b);
          out.push({ ...c, id: i === 0 ? c.id : uid('c_'), start: +s.toFixed(3), duration: +(e - s).toFixed(3), offset: +(c.offset + (s - c.start)).toFixed(3), volume: voiced ? +(Math.min(c.volume, 1) * duck).toFixed(2) : c.volume, fadeIn: i === 0 ? c.fadeIn : 0.25, fadeOut: i === pts.length - 2 ? c.fadeOut : 0.25 });
        }
      }
      mt.clips = out;
    }
    fix(n, 'Auto-ducked music under speech');
  };
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4">
        {audioTracks.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="text-sm font-medium mb-3">{t.name}</div>
            {t.clips.filter((c) => c.kind === 'audio' || c.kind === 'video').map((c) => (
              <label key={c.id} className="grid grid-cols-[1fr_160px_48px] gap-3 items-center text-xs py-1">
                <span className="truncate text-mute">{tc(c.start)} · {c.kind} {c.duration.toFixed(1)}s</span>
                <input type="range" min={0} max={1.5} step={0.01} defaultValue={c.volume} onChange={(e) => setVol(c.id, Number(e.target.value))} aria-label="Volume" />
                <span className="tabular text-right">{Math.round(c.volume * 100)}%</span>
              </label>
            ))}
            {!t.clips.some((c) => c.kind === 'audio' || c.kind === 'video') && <p className="text-xs text-dim">No audio clips.</p>}
          </Card>
        ))}
      </div>
      <Card className="p-5 h-fit space-y-4">
        <div className="font-medium">Auto-duck</div>
        <p className="text-xs text-mute">Lowers clips on any track named “Music” wherever voice or video audio plays, with short fades.</p>
        <label className="block text-xs"><span className="text-mute">Music level under speech: {Math.round(duck * 100)}%</span><input type="range" min={0.05} max={0.8} step={0.05} value={duck} onChange={(e) => setDuck(Number(e.target.value))} className="w-full mt-1" /></label>
        <Button className="w-full" icon={<Wand2 className="size-4" />} onClick={autoDuck}>Apply ducking</Button>
        <p className="text-[11px] text-dim">Music & SFX libraries: <StatusPill status="not_configured" /></p>
      </Card>
    </div>
  );
}

export function RevisionTool({ project }: P) {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<Revision[] | null>(null);
  const [miss, setMiss] = useState(false);
  const fix = useFixer(project);
  const { user } = useApp();
  const preview = useMemo(() => {
    if (!plan) return null;
    let n = project; for (const r of plan) n = r.apply(n);
    return diffVersions(project, n);
  }, [plan, project]);
  return (
    <div className="max-w-3xl">
      <form onSubmit={(e) => { e.preventDefault(); const p = parseRevision(text, project); setPlan(p); setMiss(!p); }} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the change in plain words" className="h-12 text-base" aria-label="Revision request" />
        <Button variant="primary" size="lg" type="submit" icon={<Wand2 className="size-4" />}>Preview</Button>
      </form>
      <div className="flex flex-wrap gap-2 mt-3">{REVISION_EXAMPLES.map((x) => <button key={x} onClick={() => setText(x)} className="text-xs rounded-full hairline px-3 py-1 text-mute hover:text-paper">{x}</button>)}</div>
      {miss && <p className="text-sm text-warn mt-4">I don’t understand that request yet. Try one of the examples above. Open-ended edits need the text provider.</p>}
      {plan && preview && (
        <Card className="p-5 mt-6">
          <div className="font-medium mb-3">Planned edits</div>
          <ul className="space-y-1.5 text-sm">{plan.map((r, i) => <li key={i} className="flex gap-2"><Sparkles className="size-4 text-violet mt-0.5" />{r.summary}</li>)}</ul>
          <div className="mt-4 text-xs text-mute space-y-0.5 max-h-48 overflow-auto scroll-thin font-mono">{[...preview.timing, ...preview.captions, ...preview.audio].slice(0, 40).map((l, i) => <div key={i}>{l}</div>)}{preview.timing.length + preview.captions.length + preview.audio.length === 0 && <div>Style/format changes only.</div>}</div>
          <div className="flex gap-2 mt-5"><Button variant="primary" onClick={() => { let n = project; for (const r of plan) n = r.apply(n); fix(n, plan.map((r) => r.summary).join(' + ')); update((d) => { d.prefs.unshift({ id: uid('pf_'), userId: user.id, key: 'revision', value: plan.map((r) => r.summary).join(' + '), at: Date.now() }); }); setPlan(null); setText(''); }}>Apply</Button><Button variant="quiet" onClick={() => setPlan(null)}>Cancel</Button></div>
        </Card>
      )}
    </div>
  );
}

export function CostTool({ project }: P) {
  const { db, balance, plan } = useApp();
  const d = projectDuration(project);
  const c = db.config.costs;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <div className="font-medium mb-4">Export options for “{project.title}” ({tc(d)})</div>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-dim"><th className="pb-2">Option</th><th>Frame</th><th>Time</th><th className="text-right">Credits</th></tr></thead>
          <tbody>{[480, 720, 1080].map((r) => { const cost = renderCost(d, r === 480, db.config); const dd = dims(project.aspect, r); return <tr key={r} className={cx('border-t border-line', r > plan.maxRes && 'opacity-40')}><td className="py-2.5">{r === 480 ? 'Draft' : r === 720 ? 'HD' : 'Full HD'}{r > plan.maxRes ? ' (plan)' : ''}</td><td className="font-mono text-xs">{dd.w}×{dd.h}</td><td className="font-mono text-xs">≈{tc(d + 2)}</td><td className="text-right tabular">{cost || 'Free'}</td></tr>; })}</tbody></table>
        <p className="text-xs text-dim mt-4">Browser renders run in real time. Draft exports are free so you can check pacing before spending credits.</p>
      </Card>
      <Card className="p-5">
        <div className="font-medium mb-4">Ways to save</div>
        <ul className="space-y-3 text-sm">
          <li>• Review with a <b>free 480p draft</b> first; export final once.</li>
          <li>• Trimming {d > 15 ? `${(d % 15).toFixed(1)}s` : 'a few seconds'} could {d % 15 > 0 && d > 15 ? 'drop a 15-second billing block' : 'keep you within the current block'} (billed per 15s).</li>
          <li>• AI script ({c.aiScript}), hooks ({c.aiHooks}), titles ({c.aiTitles}) and fact-check ({c.aiFactcheck}) only charge when you run them.</li>
          <li>• Failed or canceled jobs are refunded automatically.</li>
        </ul>
        <div className="mt-5 text-sm">Balance: <span className="tabular font-medium">{balance}</span> credits</div>
      </Card>
    </div>
  );
}

export function FactCheckTool({ project }: P) {
  const { isReady } = useIntegrations();
  const { db, user } = useApp();
  const toast = useToast();
  const text = [project.script, ...project.scenes.map((s) => s.narration), ...project.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips.map((c) => c.text ?? ''))].join(' ');
  const claims = useMemo(() => [...new Map(extractClaims(text).map((c) => [c.text, c])).values()], [text]);
  const [results, setResults] = useState<{ claim: string; status: string; confidence: number; explanation: string; sources: string[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try {
      const id = enqueue(user.id, 'ai_factcheck', `Fact-check · ${project.title}`, { claims: claims.slice(0, 15).map((c) => c.text) }, { projectId: project.id, credits: db.config.costs.aiFactcheck });
      const j = await waitFor(id);
      if (j.status !== 'succeeded') toast(j.error ?? 'Failed — credits refunded.', 'bad');
      else setResults(((j.result?.data as { results?: typeof results })?.results) ?? []);
    } catch (e) { toast(e instanceof InsufficientCredits ? e.message : (e as Error).message, 'warn'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><div className="font-medium">{claims.length} checkable claim{claims.length === 1 ? '' : 's'} found</div>
          <Button variant="primary" icon={isReady('text') ? <Sparkles className="size-4" /> : <Lock className="size-4" />} disabled={!isReady('text') || !claims.length} loading={busy} onClick={verify}>Verify with sources · {db.config.costs.aiFactcheck} credits</Button></div>
        <ul className="space-y-2">{claims.map((c) => <li key={c.text} className="rounded-xl hairline p-3 text-sm"><div>{c.text}</div><div className="flex gap-1 mt-1.5">{c.signals.map((s) => <span key={s} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-mute">{s}</span>)}</div></li>)}</ul>
        {!claims.length && <p className="text-sm text-dim">No numbers, dates, absolutes or attributed statements found in the script, narration or captions.</p>}
        {!isReady('text') && <p className="text-xs text-dim mt-4">Claim detection runs locally. Verification needs a text provider: <StatusPill status="not_configured" /></p>}
      </Card>
      {results && (
        <div className="space-y-2">{results.map((r, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2"><span className={cx('text-xs rounded px-2 py-0.5', r.status === 'supported' ? 'bg-ok/15 text-ok' : r.status === 'disputed' ? 'bg-bad/15 text-bad' : 'bg-white/5 text-mute')}>{r.status}</span><span className="text-xs text-dim">confidence {Math.round((r.confidence ?? 0) * 100)}%</span></div>
            <div className="text-sm mt-2">{r.claim}</div><p className="text-sm text-mute mt-1">{r.explanation}</p>
            <div className="flex flex-col gap-1 mt-2">{r.sources?.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer noopener" className="text-xs text-azure hover:underline inline-flex items-center gap-1"><ExternalLink className="size-3" />{s}</a>)}</div>
            <p className="text-[11px] text-dim mt-2">AI-assisted. Always open the sources before publishing.</p>
          </Card>
        ))}</div>
      )}
    </div>
  );
}

export function LicenseTool({ project }: P) {
  const { db, user } = useApp();
  const used = [...new Set(project.tracks.flatMap((t) => t.clips.map((c) => c.assetId)).filter(Boolean) as string[])].map((id) => db.assets.find((a) => a.id === id)).filter((a): a is Asset => !!a);
  const missing = used.filter((a) => !a.license.trim());
  const set = (id: string, p: Partial<Asset>) => update((d) => { const a = d.assets.find((x) => x.id === id); if (a) Object.assign(a, p); });
  const sheet = () => `ATTRIBUTION & LICENSES — ${project.title}\nGenerated ${new Date().toLocaleString()}\n\n` + used.map((a) => `• ${a.name}\n  Source: ${a.source}${a.demo ? ' (demo)' : ''}\n  License: ${a.license || 'NOT RECORDED'}\n  Attribution: ${a.attribution || '—'}\n  Fingerprint: ${a.hash.slice(0, 16)}`).join('\n\n');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className={cx('text-sm', missing.length ? 'text-warn' : 'text-ok')}>{missing.length ? `${missing.length} of ${used.length} assets have no license recorded` : `All ${used.length} assets have a license recorded`}</span>
        <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => { download(new Blob([sheet()], { type: 'text/plain' }), `${project.title} — attribution.txt`); audit(user.id, 'license.export', project.id); }}>Download attribution sheet</Button>
      </div>
      <div className="space-y-2">{used.map((a) => (
        <div key={a.id} className="rounded-2xl hairline p-3 grid md:grid-cols-[96px_1fr_1fr_1fr] gap-3 items-center">
          <AssetThumb asset={a} className="w-24 aspect-video rounded-lg" />
          <div className="min-w-0"><div className="text-sm truncate">{a.name}</div><div className="text-[11px] text-dim">{a.source}{a.demo ? ' · demo' : ''}</div></div>
          <Input aria-label={`License for ${a.name}`} defaultValue={a.license} onBlur={(e) => set(a.id, { license: e.target.value.trim() })} placeholder="License (required)" className={cx('py-1.5 text-xs', !a.license && 'border-warn/50')} />
          <Input aria-label={`Attribution for ${a.name}`} defaultValue={a.attribution} onBlur={(e) => set(a.id, { attribution: e.target.value.trim() })} placeholder="Attribution" className="py-1.5 text-xs" />
        </div>
      ))}</div>
      {!used.length && <p className="text-sm text-dim">This project uses no media files yet.</p>}
    </div>
  );
}

export function RepurposeTool({ project }: P) {
  const { user } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const d = projectDuration(project);
  const segs = useMemo(() => { let t = 0; return project.scenes.map((s) => { const seg = { label: s.title, start: t, end: t + Math.max(1.5, s.duration) }; t = seg.end; return seg; }); }, [project.scenes]);
  const [a, setA] = useState(0);
  const [b, setB] = useState(Math.min(d, 30));
  const [aspect, setAspect] = useState<'9:16' | '1:1' | '4:5'>('9:16');
  const make = (start: number, end: number, label: string) => {
    if (end - start < 1) { toast('Pick a range of at least 1 second.', 'warn'); return; }
    const tracks = defaultTracks().map((t) => ({ ...t, clips: [] as Clip[] }));
    project.tracks.forEach((src, i) => {
      const dst = tracks.find((t) => t.kind === src.kind && !t.clips.length) ?? tracks[i] ?? tracks[0];
      src.clips.filter((c) => c.start < end && c.start + c.duration > start).forEach((c) => {
        const s = Math.max(c.start, start), e = Math.min(c.start + c.duration, end);
        const n: Clip = { ...structuredClone(c), id: uid('c_'), start: +(s - start).toFixed(3), duration: +(e - s).toFixed(3), offset: c.kind === 'video' || c.kind === 'audio' ? +(c.offset + (s - c.start)).toFixed(3) : c.offset };
        if (n.style && n.kind === 'caption') n.style = { ...n.style, y: 0.7, size: n.style.size * 1.15 };
        if (n.kind === 'video' || n.kind === 'image') n.transform = { ...n.transform, scale: Math.max(1, n.transform.scale) };
        dst.clips.push(n);
      });
    });
    const p = createProject(user.id, project.workspaceId, { title: `${project.title} — ${label}`, aspect, tracks, template: 'repurpose', stage: 'editing', demo: project.demo });
    toast('Vertical cut created.', 'ok', { label: 'Open', run: () => nav(`/app/editor/${p.id}`) });
  };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <div className="font-medium mb-3">Custom range</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start (s)"><Input type="number" min={0} max={d} step={0.5} value={a} onChange={(e) => setA(Number(e.target.value))} /></Field>
          <Field label="End (s)"><Input type="number" min={0} max={d} step={0.5} value={b} onChange={(e) => setB(Number(e.target.value))} /></Field>
          <Field label="Format"><Select value={aspect} onChange={(e) => setAspect(e.target.value as never)}><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:5">4:5</option></Select></Field>
        </div>
        <Button className="mt-4" variant="primary" onClick={() => make(a, Math.min(b, d), `${tc(a)}–${tc(b)}`)}>Create {aspect} cut</Button>
        <p className="text-xs text-dim mt-3">Clips are reframed to fill the new frame (center crop — adjust Pan X in the editor). Captions move up for vertical safe zones.</p>
      </Card>
      <Card className="p-5">
        <div className="font-medium mb-3">From scenes</div>
        <ul className="space-y-1.5">{segs.map((s, i) => <li key={i} className="flex items-center justify-between gap-3 text-sm rounded-xl hairline px-3 py-2"><span className="truncate">{s.label}</span><span className="font-mono text-xs text-dim">{tc(s.start)}–{tc(s.end)}</span><Button size="sm" variant="quiet" onClick={() => make(s.start, s.end, s.label)}>Cut</Button></li>)}</ul>
        {!segs.length && <p className="text-sm text-dim">No scenes — use a custom range. For automatic moment-finding on long uploads, use Stream-to-Shorts or Podcast Producer.</p>}
        <p className="text-xs text-dim mt-4">AI-written summaries need the text provider.</p>
      </Card>
    </div>
  );
}

export function DiffTool({ project }: P) {
  const { db } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const snaps = db.snapshots.filter((s) => s.projectId === project.id);
  const [aId, setA] = useState(snaps[0]?.id ?? '');
  const [bId, setB] = useState('current');
  const A = snaps.find((s) => s.id === aId)?.data;
  const B = bId === 'current' ? project : snaps.find((s) => s.id === bId)?.data;
  const diff = A && B ? diffVersions(A, B) : null;
  const restore = async (id: string) => {
    const s = snaps.find((x) => x.id === id);
    if (!s || !(await confirm({ title: 'Restore this version?', body: `Your current version is saved as a snapshot first, so you can come back.`, confirm: 'Restore' }))) return;
    snapshot(project.id, 'Before restore');
    saveProject(project.id, structuredClone(s.data));
    toast('Version restored.', 'ok');
  };
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <Card className="p-4 h-fit">
        <div className="flex justify-between items-center mb-3"><span className="text-sm font-medium">Snapshots</span><Button size="sm" variant="quiet" icon={<Plus className="size-3.5" />} onClick={() => { snapshot(project.id, 'Manual snapshot'); toast('Snapshot saved.', 'ok'); }}>New</Button></div>
        <ul className="space-y-1 max-h-[480px] overflow-y-auto scroll-thin">{snaps.map((s) => <li key={s.id} className={cx('rounded-lg px-2.5 py-2 text-xs', s.id === aId && 'bg-white/5')}><div className="flex justify-between gap-2"><button className="text-left truncate" onClick={() => setA(s.id)}>{s.label}</button><button onClick={() => restore(s.id)} className="text-amber shrink-0" aria-label="Restore"><RotateCcw className="size-3.5" /></button></div><div className="text-dim">{ago(s.at)}</div></li>)}</ul>
        {!snaps.length && <p className="text-xs text-dim">Snapshots are created when you open the editor, export, apply fixes, or save manually.</p>}
      </Card>
      <div>
        <div className="flex flex-wrap gap-2 mb-5 text-sm items-center">
          <span className="text-mute">Compare</span><Select value={aId} onChange={(e) => setA(e.target.value)} className="w-56">{snaps.map((s) => <option key={s.id} value={s.id}>{s.label} · {ago(s.at)}</option>)}</Select>
          <span className="text-mute">with</span><Select value={bId} onChange={(e) => setB(e.target.value)} className="w-56"><option value="current">Current version</option>{snaps.map((s) => <option key={s.id} value={s.id}>{s.label} · {ago(s.at)}</option>)}</Select>
        </div>
        {diff ? (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4"><div className="text-sm font-medium mb-2">Scenes</div><div className="text-xs space-y-1">{diff.scenes.added.map((s) => <div key={s} className="text-ok">+ {s}</div>)}{diff.scenes.removed.map((s) => <div key={s} className="text-bad">− {s}</div>)}{diff.scenes.changed.map((s) => <div key={s} className="text-warn">~ {s}</div>)}{!diff.scenes.added.length && !diff.scenes.removed.length && !diff.scenes.changed.length && <div className="text-dim">No changes</div>}</div></Card>
            {(['timing', 'captions', 'audio'] as const).map((k) => <Card key={k} className="p-4"><div className="text-sm font-medium mb-2 capitalize">{k === 'timing' ? 'Visual timing' : k}</div><div className="text-xs font-mono space-y-0.5 max-h-56 overflow-auto scroll-thin">{diff[k].length ? diff[k].map((l, i) => <div key={i} className={l.startsWith('+') ? 'text-ok' : l.startsWith('−') ? 'text-bad' : 'text-mute'}>{l}</div>) : <div className="text-dim font-sans">No changes</div>}</div></Card>)}
            <Card className="p-4 md:col-span-2"><div className="text-sm font-medium mb-2">Script</div><pre className="text-xs font-mono whitespace-pre-wrap max-h-72 overflow-auto scroll-thin">{diff.script.map((l, i) => <div key={i} className={l.type === 'add' ? 'text-ok bg-ok/5' : l.type === 'del' ? 'text-bad bg-bad/5 line-through' : 'text-dim'}>{l.type === 'add' ? '+ ' : l.type === 'del' ? '− ' : '  '}{l.line || ' '}</div>)}</pre></Card>
          </div>
        ) : <p className="text-sm text-dim">Pick two versions to compare.</p>}
      </div>
    </div>
  );
}

export function StructureTool({ project }: P) {
  const [key, setKey] = useState('hso');
  const d = projectDuration(project) || project.scenes.reduce((a, s) => a + s.duration, 0) || 60;
  const beats = simulateStructure(d, key);
  let t = 0;
  const scenes = project.scenes.map((s) => { const r = { title: s.title, start: t, duration: s.duration }; t += s.duration; return r; });
  const colors = ['bg-violet/60', 'bg-azure/60', 'bg-amber/60', 'bg-ok/50', 'bg-paper/40', 'bg-bad/40', 'bg-violet/40', 'bg-azure/40'];
  return (
    <div>
      <Tabs className="mb-6" value={key} onChange={setKey} tabs={Object.entries(STRUCTURES).map(([k, v]) => ({ id: k, label: v.label }))} />
      <Card className="p-5 space-y-6">
        <div><div className="text-xs text-dim mb-2">Ideal beats for {tc(d)}</div><div className="flex h-12 rounded-lg overflow-hidden">{beats.map((b, i) => <div key={i} className={cx('h-full border-r border-ink flex items-center px-2 text-[11px] truncate', colors[i % colors.length])} style={{ width: `${(b.duration / d) * 100}%` }} title={`${b.name} ${tc(b.start)}`}>{b.name}</div>)}</div></div>
        <div><div className="text-xs text-dim mb-2">Your scenes</div><div className="flex h-12 rounded-lg overflow-hidden bg-raise">{scenes.map((s, i) => <div key={i} className="h-full border-r border-ink bg-white/10 flex items-center px-2 text-[11px] truncate" style={{ width: `${(s.duration / d) * 100}%` }} title={s.title}>{s.title}</div>)}</div></div>
        <ul className="text-sm space-y-1.5">{beats.map((b) => { const inBeat = scenes.filter((s) => s.start + s.duration / 2 >= b.start && s.start + s.duration / 2 < b.start + b.duration); return <li key={b.name} className="flex justify-between gap-3"><span><b>{b.name}</b> <span className="text-dim font-mono text-xs">{tc(b.start)}–{tc(b.start + b.duration)}</span></span><span className="text-mute text-right">{inBeat.length ? inBeat.map((s) => s.title).join(', ') : <span className="text-warn">no scene lands here</span>}</span></li>; })}</ul>
      </Card>
    </div>
  );
}

export function BrandTool({ project }: P) {
  const { db } = useApp();
  const kits = db.brandKits.filter((k) => k.workspaceId === project.workspaceId);
  const [kitId, setKit] = useState(project.brandKitId ?? kits[0]?.id ?? '');
  const kit = kits.find((k) => k.id === kitId);
  const fix = useFixer(project);
  return (
    <div>
      <div className="flex items-center gap-3 mb-5"><Select value={kitId} onChange={(e) => setKit(e.target.value)} className="max-w-xs" aria-label="Brand kit"><option value="">Choose a brand kit…</option>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select><Link to="/app/projects?tab=brand" className="text-sm text-amber hover:underline">Manage kits</Link></div>
      <FindingList findings={brandCheck(project, kit)} onFix={(f) => f.fixId && fix(applyFix(project, f.fixId, { kit }), f.title)} />
    </div>
  );
}

export function SpeakersTool({ project }: P) {
  const caps = project.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
  const speakers = [...new Set(caps.map((c) => c.speaker).filter(Boolean))] as string[];
  const [filter, setFilter] = useState('');
  const [bulk, setBulk] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const setSpeaker = (ids: string[], name: string) => { const n = structuredClone(project); n.tracks.forEach((t) => t.clips.forEach((c) => { if (ids.includes(c.id)) c.speaker = name || undefined; })); saveProject(project.id, { tracks: n.tracks }); };
  return (
    <div className="space-y-4">
      <PendingPanel needs={['stt']} what="Automatic speaker detection (diarization) needs a speech-to-text provider. Until then you can label speakers manually on captions — labels export in SRT as [Name]." />
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" aria-label="Filter by speaker"><option value="">All speakers</option>{speakers.map((s) => <option key={s}>{s}</option>)}</Select>
        <Input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Speaker name" className="w-48" aria-label="Speaker name for selected" />
        <Button size="sm" disabled={!sel.size} onClick={() => { setSpeaker([...sel], bulk.trim()); setSel(new Set()); }}>Label {sel.size} selected</Button>
      </div>
      <ul className="space-y-1">{caps.filter((c) => !filter || c.speaker === filter).map((c) => (
        <li key={c.id} className="flex items-center gap-3 rounded-xl hairline px-3 py-2 text-sm">
          <input type="checkbox" checked={sel.has(c.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(c.id); else s.delete(c.id); setSel(s); }} aria-label="Select caption" />
          <span className="font-mono text-xs text-dim w-12">{tc(c.start)}</span><span className="text-xs rounded bg-violet/15 text-violet px-2 py-0.5 min-w-16 text-center">{c.speaker ?? '—'}</span><span className="truncate flex-1">{c.text}</span>
        </li>
      ))}</ul>
      {!caps.length && <p className="text-sm text-dim">No captions yet.</p>}
    </div>
  );
}

export function FreelancerTool({ project }: P) {
  const { db } = useApp();
  const toast = useToast();
  const renders = db.assets.filter((a) => a.projectId === project.id && a.source === 'render' && !a.deletedAt);
  const caps = project.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips);
  const approvals = db.approvals.filter((a) => a.projectId === project.id);
  const used = [...new Set(project.tracks.flatMap((t) => t.clips.map((c) => c.assetId)).filter(Boolean) as string[])].map((id) => db.assets.find((a) => a.id === id)).filter((a): a is Asset => !!a);
  const note = `DELIVERY NOTE\n\nProject: ${project.title}\nDelivered: ${new Date().toLocaleString()}\nFormat: ${project.aspect}, ${project.fps} fps, ${tc(projectDuration(project))}\n\nFiles:\n${renders.map((r) => `• ${r.name} — ${r.width}×${r.height}, ${bytes(r.size)}`).join('\n') || '• (no render yet)'}\n• Captions: ${caps.length ? `${caps.length} cues (SRT + VTT)` : 'none'}\n\nApprovals:\n${approvals.map((a) => `• ${a.decision.replace('_', ' ')} by ${a.by} on ${new Date(a.at).toLocaleString()}${a.note ? ` — “${a.note}”` : ''}`).join('\n') || '• none recorded'}\n\nMedia licenses:\n${used.map((a) => `• ${a.name}: ${a.license || 'NOT RECORDED'}${a.attribution ? ` (${a.attribution})` : ''}`).join('\n')}\n`;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5 space-y-3">
        <div className="font-medium">Package files</div>
        {renders.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{r.name}</span><Button size="sm" icon={<Download className="size-3.5" />} onClick={async () => { const b = await getBlob(r.id); if (b) download(b, r.name); else toast('File missing on this device.', 'bad'); }}>{bytes(r.size)}</Button></div>)}
        {!renders.length && <p className="text-sm text-warn">No export yet. <Link className="underline" to={`/app/editor/${project.id}`}>Export from the editor</Link> first.</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" disabled={!caps.length} onClick={() => download(new Blob([toSRT(caps)]), `${project.title}.srt`)}>Captions .srt</Button>
          <Button size="sm" disabled={!caps.length} onClick={() => download(new Blob([toVTT(caps)]), `${project.title}.vtt`)}>Captions .vtt</Button>
          <Button size="sm" onClick={() => download(new Blob([note]), `${project.title} — delivery note.txt`)}>Delivery note</Button>
        </div>
      </Card>
      <Card className="p-5"><div className="font-medium mb-3">Delivery note preview</div><pre className="text-xs whitespace-pre-wrap text-mute font-mono max-h-96 overflow-auto scroll-thin">{note}</pre></Card>
    </div>
  );
}

export function A11yStudioTool({ project }: P) {
  const caps = project.tracks.filter((t) => t.kind === 'caption').flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
  const transcript = caps.map((c) => `${c.speaker ? c.speaker + ': ' : ''}${c.text}`).join('\n') || project.scenes.map((s) => s.narration).join('\n');
  let t = 0;
  const ad = project.scenes.map((s) => { const line = `[${tc(t)}] ${s.visual || s.title}${s.location ? ` — ${s.location}` : ''}${s.characters ? `. On screen: ${s.characters}` : ''}.`; t += s.duration; return line; }).join('\n');
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-5"><div className="font-medium">Captions</div><p className="text-sm text-mute mt-1">{caps.length} cues on the timeline.</p><div className="flex gap-2 mt-4"><Button size="sm" disabled={!caps.length} onClick={() => download(new Blob([toSRT(caps)]), `${project.title}.srt`)}>SRT</Button><Button size="sm" disabled={!caps.length} onClick={() => download(new Blob([toVTT(caps)]), `${project.title}.vtt`)}>VTT</Button></div><Link className="text-xs text-amber mt-4 inline-block" to={`/app/tool/a11y?project=${project.id}`}>Check caption timing →</Link></Card>
      <Card className="p-5"><div className="font-medium">Transcript</div><p className="text-sm text-mute mt-1">Plain text for screen readers and SEO.</p><Button size="sm" className="mt-4" disabled={!transcript.trim()} onClick={() => download(new Blob([transcript]), `${project.title} — transcript.txt`)}>Download .txt</Button></Card>
      <Card className="p-5"><div className="font-medium">Audio description script</div><p className="text-sm text-mute mt-1">Timestamped visual descriptions from your scene sheet.</p><Button size="sm" className="mt-4" disabled={!ad} onClick={() => download(new Blob([ad]), `${project.title} — audio description.txt`)}>Download script</Button><p className="text-[11px] text-dim mt-3">Voiced description needs TTS: <StatusPill status="not_configured" /></p></Card>
      <Card className="p-5 lg:col-span-3"><div className="text-sm font-medium mb-2">Audio description preview</div><pre className="text-xs text-mute whitespace-pre-wrap font-mono">{ad || 'Add scene visuals in Story Continuity Checker or the guided creator.'}</pre></Card>
    </div>
  );
}

export function PublishTool({ project }: P) {
  const { isReady } = useIntegrations();
  const { db, user } = useApp();
  const toast = useToast();
  const [ai, setAi] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  let t = 0;
  const chapters = project.scenes.map((s) => { const l = `${tc(t)} ${s.title}`; t += s.duration; return l; }).join('\n');
  const desc = `${project.title}\n\n${project.scenes.map((s) => s.narration).filter(Boolean).slice(0, 3).join(' ')}\n\nChapters:\n${chapters}`;
  const tags = [...new Set(project.scenes.flatMap((s) => s.visual.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 3))].slice(0, 12);
  const specs = [
    ['YouTube', '16:9', '1920×1080', 'Up to 12 h', 'Title ≤ 100 chars, add chapters (first at 0:00)'],
    ['YouTube Shorts', '9:16', '1080×1920', '≤ 3 min', 'Keep text out of bottom 22%'],
    ['TikTok', '9:16', '1080×1920', '≤ 10 min', 'Captions ≤ 2,200 chars'],
    ['Instagram Reels', '9:16', '1080×1920', '≤ 3 min', 'Cover image 1080×1920'],
    ['Instagram Feed', '4:5', '1080×1350', '≤ 60 min', '4:5 fills the most screen'],
    ['LinkedIn', '1:1 / 16:9', '1080×1080', '≤ 10 min', 'Burn in captions — most watch muted'],
  ];
  const gen = async () => {
    setBusy(true);
    try { const id = enqueue(user.id, 'ai_titles', `Publishing copy · ${project.title}`, { topic: `${project.title}. ${project.scenes.map((s) => s.title).join('; ')}` }, { projectId: project.id, credits: db.config.costs.aiTitles }); const j = await waitFor(id); if (j.status === 'succeeded') setAi(j.result?.data as Record<string, unknown>); else toast(j.error ?? 'Failed', 'bad'); }
    catch (e) { toast((e as Error).message, 'warn'); } finally { setBusy(false); }
  };
  const copy = (s: string) => { navigator.clipboard.writeText(s).then(() => toast('Copied.', 'ok')); };
  return (
    <div className="space-y-6">
      <Card className="p-5 overflow-x-auto"><div className="font-medium mb-3">Platform specs</div><table className="w-full text-sm min-w-[640px]"><thead className="text-xs text-dim text-left"><tr><th className="pb-2">Platform</th><th>Ratio</th><th>Frame</th><th>Length</th><th>Notes</th></tr></thead><tbody>{specs.map((r) => <tr key={r[0]} className={cx('border-t border-line', r[1].includes(project.aspect) && 'text-amber')}><td className="py-2">{r[0]}</td><td>{r[1]}</td><td className="font-mono text-xs">{r[2]}</td><td>{r[3]}</td><td className="text-mute text-xs">{r[4]}</td></tr>)}</tbody></table></Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5"><div className="flex justify-between mb-2"><span className="font-medium">Chapters</span><Button size="sm" variant="quiet" icon={<Copy className="size-3.5" />} onClick={() => copy(chapters)}>Copy</Button></div><pre className="text-xs font-mono text-mute whitespace-pre-wrap">{chapters || 'No scenes.'}</pre></Card>
        <Card className="p-5"><div className="flex justify-between mb-2"><span className="font-medium">Description (template)</span><Button size="sm" variant="quiet" icon={<Copy className="size-3.5" />} onClick={() => copy(desc)}>Copy</Button></div><pre className="text-xs text-mute whitespace-pre-wrap max-h-52 overflow-auto scroll-thin">{desc}</pre><div className="flex flex-wrap gap-1 mt-3">{tags.map((x) => <span key={x} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-mute">#{x}</span>)}</div></Card>
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap justify-between items-center gap-3"><div><div className="font-medium">AI titles & captions per platform</div><div className="text-xs text-dim">{db.config.costs.aiTitles} credits</div></div><Button icon={isReady('text') ? <Sparkles className="size-4" /> : <Lock className="size-4" />} disabled={!isReady('text')} loading={busy} onClick={gen}>Generate</Button></div>
        {!isReady('text') && <p className="text-xs text-dim mt-3">Needs the text provider: <StatusPill status="not_configured" />. Direct publishing needs platform OAuth (analytics integration).</p>}
        {ai && <pre className="text-xs text-mute whitespace-pre-wrap mt-4 font-mono">{JSON.stringify(ai, null, 2)}</pre>}
      </Card>
    </div>
  );
}

/* ---------------- Thumbnails ---------------- */
type Variant = { id: string; text: string; color: string; pos: 'top' | 'bottom' | 'left'; size: number; darken: number };
async function loadFrame(a: Asset): Promise<CanvasImageSource | null> {
  const url = await blobUrl(a.id);
  if (!url) return null;
  if (a.type === 'image') return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  return new Promise((res) => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url; v.onloadeddata = () => { v.currentTime = Math.min(a.duration / 3, 3); }; v.onseeked = () => res(v); v.onerror = () => res(null); });
}
function drawThumb(c: HTMLCanvasElement, src: CanvasImageSource, w0: number, h0: number, v: Variant) {
  c.width = 1280; c.height = 720;
  const ctx = c.getContext('2d')!;
  const s = Math.max(1280 / w0, 720 / h0);
  ctx.drawImage(src, (1280 - w0 * s) / 2, (720 - h0 * s) / 2, w0 * s, h0 * s);
  const g = v.pos === 'left' ? ctx.createLinearGradient(0, 0, 900, 0) : v.pos === 'top' ? ctx.createLinearGradient(0, 0, 0, 500) : ctx.createLinearGradient(0, 720, 0, 220);
  g.addColorStop(0, `rgba(0,0,0,${v.darken})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
  ctx.font = `800 ${v.size}px "Hanken Grotesk", sans-serif`;
  ctx.fillStyle = v.color; ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
  const words = v.text.toUpperCase().split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > (v.pos === 'left' ? 700 : 1100) && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const lh = v.size * 1.05;
  const y0 = v.pos === 'top' ? 60 : v.pos === 'bottom' ? 720 - 60 - lines.length * lh : 360 - (lines.length * lh) / 2;
  ctx.textAlign = v.pos === 'left' ? 'left' : 'center';
  lines.forEach((l, i) => ctx.fillText(l, v.pos === 'left' ? 70 : 640, y0 + i * lh));
}
/** Real pixel measurements: contrast, colorfulness, focal point vs thirds, text length. */
function analyzeThumb(c: HTMLCanvasElement, text: string) {
  const ctx = c.getContext('2d')!;
  const W = 64, H = 36;
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  tmp.getContext('2d')!.drawImage(c, 0, 0, W, H);
  const d = tmp.getContext('2d')!.getImageData(0, 0, W, H).data;
  let sum = 0, sq = 0, rg = 0, yb = 0; const lum: number[] = [];
  for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; lum.push(l); sum += l; sq += l * l; rg += Math.abs(d[i] - d[i + 1]); yb += Math.abs((d[i] + d[i + 1]) / 2 - d[i + 2]); }
  const n = lum.length, mean = sum / n, std = Math.sqrt(sq / n - mean * mean);
  const colorful = (rg + yb) / n;
  let best = { x: 0, y: 0, s: -1 };
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; const local = Math.abs(lum[i] - mean) + Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - W]); if (local > best.s) best = { x, y, s: local }; }
  const fx = best.x / W, fy = best.y / H;
  const thirds = Math.min(...[[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]].map(([a, b]) => Math.hypot(fx - a, fy - b)));
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  void ctx;
  return [
    { k: 'Contrast', v: `${std.toFixed(0)}`, ok: std > 50, tip: std > 50 ? 'Strong tonal contrast reads well when small.' : 'Low contrast — darken the background or brighten the subject.' },
    { k: 'Colorfulness', v: `${colorful.toFixed(0)}`, ok: colorful > 40, tip: colorful > 40 ? 'Vivid enough to stand out in a feed.' : 'Muted palette — consider a bolder accent color.' },
    { k: 'Text length', v: `${words} words`, ok: words > 0 && words <= 5, tip: words <= 5 ? 'Short text is readable at phone size.' : 'Over 5 words is hard to read at thumbnail size.' },
    { k: 'Focal point', v: `${Math.round(fx * 100)}%, ${Math.round(fy * 100)}%`, ok: thirds < 0.18, tip: thirds < 0.18 ? 'Main detail sits near a rule-of-thirds point.' : 'Strongest detail is far from the thirds lines; reframe the subject.' },
    { k: 'Brightness', v: `${Math.round((mean / 255) * 100)}%`, ok: mean > 60 && mean < 200, tip: mean <= 60 ? 'Very dark — may disappear in dark mode.' : mean >= 200 ? 'Very bright — may wash out.' : 'Balanced exposure.' },
  ];
}

export function ThumbnailTool({ project, psych }: P & { psych?: boolean }) {
  const { db, user } = useApp();
  const toast = useToast();
  const visuals = useMemo(() => { const ids = new Set(project.tracks.flatMap((t) => t.clips.map((c) => c.assetId))); return db.assets.filter((a) => (ids.has(a.id) || a.workspaceId === project.workspaceId) && a.type !== 'audio' && !a.deletedAt && a.source !== 'render'); }, [db.assets, project]);
  const [srcId, setSrc] = useState(visuals[0]?.id ?? '');
  const [frame, setFrame] = useState<{ el: CanvasImageSource; w: number; h: number } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([
    { id: 'A', text: project.title.split('—')[0].slice(0, 28), color: '#ffffff', pos: 'bottom', size: 96, darken: 0.75 },
    { id: 'B', text: project.title.split(' ').slice(0, 3).join(' '), color: '#ffd84a', pos: 'left', size: 110, darken: 0.85 },
    { id: 'C', text: 'Watch this', color: '#9a8cff', pos: 'top', size: 88, darken: 0.6 },
  ]);
  const [active, setActive] = useState('A');
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeThumb> | null>(null);
  useEffect(() => { const a = visuals.find((x) => x.id === srcId); if (!a) return; loadFrame(a).then((el) => { if (el) setFrame({ el, w: a.width || 1280, h: a.height || 720 }); }); }, [srcId, visuals]);
  useEffect(() => { if (!frame) return; document.fonts.ready.then(() => { variants.forEach((v) => { const c = refs.current[v.id]; if (c) drawThumb(c, frame.el, frame.w, frame.h, v); }); const c = refs.current[active]; const v = variants.find((x) => x.id === active); if (c && v) setAnalysis(analyzeThumb(c, v.text)); }); }, [frame, variants, active]);
  const v = variants.find((x) => x.id === active)!;
  const setV = (p: Partial<Variant>) => setVariants(variants.map((x) => (x.id === active ? { ...x, ...p } : x)));
  const save = async (id: string) => {
    const c = refs.current[id]; if (!c) return;
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!blob) return;
    download(blob, `${project.title} — thumbnail ${id}.png`);
    const aid = uid('as_'); await putBlob(aid, blob);
    update((d) => { d.assets.unshift({ id: aid, workspaceId: project.workspaceId, ownerId: user.id, name: `${project.title} — thumbnail ${id}.png`, type: 'image', mime: 'image/png', size: blob.size, duration: 0, width: 1280, height: 720, hash: aid, tags: ['thumbnail'], source: 'render', license: 'Your render', attribution: '', projectId: project.id, createdAt: Date.now(), thumb: c.toDataURL('image/jpeg', 0.5) }); });
    toast(`Thumbnail ${id} saved and downloaded.`, 'ok');
  };
  if (!visuals.length) return <p className="text-sm text-mute">Upload an image or video to design thumbnails from.</p>;
  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-6">
      <div>
        <div className="grid md:grid-cols-3 gap-3">
          {variants.map((x) => (
            <button key={x.id} onClick={() => setActive(x.id)} className={cx('rounded-xl overflow-hidden hairline text-left', active === x.id && 'ring-2 ring-amber')}>
              <canvas ref={(el) => { refs.current[x.id] = el; }} className="w-full aspect-video bg-raise" aria-label={`Thumbnail variant ${x.id}`} />
              <div className="flex justify-between items-center p-2 text-xs"><span>Variant {x.id}</span><span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); save(x.id); }} onKeyDown={(e) => { if (e.key === 'Enter') save(x.id); }} className="text-amber hover:underline">Save PNG</span></div>
            </button>
          ))}
        </div>
        <Card className="p-5 mt-6">
          <div className="font-medium mb-1">{psych ? 'Thumbnail psychology — measured' : 'A/B comparison'}</div>
          {psych || true ? (
            <ul className="grid md:grid-cols-2 gap-2 mt-3">{analysis?.map((r) => <li key={r.k} className="rounded-xl hairline p-3 text-sm"><div className="flex justify-between"><span className={r.ok ? 'text-ok' : 'text-warn'}>{r.k}</span><span className="font-mono text-xs">{r.v}</span></div><p className="text-xs text-mute mt-1">{r.tip}</p></li>)}</ul>
          ) : null}
          {!psych && <p className="text-xs text-dim mt-4">Winner selection uses real click-through data only. YouTube analytics: <StatusPill status="not_configured" /> — we won’t guess a winner.</p>}
        </Card>
      </div>
      <Card className="p-5 h-fit space-y-4">
        <Field label="Frame source"><Select value={srcId} onChange={(e) => setSrc(e.target.value)}>{visuals.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label={`Variant ${active} text`}><Input value={v.text} onChange={(e) => setV({ text: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Color"><input type="color" value={v.color} onChange={(e) => setV({ color: e.target.value })} className="h-10 w-full rounded bg-transparent" /></Field>
          <Field label="Position"><Select value={v.pos} onChange={(e) => setV({ pos: e.target.value as Variant['pos'] })}><option value="bottom">Bottom</option><option value="top">Top</option><option value="left">Left</option></Select></Field>
        </div>
        <label className="block text-xs text-mute">Size {v.size}px<input type="range" min={48} max={160} value={v.size} onChange={(e) => setV({ size: Number(e.target.value) })} className="w-full" /></label>
        <label className="block text-xs text-mute">Shade {Math.round(v.darken * 100)}%<input type="range" min={0} max={0.95} step={0.05} value={v.darken} onChange={(e) => setV({ darken: Number(e.target.value) })} className="w-full" /></label>
        <p className="text-[11px] text-dim flex gap-1.5"><ImageIcon className="size-3.5 shrink-0" />1280×720 PNG. AI image generation for backgrounds needs an image provider.</p>
      </Card>
    </div>
  );
}

export function HookScoreInline({ text }: { text: string }) { const s = scoreHook(text); return <span className="tabular">{s.score}</span>; }
export { captionsFromText };

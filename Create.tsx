import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Plus, Sparkles, Trash2, Wand2, Music, Image as ImageIcon, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Eyebrow, Field, Input, Select, StatusPill, Textarea, Toggle, cx, useToast } from '../components/ui';
import { AssetThumb, Dropzone, VoiceButton, ReadAloud } from '../components/shared';
import { useApp } from '../lib/useApp';
import { TEMPLATES, templateFor } from '../lib/templates';
import { FEATURES, featureById, routeRequest } from '../lib/features';
import { ASPECTS, assembleFromScenes, createProject, makeClip, newScene, saveProject, scriptFromScenes, CAPTION_STYLE, TITLE_STYLE } from '../lib/project';
import { matchBroll } from '../lib/analyzers';
import { useIntegrations } from '../lib/integrations';
import { enqueue, waitFor, InsufficientCredits } from '../lib/jobs';
import { useSettings } from '../lib/i18n';
import type { Aspect, Scene, Transition } from '../lib/types';
import { dur, ease } from '../lib/motion';
import { audit } from '../lib/db';
import { tc } from '../lib/id';

interface Draft { flow: string; aspect: Aspect; title: string; values: Record<string, string>; scenes: Scene[]; captions: boolean; transition: Transition; styleId: string; brandKitId: string; musicId: string; length: number; tone: string }
const KEY = 'obscura.wizard';
const STEPS = ['Start', 'Basics', 'Story', 'Media', 'Style', 'Assemble'];

export default function Create() {
  const [params] = useSearchParams();
  const { user, workspace, db, balance, allow } = useApp();
  const settings = useSettings();
  const nav = useNavigate();
  const toast = useToast();
  const { isReady } = useIntegrations();
  const initialFlow = params.get('flow');
  const prompt = params.get('prompt') ?? '';
  const [step, setStep] = useState(initialFlow ? 1 : 0);
  const [d, setD] = useState<Draft>(() => {
    const saved = localStorage.getItem(KEY);
    const base: Draft = { flow: initialFlow ?? 'autopilot', aspect: templateFor(initialFlow ?? 'autopilot').aspect, title: '', values: prompt ? { topic: prompt } : {}, scenes: [], captions: true, transition: 'fade', styleId: '', brandKitId: '', musicId: '', length: 45, tone: 'warm and clear' };
    if (saved && !initialFlow && !prompt) { try { return { ...base, ...JSON.parse(saved) }; } catch { return base; } }
    return base;
  });
  const [q, setQ] = useState(prompt);
  const [aiBusy, setAiBusy] = useState(false);
  const tpl = templateFor(d.flow);
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt && a.source !== 'render');
  const styles = db.styles.filter((s) => s.workspaceId === workspace?.id);
  const kits = db.brandKits.filter((k) => k.workspaceId === workspace?.id);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(d)); }, [d]);
  const total = d.scenes.reduce((a, s) => a + s.duration, 0);
  const aiCost = db.config.costs.aiScript;
  const textReady = isReady('text');

  const pickFlow = (id: string) => { const t = templateFor(id); set({ flow: id, aspect: t.aspect, scenes: [] }); setStep(1); };
  const buildFromTemplate = () => {
    const r = tpl.build(d.values);
    set({ scenes: r.scenes, title: d.title || r.title });
    toast(`${r.scenes.length} scenes created from the ${tpl.name} structure. Edit anything.`, 'ok');
  };
  const writeWithAI = async () => {
    const topic = d.values.topic || d.values.product || d.values.concept || d.values.dish || d.values.name || d.values.title || d.title;
    if (!topic) { toast('Fill in what the video is about first.', 'warn'); return; }
    setAiBusy(true);
    try {
      const id = enqueue(user.id, 'ai_script', `AI script · ${topic.slice(0, 40)}`, { prompt: `${topic}\n${Object.entries(d.values).map(([k, v]) => `${k}: ${v}`).join('\n')}`, length: d.length, aspect: d.aspect, tone: d.tone, familySafe: settings.familySafe }, { credits: aiCost });
      const job = await waitFor(id);
      if (job.status !== 'succeeded') { toast(job.error ?? 'The AI step failed. Credits were refunded.', 'bad'); return; }
      const data = (job.result?.data ?? {}) as { title?: string; scenes?: { title: string; narration: string; visual: string; duration: number }[] };
      if (!data.scenes?.length) { toast('The AI returned no scenes. Credits were spent on the attempt — try rephrasing.', 'warn'); return; }
      set({ title: data.title ?? d.title, scenes: data.scenes.map((s) => newScene({ title: s.title, narration: s.narration, visual: s.visual, duration: Math.max(1.5, Number(s.duration) || 4) })) });
      audit(user.id, 'ai.script', id);
      toast('AI draft ready. Review and edit every scene.', 'ok');
    } catch (e) { toast(e instanceof InsufficientCredits ? e.message : (e as Error).message, 'warn'); } finally { setAiBusy(false); }
  };
  const updScene = (id: string, p: Partial<Scene>) => set({ scenes: d.scenes.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const move = (i: number, dir: -1 | 1) => { const s = [...d.scenes]; const j = i + dir; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ scenes: s }); };
  const autoMatch = () => {
    const m = matchBroll(d.scenes, assets);
    let n = 0;
    const used = new Set<string>();
    set({ scenes: d.scenes.map((s, i) => { if (s.assetId) return s; const pick = m[i].matches.find((x) => !used.has(x.asset.id)); if (pick) { used.add(pick.asset.id); n++; return { ...s, assetId: pick.asset.id }; } return s; }) });
    toast(n ? `Matched ${n} scene${n > 1 ? 's' : ''} by keywords.` : 'No matches — add tags to media or pick manually.', n ? 'ok' : 'info');
  };
  const fillInOrder = () => {
    const visuals = assets.filter((a) => a.type !== 'audio');
    set({ scenes: d.scenes.map((s, i) => ({ ...s, assetId: s.assetId ?? visuals[i % Math.max(1, visuals.length)]?.id })) });
  };

  const assemble = () => {
    if (!allow('edit')) { toast('You have view-only access to this workspace.', 'warn'); return; }
    const style = styles.find((s) => s.id === d.styleId);
    const kit = kits.find((k) => k.id === d.brandKitId);
    const p = createProject(user.id, workspace.id, { title: d.title || tpl.name, aspect: d.aspect, template: d.flow, scenes: d.scenes, stage: 'editing', styleId: d.styleId || undefined, brandKitId: d.brandKitId || undefined });
    const capStyle = style?.caption ?? { ...CAPTION_STYLE, font: kit?.bodyFont ?? 'sans' };
    const tracks = assembleFromScenes({ ...p, scenes: d.scenes }, db.assets, { captions: d.captions, captionStyle: capStyle, transition: style?.transition ?? d.transition, titleStyle: { ...TITLE_STYLE, font: kit?.headingFont ?? 'display', color: kit?.colors[0] ?? TITLE_STYLE.color } });
    const music = assets.find((a) => a.id === d.musicId);
    if (music) {
      const mt = tracks.find((t) => t.kind === 'audio')!;
      const len = d.scenes.reduce((a, s) => a + Math.max(1.5, s.duration), 0);
      mt.clips.push(makeClip({ kind: 'audio', assetId: music.id, start: 0, duration: Math.min(len, music.duration || len), volume: 0.35, fadeIn: 1, fadeOut: 2 }));
    }
    saveProject(p.id, { tracks, script: scriptFromScenes(d.scenes) });
    localStorage.removeItem(KEY);
    toast('Assembled. Welcome to the editor.', 'ok');
    nav(`/app/editor/${p.id}`);
  };

  const canNext = step === 0 ? true : step === 2 ? d.scenes.length > 0 : true;
  const routed = q.trim() ? routeRequest(q) : null;
  const flows = useMemo(() => Object.values(TEMPLATES), []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-10 overflow-x-auto scroll-thin pb-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 shrink-0">
            <button onClick={() => (i <= step || (i > 0 && d.scenes.length) ? setStep(i) : undefined)} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full text-sm transition-colors', i === step ? 'bg-paper text-ink' : i < step ? 'text-paper hover:bg-white/5' : 'text-dim')}>
              <span className={cx('size-6 rounded-full grid place-items-center text-xs', i === step ? 'bg-ink text-paper' : i < step ? 'bg-ok/20 text-ok' : 'bg-white/5')}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>{s}
            </button>
            {i < STEPS.length - 1 && <span className={cx('h-px w-6', i < step ? 'bg-ok/50' : 'bg-line2')} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16, filter: 'blur(4px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -16 }} transition={{ duration: dur.base, ease: ease.out }}>
          {step === 0 && (
            <div>
              <Eyebrow className="mb-3">Universal Create</Eyebrow>
              <h1 className="font-display text-5xl md:text-6xl leading-none">Tell us your idea.</h1>
              <p className="text-mute mt-3">Plain words are perfect. Or pick a workflow below.</p>
              <div className="mt-6 flex flex-col md:flex-row gap-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A 60-second video explaining compound interest for teens" className="h-13 text-base flex-1" aria-label="Describe your video" />
                <VoiceButton onText={setQ} className="h-13" />
                <Button variant="primary" size="lg" disabled={!routed} icon={<ArrowRight className="size-5" />} onClick={() => { if (!routed) return; const f = routed.feature; if (TEMPLATES[f.id]) { set({ values: { ...d.values, topic: q } }); pickFlow(f.id); } else nav(`/app/tool/${f.id}?prompt=${encodeURIComponent(q)}`); }}>Go</Button>
              </div>
              {routed && <p className="text-sm mt-3 text-mute">We’ll use <span className="text-paper">{routed.feature.name}</span> because it {routed.why}.</p>}
              <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {flows.map((f) => {
                  const feat = featureById(f.id === 'autopilot' ? 'autopilot' : f.id);
                  return (
                    <button key={f.id} onClick={() => pickFlow(f.id)} className="text-left rounded-2xl hairline bg-panel p-5 hover:bg-raise hover:border-line2 transition-colors">
                      <div className="flex justify-between items-start"><div className="font-display text-2xl">{f.name}</div><span className="text-[10px] font-mono text-dim">{f.aspect}</span></div>
                      <p className="text-sm text-mute mt-1.5 line-clamp-2">{feat?.desc ?? f.mediaHint}</p>
                    </button>
                  );
                })}
              </div>
              {localStorage.getItem(KEY) && d.scenes.length > 0 && <p className="text-sm text-mute mt-6">You have an unfinished draft (“{d.title || tpl.name}”, {d.scenes.length} scenes). <button className="text-amber hover:underline" onClick={() => setStep(2)}>Continue it</button> · <button className="hover:underline" onClick={() => { localStorage.removeItem(KEY); set({ scenes: [], values: {}, title: '' }); }}>Discard</button></p>}
            </div>
          )}

          {step === 1 && (
            <div className="max-w-2xl">
              <Eyebrow className="mb-3">{tpl.name}</Eyebrow>
              <h1 className="font-display text-5xl leading-none">The basics.</h1>
              <p className="text-mute mt-3 mb-8">Only what we really need.</p>
              <div className="space-y-6">
                <Field label="Working title" hint="You can change it anytime."><Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={tpl.name} /></Field>
                <div>
                  <div className="text-sm font-medium mb-2">Where will people watch it?</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2" role="radiogroup">
                    {ASPECTS.map((a) => (
                      <button key={a.id} role="radio" aria-checked={d.aspect === a.id} onClick={() => set({ aspect: a.id })} className={cx('rounded-2xl hairline p-4 text-left transition-colors', d.aspect === a.id ? 'bg-paper text-ink' : 'bg-panel hover:bg-raise')}>
                        <div className="h-10 flex items-end mb-3"><div className={cx('rounded border-2', d.aspect === a.id ? 'border-ink' : 'border-mute')} style={{ width: a.id === '9:16' ? 18 : a.id === '4:5' ? 26 : a.id === '1:1' ? 32 : 46, height: a.id === '16:9' ? 26 : a.id === '1:1' ? 32 : a.id === '4:5' ? 32 : 36 }} /></div>
                        <div className="text-sm font-medium">{a.label}</div><div className={cx('text-xs', d.aspect === a.id ? 'text-ink/60' : 'text-dim')}>{a.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {settings.mode === 'pro' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Target length (seconds, for AI drafts)"><Input type="number" min={10} max={1200} value={d.length} onChange={(e) => set({ length: Number(e.target.value) })} /></Field>
                    <Field label="Tone"><Input value={d.tone} onChange={(e) => set({ tone: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-display text-5xl leading-none">Shape the story.</h1>
              <p className="text-mute mt-3 mb-8">{d.scenes.length ? `${d.scenes.length} scenes · ${tc(total)} total. Edit, reorder or add.` : 'Answer these, then build your scenes.'}</p>
              {d.scenes.length === 0 ? (
                <Card className="p-6 max-w-2xl space-y-5">
                  {tpl.fields.map((f) => (
                    <Field key={f.key} label={f.label} hint={f.hint}>
                      {f.type === 'textarea' ? <Textarea value={d.values[f.key] ?? ''} onChange={(e) => set({ values: { ...d.values, [f.key]: e.target.value } })} placeholder={f.placeholder} rows={4} /> : <Input type={f.type === 'number' ? 'number' : 'text'} value={d.values[f.key] ?? ''} onChange={(e) => set({ values: { ...d.values, [f.key]: e.target.value } })} placeholder={f.placeholder} />}
                    </Field>
                  ))}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="primary" size="lg" icon={<Wand2 className="size-4" />} onClick={buildFromTemplate}>Build scenes from template</Button>
                    <Button size="lg" icon={textReady ? <Sparkles className="size-4" /> : <Lock className="size-4" />} loading={aiBusy} disabled={!textReady} onClick={writeWithAI}>Write with AI · {aiCost} credits</Button>
                  </div>
                  {!textReady && <p className="text-xs text-dim">AI writing: <StatusPill status="not_configured" /> Connect a text provider (OPENAI_API_KEY) — see <Link to="/app/trust" className="underline">Integrations</Link>. Templates are deterministic structures, not AI.</p>}
                  {textReady && <p className="text-xs text-dim">You have {balance} credits. AI drafts are reserved up front and refunded automatically if the provider fails.</p>}
                </Card>
              ) : (
                <div className="space-y-3">
                  {d.scenes.map((s, i) => (
                    <motion.div layout key={s.id} className="rounded-2xl hairline bg-panel p-4 grid md:grid-cols-[auto_1fr_auto] gap-4 items-start">
                      <div className="flex md:flex-col items-center gap-1">
                        <span className="font-mono text-xs text-dim w-7 text-center">{String(i + 1).padStart(2, '0')}</span>
                        <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="size-8 grid place-items-center rounded-lg hover:bg-white/5 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                        <button onClick={() => move(i, 1)} disabled={i === d.scenes.length - 1} aria-label="Move down" className="size-8 grid place-items-center rounded-lg hover:bg-white/5 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                      </div>
                      <div className="grid gap-2">
                        <Input aria-label="Scene title (shown on screen when no media)" value={s.title} onChange={(e) => updScene(s.id, { title: e.target.value })} className="font-medium" />
                        <Textarea aria-label="Narration / caption text" value={s.narration} onChange={(e) => updScene(s.id, { narration: e.target.value })} rows={2} placeholder="What’s said or captioned in this scene" className="min-h-16" />
                        {settings.mode === 'pro' && <Input aria-label="Visual keywords" value={s.visual} onChange={(e) => updScene(s.id, { visual: e.target.value })} placeholder="Visual keywords for B-roll matching" />}
                      </div>
                      <div className="flex md:flex-col items-center gap-2">
                        <label className="text-xs text-dim flex items-center gap-1.5">Sec<Input type="number" min={1} step={0.5} value={s.duration} onChange={(e) => updScene(s.id, { duration: Math.max(1, Number(e.target.value)) })} className="w-20 py-1.5" /></label>
                        <ReadAloud text={s.narration || s.title} />
                        <button onClick={() => set({ scenes: d.scenes.filter((x) => x.id !== s.id) })} aria-label={`Delete scene ${i + 1}`} className="size-8 grid place-items-center rounded-lg text-dim hover:text-bad hover:bg-bad/10"><Trash2 className="size-4" /></button>
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<Plus className="size-4" />} onClick={() => set({ scenes: [...d.scenes, newScene({ title: `Scene ${d.scenes.length + 1}` })] })}>Add scene</Button>
                    <Button variant="quiet" onClick={() => set({ scenes: [] })}>Start over</Button>
                  </div>
                  <p className="text-xs text-dim">“Read aloud” uses your browser’s voice for previewing only. Recorded narration needs a text-to-speech provider.</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-display text-5xl leading-none">Bring your media.</h1>
              <p className="text-mute mt-3 mb-6">{tpl.mediaHint} Scenes without media become elegant title cards.</p>
              <Dropzone compact />
              <div className="flex flex-wrap gap-2 mt-4 mb-6">
                <Button icon={<Wand2 className="size-4" />} onClick={autoMatch} disabled={!assets.length}>Auto-match by keywords</Button>
                <Button variant="quiet" onClick={fillInOrder} disabled={!assets.length}>Fill in upload order</Button>
              </div>
              <div className="space-y-2">
                {d.scenes.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl hairline bg-panel p-3">
                    <span className="font-mono text-xs text-dim w-6">{i + 1}</span>
                    <AssetThumb asset={assets.find((a) => a.id === s.assetId)} className="w-24 aspect-video rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{s.title}</div><div className="text-xs text-dim truncate">{s.narration}</div></div>
                    <Select aria-label={`Media for scene ${i + 1}`} value={s.assetId ?? ''} onChange={(e) => updScene(s.id, { assetId: e.target.value || undefined })} className="max-w-[220px]">
                      <option value="">Title card (no media)</option>
                      {assets.filter((a) => a.type !== 'audio').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <Card className="p-4 mt-6 flex flex-col md:flex-row md:items-center gap-3">
                <Music className="size-5 text-violet" />
                <div className="flex-1"><div className="text-sm font-medium">Background music</div><div className="text-xs text-dim">Use your own audio. A licensed music library needs a music provider.</div></div>
                <Select aria-label="Background music" value={d.musicId} onChange={(e) => set({ musicId: e.target.value })} className="max-w-xs">
                  <option value="">No music</option>
                  {assets.filter((a) => a.type === 'audio' || a.type === 'video').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Card>
              {!assets.length && <p className="text-sm text-mute mt-4 flex items-center gap-2"><ImageIcon className="size-4" /> No media yet — upload above, or continue with title cards.</p>}
            </div>
          )}

          {step === 4 && (
            <div className="max-w-2xl">
              <h1 className="font-display text-5xl leading-none">Choose a look.</h1>
              <p className="text-mute mt-3 mb-8">Use saved Style DNA or a brand kit, or keep the defaults.</p>
              <Card className="p-6 space-y-5">
                <Toggle checked={d.captions} onChange={(v) => set({ captions: v })} label="Captions" desc="Burned into the video from scene narration. Recommended — many people watch muted." />
                <Field label="Transitions between shots">
                  <Select value={d.transition} onChange={(e) => set({ transition: e.target.value as Transition })}>
                    <option value="fade">Soft fade</option><option value="zoom">Slow zoom</option><option value="slide">Slide</option><option value="none">Straight cut</option>
                  </Select>
                </Field>
                <Field label="Style DNA preset" hint={styles.length ? undefined : 'No presets yet — create them in Style DNA.'}>
                  <Select value={d.styleId} onChange={(e) => set({ styleId: e.target.value })}><option value="">Default</option>{styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                </Field>
                <Field label="Brand kit" hint={kits.length ? undefined : 'No brand kits yet — add one under Projects & Assets → Brand kits.'}>
                  <Select value={d.brandKitId} onChange={(e) => set({ brandKitId: e.target.value })}><option value="">None</option>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select>
                </Field>
              </Card>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-2xl">
              <h1 className="font-display text-5xl leading-none">Ready to assemble.</h1>
              <p className="text-mute mt-3 mb-8">We’ll lay everything out on a real timeline. You can change anything in the editor.</p>
              <Card className="p-6 divide-y divide-line">
                {[
                  ['Title', d.title || tpl.name], ['Format', d.aspect], ['Scenes', `${d.scenes.length} · ${tc(total)}`], ['With media', `${d.scenes.filter((s) => s.assetId).length} of ${d.scenes.length}`],
                  ['Captions', d.captions ? 'On' : 'Off'], ['Music', assets.find((a) => a.id === d.musicId)?.name ?? 'None'], ['Cost to assemble', 'Free'],
                ].map(([a, b]) => <div key={a} className="flex justify-between py-3 text-sm"><span className="text-mute">{a}</span><span className="text-right">{b}</span></div>)}
              </Card>
              <Button variant="primary" size="lg" className="mt-6 w-full" icon={<Sparkles className="size-5" />} disabled={!d.scenes.length} onClick={assemble}>Assemble & open editor</Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step > 0 && (
        <div className="flex justify-between mt-12 pt-6 border-t border-line">
          <Button variant="quiet" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 5 && <Button variant="primary" size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <ArrowRight className="size-4" /></Button>}
        </div>
      )}
      <p className="sr-only" aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      {FEATURES.length === 0 && null}
    </div>
  );
}

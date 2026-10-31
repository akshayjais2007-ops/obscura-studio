import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, Empty, StatusPill, Eyebrow } from '../components/ui';
import { ProjectPicker, ReadAloud, useProjectParam } from '../components/shared';
import { featureById, CATEGORIES } from '../lib/features';
import { useIntegrations, INTEGRATIONS } from '../lib/integrations';
import { useT } from '../lib/i18n';
import * as PT from './tools/ProjectTools';
import * as MT from './tools/MediaTools';
import { PendingPanel } from './tools/common';
import { TEMPLATES } from '../lib/templates';
import type { Project } from '../lib/types';

const PROJECT_TOOLS: Record<string, (p: { project: Project }) => React.ReactElement> = {
  retention: PT.RetentionTool, continuity: PT.ContinuityTool, broll: PT.BrollTool, sound: PT.SoundTool, 'thumb-ab': PT.ThumbnailTool,
  'thumb-psych': (p) => <PT.ThumbnailTool {...p} psych />, revision: PT.RevisionTool, safezone: PT.SafeZoneTool, cost: PT.CostTool, factcheck: PT.FactCheckTool,
  license: PT.LicenseTool, repurpose: PT.RepurposeTool, diff: PT.DiffTool, a11y: PT.A11yTool, structure: PT.StructureTool, quality: PT.QualityTool,
  publish: PT.PublishTool, 'brand-guardian': PT.BrandTool, speakers: PT.SpeakersTool, freelancer: PT.FreelancerTool, 'a11y-studio': PT.A11yStudioTool,
  approval: ({ project }) => <Navigate to={`/app/review/${project.id}`} replace />,
  consistency: () => <PendingPanel needs={['image']} what="Visual Consistency Lock keeps a character’s face, outfit and the overall look stable across AI-generated shots by conditioning every generation on reference images. It needs an image/video generation provider that supports references." now={<p className="text-sm text-mute">Today you can tag reference images in your library (e.g. “ref-maya”), track outfits in the <Link className="text-amber underline" to="/app/tool/continuity">Continuity Checker</Link>, and lock a look with <Link className="text-amber underline" to="/app/tool/styledna">Style DNA</Link>.</p>} />,
  dubbing: () => <PendingPanel needs={['stt', 'tts']} what="Dubbing transcribes the original speech, translates it, generates a voice in the target language and re-times (or lip-syncs) it to the picture. This needs speech-to-text, translation and voice/lip-sync providers." now={<p className="text-sm text-mute">Today you can export captions (SRT/VTT) from the editor for human translation, then import the translated SRT on a new caption track.</p>} />,
};

export default function Tool() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const prompt = params.get('prompt') ?? undefined;
  const f = featureById(id);
  const t = useT();
  const { data } = useIntegrations();
  const [project, setProject] = useProjectParam();
  if (!f) return <Empty icon={<ArrowLeft className="size-5" />} title="Tool not found" desc="Try searching with Ctrl/⌘ K." />;
  if (f.route && !PROJECT_TOOLS[id]) return <Navigate to={f.route + (prompt ? `${f.route.includes('?') ? '&' : '?'}prompt=${encodeURIComponent(prompt)}` : '')} replace />;
  const cat = CATEGORIES.find((c) => c.id === f.cats[0])!;
  const ProjectTool = id in PROJECT_TOOLS ? PROJECT_TOOLS[id] : undefined;
  let body: React.ReactNode = null;
  if (ProjectTool) {
    body = project ? <ProjectTool project={project} /> : <Empty icon={<ArrowLeft className="size-5" />} title="Choose a project" desc="This tool works on one of your projects." action={<ProjectPicker onChange={setProject} />} />;
  } else if (TEMPLATES[id]) body = id === 'memory-film' ? <div className="space-y-8"><MT.TemplateLauncher id={id} prompt={prompt} /><div><div className="font-display text-3xl mb-4">Or: set photos to the beat of a song</div><MT.BeatsTool memory /></div></div> : <MT.TemplateLauncher id={id} prompt={prompt} />;
  else body = {
    hooks: <MT.HooksTool prompt={prompt} />, styledna: <MT.StyleDNATool />, memory: <MT.MemoryTool />, experiments: <MT.ExperimentsTool />,
    'lecture-kit': <MT.LectureKitTool prompt={prompt} />, beats: <MT.BeatsTool />, gaming: <MT.HighlightsTool mode="gaming" />, 'stream-shorts': <MT.HighlightsTool mode="stream" />, podcast: <MT.HighlightsTool mode="podcast" />,
  }[id] ?? <Empty icon={<ArrowLeft className="size-5" />} title="Coming soon" desc={f.note} />;

  return (
    <div>
      <Link to={`/app/hub/${cat.id}`} className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-paper mb-6"><ArrowLeft className="size-4" />{t(cat.key)}</Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div className="max-w-2xl">
          <Eyebrow className="mb-3">Tool #{String(f.n).padStart(2, '0')}</Eyebrow>
          <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl md:text-5xl leading-none">{f.name}</h1><StatusPill status={f.status} /></div>
          <p className="text-mute mt-3 leading-relaxed">{f.desc}</p>
          <div className="flex gap-4 mt-2"><ReadAloud text={`${f.name}. ${f.desc}. ${f.note}`} /></div>
        </div>
        {ProjectTool && project && <div className="flex items-center gap-3"><span className="text-sm text-dim">Project</span><ProjectPicker value={project.id} onChange={setProject} /></div>}
      </div>
      <Card className="p-4 mb-8 flex flex-col md:flex-row md:items-center gap-3 text-sm bg-white/[0.02]">
        <span className="text-mute flex-1">{f.note}</span>
        {f.needs?.map((n) => { const i = INTEGRATIONS.find((x) => x.id === n); const st = data?.[n]?.state ?? 'not_configured'; return i ? <span key={n} className="flex items-center gap-2 text-xs"><span className="text-dim">{i.provider}</span><StatusPill status={st} /></span> : null; })}
      </Card>
      {body}
    </div>
  );
}

import { motion } from 'framer-motion';
import { Activity, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CountUp, PageHeader, StatusPill, SeverityIcon } from '../components/ui';
import { useApp } from '../lib/useApp';
import { accessibilityInspector, qualityGate, retentionDoctor } from '../lib/analyzers';
import { projectDuration } from '../lib/project';
import { UsageChart } from './Dashboard';
import { FEATURES, featureRoute } from '../lib/features';

function Bars({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-sm">
          <span className="text-mute truncate">{d.label}</span>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: `${(d.value / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} className={`h-full rounded-full ${d.color}`} /></div>
          <span className="tabular text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { db, user, workspace, plan } = useApp();
  const jobs = db.jobs.filter((j) => j.userId === user.id);
  const renders = jobs.filter((j) => j.type === 'render');
  const ok = renders.filter((j) => j.status === 'succeeded');
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const ps = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt);
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id);
  const renderedSec = db.assets.filter((a) => a.workspaceId === workspace?.id && a.source === 'render' && a.type === 'video').reduce((s, a) => s + a.duration, 0);
  const spent = db.credits.filter((c) => c.userId === user.id && c.kind === 'charge').reduce((s, c) => s - c.amount, 0);
  const refunded = db.credits.filter((c) => c.userId === user.id && c.kind === 'refund').reduce((s, c) => s + c.amount, 0);
  const quality = ps.map((p) => ({
    p,
    gate: qualityGate(p, assets, { res: 720, maxRes: plan.maxRes }).filter((f) => f.severity === 'bad').length,
    ret: retentionDoctor(p).filter((f) => f.severity === 'bad' || f.severity === 'warn').length,
    a11y: accessibilityInspector(p).filter((f) => f.severity === 'bad' || f.severity === 'warn').length,
  }));
  const tools = FEATURES.filter((f) => f.cats.includes('analytics'));
  return (
    <div>
      <PageHeader eyebrow="Analytics & Quality" title="What’s really happening" desc="Every number here is computed from your own projects, jobs and ledger. Platform views and watch time appear only after you connect analytics." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[['Exports completed', ok.length], ['Minutes rendered', Math.round(renderedSec / 60)], ['Job success rate', jobs.length ? Math.round(((jobs.length - failed) / jobs.length) * 100) : 0], ['Credits spent (net)', spent - refunded]].map(([l, v], i) => (
          <Card key={l as string} className="p-5"><div className="text-xs text-dim">{l}</div><div className="font-display text-4xl mt-3"><CountUp value={v as number} suffix={i === 2 ? '%' : ''} /></div></Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-5"><div className="text-sm font-medium mb-4">Jobs by status</div><Bars data={[{ label: 'Succeeded', value: jobs.filter((j) => j.status === 'succeeded').length, color: 'bg-ok/70' }, { label: 'Failed', value: failed, color: 'bg-bad/70' }, { label: 'Canceled', value: jobs.filter((j) => j.status === 'canceled').length, color: 'bg-white/30' }, { label: 'Running/queued', value: jobs.filter((j) => j.status === 'running' || j.status === 'queued').length, color: 'bg-azure/70' }]} /></Card>
        <Card className="p-5"><div className="text-sm font-medium mb-4">Projects by format</div><Bars data={(['16:9', '9:16', '1:1', '4:5'] as const).map((a, i) => ({ label: a, value: ps.filter((p) => p.aspect === a).length, color: ['bg-azure/70', 'bg-violet/70', 'bg-amber/70', 'bg-paper/50'][i] }))} /></Card>
        <Card className="p-5 lg:col-span-2"><div className="text-sm font-medium mb-4">Credits used per day</div><UsageChart userId={user.id} days={30} /></Card>
      </div>
      <Card className="p-5 mb-8 overflow-x-auto">
        <div className="flex items-center gap-2 text-sm font-medium mb-4"><Activity className="size-4 text-amber" />Quality across projects</div>
        <table className="w-full text-sm min-w-[600px]"><thead><tr className="text-xs text-dim text-left"><th className="pb-2">Project</th><th>Length</th><th>Export blockers</th><th>Retention flags</th><th>Accessibility flags</th></tr></thead>
          <tbody>{quality.map(({ p, gate, ret, a11y }) => <tr key={p.id} className="border-t border-line"><td className="py-2.5"><Link to={`/app/editor/${p.id}`} className="hover:text-amber">{p.title}</Link></td><td className="font-mono text-xs">{projectDuration(p).toFixed(1)}s</td>
            {[[gate, 'quality'], [ret, 'retention'], [a11y, 'a11y']].map(([n, tool]) => <td key={tool as string}><Link to={`/app/tool/${tool}?project=${p.id}`} className="inline-flex items-center gap-1.5"><SeverityIcon s={(n as number) ? (tool === 'quality' ? 'bad' : 'warn') : 'ok'} className="size-3.5" />{n as number}</Link></td>)}</tr>)}</tbody></table>
        {!quality.length && <p className="text-sm text-dim">No projects yet.</p>}
      </Card>
      <Card className="p-5 mb-8 flex flex-col md:flex-row md:items-center gap-4">
        <BarChart3 className="size-6 text-mute" />
        <div className="flex-1"><div className="font-medium">Views, retention curves, CTR</div><p className="text-sm text-mute">Requires connecting YouTube / Meta / TikTok analytics. We never estimate or simulate audience data.</p></div>
        <StatusPill status="not_configured" /><Link to="/app/trust" className="text-sm text-amber hover:underline">Integrations</Link>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">{tools.map((f) => <Link key={f.id} to={featureRoute(f)} className="rounded-2xl hairline p-4 hover:bg-white/[0.03]"><div className="flex justify-between items-start gap-2"><span className="font-medium text-sm">{f.name}</span><StatusPill status={f.status} /></div><p className="text-xs text-dim mt-1.5">{f.desc}</p></Link>)}</div>
    </div>
  );
}

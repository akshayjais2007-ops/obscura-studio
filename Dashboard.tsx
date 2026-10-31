import { motion } from 'framer-motion';
import { ArrowRight, Clapperboard, Coins, Film, Plus, Sparkles, Wand2, FolderOpen, Gauge } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CountUp, Eyebrow, Input, StatusPill, useToast, Empty } from '../components/ui';
import { AssetThumb, VoiceButton } from '../components/shared';
import { JobsList } from '../components/JobsList';
import { useApp } from '../lib/useApp';
import { useT } from '../lib/i18n';
import { FEATURES, featureRoute, routeRequest } from '../lib/features';
import { ago } from '../lib/id';
import { projectDuration } from '../lib/project';
import { loadSampleProject } from '../lib/sample';
import { fadeUp, staggerKids } from '../lib/motion';
import { tc } from '../lib/id';

export function UsageChart({ userId, days = 14 }: { userId: string; days?: number }) {
  const { db } = useApp();
  const now = Date.now();
  const buckets = Array.from({ length: days }, (_, i) => {
    const start = new Date(now - (days - 1 - i) * 864e5); start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 864e5;
    const spent = db.credits.filter((c) => c.userId === userId && c.at >= start.getTime() && c.at < end).reduce((a, c) => a + (c.kind === 'charge' ? -c.amount : c.kind === 'refund' ? -c.amount : 0), 0);
    return { day: start, v: Math.max(0, spent) };
  });
  const max = Math.max(1, ...buckets.map((b) => b.v));
  return (
    <div className="flex items-end gap-1.5 h-28" role="img" aria-label={`Net credits used per day for the last ${days} days`}>
      {buckets.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
          <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }} style={{ height: `${Math.max(3, (b.v / max) * 100)}%`, transformOrigin: 'bottom' }} className={b.v ? 'w-full rounded-md bg-gradient-to-t from-violet/60 to-amber/80' : 'w-full rounded-md bg-white/[0.06]'} title={`${b.day.toLocaleDateString()}: ${b.v} credits`} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, db, workspace, balance, plan, sub } = useApp();
  const t = useT();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const projects = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  const exports = db.assets.filter((a) => a.workspaceId === workspace?.id && a.source === 'render' && !a.deletedAt);
  const periodSpent = db.credits.filter((c) => c.userId === user.id && sub && c.at >= sub.periodStart).reduce((a, c) => a + (c.kind === 'charge' || c.kind === 'refund' ? -c.amount : 0), 0);
  const routed = q.trim() ? routeRequest(q) : null;
  const suggested = FEATURES.filter((f) => f.cats.includes((user.intent as never) ?? 'create')).slice(0, 4);
  const firstThumb = (pid: string) => {
    const p = db.projects.find((x) => x.id === pid);
    const c = p?.tracks.flatMap((t) => t.clips).find((c) => c.assetId && (c.kind === 'image' || c.kind === 'video'));
    return c ? db.assets.find((a) => a.id === c.assetId) : undefined;
  };
  const sample = async () => {
    setLoading('Starting…');
    try { const { id, skipped } = await loadSampleProject(user.id, workspace.id, setLoading); toast(skipped.length ? `Sample ready, but ${skipped.length} file(s) were skipped: ${skipped[0]}` : 'Sample project ready — it’s labeled “demo”.', skipped.length ? 'warn' : 'ok'); nav(`/app/editor/${id}`); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setLoading(null); }
  };
  const hour = new Date().getHours();

  return (
    <motion.div variants={staggerKids()} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-10">
        <Eyebrow className="mb-3">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</Eyebrow>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight">{t('greeting')}, <span className="italic">{user.name.split(' ')[0]}</span>.</h1>
      </motion.div>

      {/* Universal create */}
      <motion.div variants={fadeUp}>
        <Card className="relative overflow-hidden p-6 md:p-8 mb-8 bg-gradient-to-br from-panel via-panel to-[#1a1626]">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-violet/10 blur-3xl" aria-hidden />
          <div className="relative">
            <label htmlFor="uc" className="font-display text-3xl md:text-4xl block">What do you want to make today?</label>
            <p className="text-sm text-mute mt-1.5">Describe it in your own words. We’ll pick the right workflow.</p>
            <form className="mt-5 flex flex-col md:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (routed) nav(`${featureRoute(routed.feature)}${featureRoute(routed.feature).includes('?') ? '&' : '?'}prompt=${encodeURIComponent(q)}`); else nav('/app/create'); }}>
              <Input id="uc" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. a 30-second ad for my bakery’s new sourdough" className="h-13 text-base flex-1" />
              <VoiceButton onText={setQ} className="h-13" />
              <Button variant="primary" size="lg" type="submit" icon={<Sparkles className="size-5" />}>Create</Button>
            </form>
            {routed && <p className="text-sm mt-3 text-mute">→ <span className="text-paper">{routed.feature.name}</span> <span className="text-dim">({routed.why})</span></p>}
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Credits available', v: balance, icon: Coins, to: '/app/billing', sub: `${plan.name} plan` },
          { label: 'Used this period', v: periodSpent, icon: Gauge, to: '/app/billing', sub: sub ? `renews ${new Date(sub.periodEnd).toLocaleDateString()}` : '' },
          { label: 'Projects', v: projects.length, icon: FolderOpen, to: '/app/projects', sub: workspace?.name },
          { label: 'Exports', v: exports.length, icon: Film, to: '/app/projects?tab=exports', sub: 'real files' },
        ].map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="p-5 hover:bg-raise transition-colors h-full">
              <div className="flex items-center justify-between text-dim"><span className="text-xs">{s.label}</span><s.icon className="size-4" /></div>
              <div className="font-display text-4xl mt-3"><CountUp value={s.v} /></div>
              <div className="text-xs text-dim mt-1 truncate">{s.sub}</div>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-8">
        <motion.div variants={fadeUp}>
          <div className="flex items-end justify-between mb-4"><h2 className="font-display text-3xl">{t('recent')}</h2><Link to="/app/projects" className="text-sm text-mute hover:text-paper">All projects →</Link></div>
          {projects.length === 0 ? (
            <Empty icon={<Clapperboard className="size-5" />} title="Your first project starts here" desc="Create from an idea, or open a ready-made sample to see how everything works."
              action={<div className="flex flex-wrap gap-2 justify-center"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav('/app/create')}>Create a video</Button><Button loading={!!loading} onClick={sample}>{loading ?? 'Open sample project'}</Button></div>} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.slice(0, 6).map((p) => (
                <Link key={p.id} to={`/app/editor/${p.id}`} className="group">
                  <Card className="overflow-hidden hover:border-line2 transition-colors">
                    <div className="relative aspect-video bg-raise overflow-hidden">
                      <AssetThumb asset={firstThumb(p.id)} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex justify-between text-xs"><span className="font-mono">{tc(projectDuration(p))}</span><span className="rounded bg-black/50 px-1.5">{p.aspect}</span></div>
                      {p.demo && <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-amber text-ink rounded px-1.5 py-0.5 font-semibold">Demo</span>}
                    </div>
                    <div className="p-4"><div className="font-medium truncate">{p.title}</div><div className="text-xs text-dim mt-0.5">Edited {ago(p.updatedAt)} · {p.stage}</div></div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {projects.length > 0 && !projects.some((p) => p.demo) && <button onClick={sample} disabled={!!loading} className="mt-4 text-sm text-mute hover:text-paper">{loading ?? '+ Add the sample project'}</button>}
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-8">
          <div>
            <div className="flex items-end justify-between mb-4"><h2 className="font-display text-3xl">Jobs</h2><Link to="/app/projects?tab=jobs" className="text-sm text-mute hover:text-paper">All →</Link></div>
            <JobsList limit={4} />
          </div>
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4"><span className="text-sm font-medium">Credits used · 14 days</span><Link to="/app/billing" className="text-xs text-mute hover:text-paper">Ledger →</Link></div>
            <UsageChart userId={user.id} />
          </Card>
          <div>
            <h2 className="font-display text-3xl mb-4">Suggested for you</h2>
            <div className="space-y-2">
              {suggested.map((f) => (
                <Link key={f.id} to={featureRoute(f)} className="flex items-center gap-3 rounded-2xl hairline p-4 hover:bg-white/[0.03]">
                  <Wand2 className="size-4 text-amber shrink-0" />
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium">{f.name}</div><div className="text-xs text-dim truncate">{f.desc}</div></div>
                  <StatusPill status={f.status} /><ArrowRight className="size-4 text-dim" />
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

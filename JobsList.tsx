import { Ban, Download, RotateCcw, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cancelJob, retryJob, InsufficientCredits } from '../lib/jobs';
import { useApp } from '../lib/useApp';
import { Button, Progress, cx, useToast, download, Empty } from './ui';
import { ago, bytes } from '../lib/id';
import { getBlob } from '../lib/idb';
import type { Job } from '../lib/types';

export function JobRow({ job }: { job: Job }) {
  const { db } = useApp();
  const toast = useToast();
  const out = job.outputAssetId ? db.assets.find((a) => a.id === job.outputAssetId) : undefined;
  const icon = { queued: <Clock className="size-4 text-dim" />, running: <Loader2 className="size-4 text-azure animate-spin" />, succeeded: <CheckCircle2 className="size-4 text-ok" />, failed: <XCircle className="size-4 text-bad" />, canceled: <Ban className="size-4 text-dim" /> }[job.status];
  return (
    <div className="rounded-2xl hairline p-4 bg-white/[0.02]">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{job.label}</div>
          <div className="text-xs text-dim">{job.status === 'running' ? `Running · ${Math.round(job.progress * 100)}%` : job.status} · {ago(job.createdAt)}{job.credits ? ` · ${job.credits} credits${job.status === 'failed' || job.status === 'canceled' ? ' refunded' : ''}` : ' · free'}{job.attempt > 1 ? ` · attempt ${job.attempt}` : ''}</div>
        </div>
        {(job.status === 'running' || job.status === 'queued') && <Button size="sm" variant="quiet" icon={<Ban className="size-3.5" />} onClick={() => cancelJob(job.id)}>Cancel</Button>}
        {(job.status === 'failed' || job.status === 'canceled') && <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => { try { retryJob(job.id); toast('Retrying…', 'info'); } catch (e) { toast(e instanceof InsufficientCredits ? e.message : (e as Error).message, 'warn'); } }}>Retry</Button>}
        {out && !out.deletedAt && <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={async () => { const b = await getBlob(out.id); if (b) download(b, out.name); else toast('The file is no longer stored on this device.', 'bad'); }}>{bytes(out.size)}</Button>}
      </div>
      {job.status === 'running' && <Progress value={job.progress} className="mt-3" />}
      {job.error && <p className="text-xs text-bad mt-2 leading-relaxed">{job.error}{job.error.startsWith('Integration required') && <> <Link to="/app/trust" className="underline">Open integrations</Link></>}</p>}
    </div>
  );
}

export function JobsList({ limit, projectId }: { limit?: number; projectId?: string }) {
  const { db, user } = useApp();
  const jobs = db.jobs.filter((j) => j.userId === user.id && (!projectId || j.projectId === projectId)).slice(0, limit);
  if (!jobs.length) return <Empty icon={<Clock className="size-5" />} title="No jobs yet" desc="Exports and AI tasks appear here with their real status." />;
  return <div className={cx('space-y-2')}>{jobs.map((j) => <JobRow key={j.id} job={j} />)}</div>;
}

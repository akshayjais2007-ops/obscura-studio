import { AlertTriangle, Clapperboard, Monitor } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Dialog, cx, useToast } from '../ui';
import { FindingList } from '../shared';
import { JobRow } from '../JobsList';
import { qualityGate } from '../../lib/analyzers';
import { applyFix, removeMissing } from '../../lib/edits';
import { exportSupported, pickMime } from '../../lib/engine';
import { enqueue, InsufficientCredits } from '../../lib/jobs';
import { renderCost } from '../../lib/plans';
import { dims, projectDuration } from '../../lib/project';
import { useApp } from '../../lib/useApp';
import type { Project } from '../../lib/types';
import { tc } from '../../lib/id';

export default function ExportDialog({ open, onClose, project, onApply, flush }: { open: boolean; onClose: () => void; project: Project; onApply: (p: Project) => void; flush: () => void }) {
  const { db, user, plan, balance, allow } = useApp();
  const toast = useToast();
  const [res, setRes] = useState<480 | 720 | 1080>(720);
  const [jobId, setJobId] = useState<string | null>(null);
  const duration = projectDuration(project);
  const assets = db.assets.filter((a) => a.workspaceId === project.workspaceId);
  const findings = useMemo(() => qualityGate(project, assets, { res, maxRes: plan.maxRes }), [project, assets, res, plan.maxRes]);
  const blocking = findings.some((f) => f.severity === 'bad');
  const draft = res === 480;
  const cost = renderCost(duration, draft, db.config);
  const job = jobId ? db.jobs.find((j) => j.id === jobId) : undefined;
  const supported = exportSupported();
  const mime = pickMime();

  const fix = (fixId: string) => {
    if (fixId === 'remove-missing') onApply(removeMissing(project, new Set(assets.filter((a) => !a.deletedAt).map((a) => a.id))));
    else onApply(applyFix(project, fixId));
    toast('Fixed. You can undo in the editor.', 'ok');
  };
  const start = () => {
    if (!allow('render', project.workspaceId)) { toast('Your role can’t export in this workspace. Ask an owner or editor.', 'warn'); return; }
    flush();
    try {
      const id = enqueue(user.id, 'render', `${project.title} · ${res}p${draft ? ' draft' : ''}`, { res, draft }, { projectId: project.id, credits: cost });
      setJobId(id);
    } catch (e) { toast(e instanceof InsufficientCredits ? e.message : (e as Error).message, 'warn'); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Export video" wide>
      {!supported && <div className="rounded-2xl bg-bad/10 border border-bad/30 p-4 text-sm mb-5 flex gap-3"><AlertTriangle className="size-5 text-bad shrink-0" /><div>This browser can’t record video. Use a recent Chrome, Edge or Firefox on desktop. Cloud rendering (background, any device) needs the render integration — <Link to="/app/trust" className="underline">see setup</Link>.</div></div>}
      <div className="grid md:grid-cols-3 gap-2 mb-6" role="radiogroup" aria-label="Resolution">
        {([480, 720, 1080] as const).map((r) => {
          const d = dims(project.aspect, r);
          const over = r > plan.maxRes;
          return (
            <button key={r} role="radio" aria-checked={res === r} disabled={over} onClick={() => setRes(r)} className={cx('rounded-2xl hairline p-4 text-left transition-colors disabled:opacity-40', res === r ? 'bg-paper text-ink' : 'bg-coal hover:bg-raise')}>
              <div className="flex items-center gap-2"><Monitor className="size-4" /><span className="font-medium">{r === 480 ? 'Draft' : r === 720 ? 'HD' : 'Full HD'}</span></div>
              <div className={cx('text-xs mt-1 font-mono', res === r ? 'text-ink/60' : 'text-dim')}>{d.w}×{d.h} · {project.fps}fps</div>
              <div className={cx('text-xs mt-2', res === r ? 'text-ink/80' : 'text-mute')}>{over ? `Needs a higher plan` : `${renderCost(duration, r === 480, db.config) || 'Free'}${renderCost(duration, r === 480, db.config) ? ' credits' : ''}`}</div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
        {[['Length', tc(duration)], ['Render time', `≈ ${tc(duration + 2)} (real time)`], ['Cost', cost ? `${cost} credits` : 'Free'], ['Balance after', `${balance - cost}`]].map(([a, b]) => <div key={a} className="rounded-xl hairline p-3"><div className="text-xs text-dim">{a}</div><div className="mt-1 tabular">{b}</div></div>)}
      </div>
      <div className="text-sm font-medium mb-3">Export Quality Gate</div>
      <FindingList findings={findings} onFix={(f) => f.fixId && fix(f.fixId)} />
      <div className="mt-6 rounded-2xl bg-white/[0.03] hairline p-4 text-xs text-mute leading-relaxed">
        Rendering happens in this tab, in real time, from your actual timeline. Keep the tab visible until it finishes. Output: <span className="text-paper font-mono">{mime.split(';')[0] || 'unsupported'}</span>. Credits are reserved when the job starts and fully refunded if it fails or you cancel.
      </div>
      {job && <div className="mt-5"><JobRow job={job} /></div>}
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="quiet" onClick={onClose}>Close</Button>
        <Button variant="primary" size="lg" icon={<Clapperboard className="size-4" />} disabled={!supported || blocking || job?.status === 'running' || job?.status === 'queued' || duration <= 0} onClick={start}>
          {blocking ? 'Fix blocking issues first' : job?.status === 'running' ? 'Rendering…' : `Export ${res}p`}
        </Button>
      </div>
    </Dialog>
  );
}

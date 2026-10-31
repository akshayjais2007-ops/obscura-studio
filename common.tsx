import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getDB } from '../../lib/db';
import { saveProject, snapshot } from '../../lib/project';
import type { Project } from '../../lib/types';
import { Card, StatusPill } from '../../components/ui';
import { INTEGRATIONS } from '../../lib/integrations';

/** Save a transformed project with a recovery snapshot, and return an undo function. */
export function commitProject(p: Project, next: Project, label: string) {
  snapshot(p.id, `Before: ${label}`);
  const prev = getDB().projects.find((x) => x.id === p.id)!;
  const before = structuredClone({ tracks: prev.tracks, scenes: prev.scenes, aspect: prev.aspect, script: prev.script, title: prev.title });
  saveProject(p.id, { tracks: next.tracks, scenes: next.scenes, aspect: next.aspect, script: next.script, title: next.title });
  return () => saveProject(p.id, before);
}

export function PendingPanel({ needs, what, now }: { needs: string[]; what: string; now?: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3"><Lock className="size-4 text-mute" /><span className="font-medium">Integration required</span></div>
      <p className="text-sm text-mute leading-relaxed max-w-2xl">{what}</p>
      <div className="mt-5 space-y-2">
        {needs.map((n) => { const i = INTEGRATIONS.find((x) => x.id === n); return i ? <div key={n} className="flex flex-wrap items-center gap-3 text-sm"><StatusPill status="not_configured" /><span>{i.label}</span><span className="font-mono text-xs text-dim">{i.envVars.join(', ')}</span></div> : null; })}
      </div>
      <p className="text-sm mt-5"><Link to="/app/trust" className="text-amber hover:underline">Check live integration status</Link> · <Link to="/app/docs" className="text-amber hover:underline">Setup guide</Link></p>
      {now && <div className="mt-6 pt-6 border-t border-line">{now}</div>}
    </Card>
  );
}

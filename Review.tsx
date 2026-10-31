import { Check, CheckCircle2, MessageSquare, Pause, Play, RotateCcw, XCircle, Flag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Empty, Eyebrow, Textarea, cx, useToast } from '../components/ui';
import { useApp } from '../lib/useApp';
import { audit, notify, update } from '../lib/db';
import { Engine } from '../lib/engine';
import { blobUrl } from '../lib/idb';
import { projectDuration } from '../lib/project';
import { tc, uid, ago } from '../lib/id';
import type { Project } from '../lib/types';

function LivePreview({ project, onTime, seekTo }: { project: Project; onTime: (t: number) => void; seekTo: number | null }) {
  const { db } = useApp();
  const canvas = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const [playing, setPlaying] = useState(false);
  const t = useRef(0);
  const dur = projectDuration(project);
  useEffect(() => {
    const e = new Engine(canvas.current!, project, db.assets.filter((a) => a.workspaceId === project.workspaceId), { short: 540 });
    eng.current = e;
    e.onRedraw = () => e.draw(t.current);
    e.prepare().then(() => { e.sync(0, false); e.draw(0); });
    return () => e.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  useEffect(() => { if (seekTo !== null && eng.current) { t.current = seekTo; eng.current.sync(seekTo, false); eng.current.draw(seekTo); onTime(seekTo); } }, [seekTo]); // eslint-disable-line react-hooks/exhaustive-deps
  const play = () => {
    if (!eng.current) return;
    setPlaying(true);
    const t0 = performance.now(), base = t.current >= dur ? 0 : t.current;
    let run = true;
    const tick = (now: number) => {
      if (!run || !eng.current) return;
      const x = base + (now - t0) / 1000;
      if (x >= dur) { setPlaying(false); eng.current.pauseAll(); return; }
      t.current = x; eng.current.sync(x, true); eng.current.draw(x); onTime(x);
      if (playingRef.current) requestAnimationFrame(tick); else { run = false; eng.current.pauseAll(); }
    };
    playingRef.current = true;
    requestAnimationFrame(tick);
  };
  const playingRef = useRef(false);
  const pause = () => { playingRef.current = false; setPlaying(false); eng.current?.pauseAll(); };
  return (
    <div>
      <canvas ref={canvas} className="w-full rounded-2xl bg-black" style={{ aspectRatio: project.aspect.replace(':', ' / '), maxHeight: '60vh', objectFit: 'contain' }} aria-label="Preview" />
      <div className="flex items-center gap-3 mt-3"><button onClick={() => (playing ? pause() : play())} className="size-11 rounded-full bg-paper text-ink grid place-items-center" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}</button><span className="text-xs text-dim">Live preview of the current edit</span></div>
    </div>
  );
}

export default function Review() {
  const { id } = useParams();
  const { db, user, allow } = useApp();
  const toast = useToast();
  const p = db.projects.find((x) => x.id === id && !x.deletedAt);
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const render = p ? db.assets.find((a) => a.projectId === p.id && a.source === 'render' && a.type === 'video' && !a.deletedAt) : undefined;
  useEffect(() => { if (render) blobUrl(render.id).then(setUrl); }, [render]);
  if (!p) return <Empty icon={<MessageSquare className="size-5" />} title="Project not found" desc="It may have been deleted." />;
  if (!allow('view', p.workspaceId)) return <Empty icon={<MessageSquare className="size-5" />} title="No access" desc="Ask the owner to add you as a reviewer." />;
  const canComment = allow('comment', p.workspaceId);
  const canApprove = allow('approve', p.workspaceId);
  const comments = db.comments.filter((c) => c.projectId === p.id).sort((a, b) => a.time - b.time);
  const approvals = db.approvals.filter((a) => a.projectId === p.id);
  const jump = (t: number) => { if (vid.current) { vid.current.currentTime = t; } else setSeek(t + Math.random() * 1e-4); };
  const add = () => {
    if (!text.trim()) return;
    update((d) => { d.comments.push({ id: uid('cm_'), projectId: p.id, author: user.name, time: +time.toFixed(2), text: text.trim(), resolved: false, at: Date.now() }); });
    if (p.ownerId !== user.id) notify(p.ownerId, `${user.name} commented at ${tc(time)} on “${p.title}”`, 'info', `/app/review/${p.id}`);
    audit(user.id, 'review.comment', p.id);
    setText('');
  };
  const decide = (decision: 'approved' | 'changes_requested') => {
    update((d) => {
      d.approvals.unshift({ id: uid('ap_'), projectId: p.id, decision, by: user.name, note: note.trim(), at: Date.now() });
      const x = d.projects.find((y) => y.id === p.id)!;
      x.review = decision; if (decision === 'approved') x.stage = 'delivered'; else x.stage = 'editing';
    });
    if (p.ownerId !== user.id) notify(p.ownerId, `${user.name} ${decision === 'approved' ? 'approved' : 'requested changes on'} “${p.title}”`, decision === 'approved' ? 'ok' : 'warn', `/app/review/${p.id}`);
    audit(user.id, `review.${decision}`, p.id, note);
    setNote('');
    toast(decision === 'approved' ? 'Approved.' : 'Change request sent.', 'ok');
  };
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div><Eyebrow className="mb-3">Client review</Eyebrow><h1 className="font-display text-4xl md:text-5xl">{p.title}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm"><span className={cx('rounded-full px-2.5 py-0.5 text-xs', p.review === 'approved' ? 'bg-ok/15 text-ok' : p.review === 'changes_requested' ? 'bg-warn/15 text-warn' : 'bg-white/5 text-mute')}>{p.review.replace('_', ' ')}</span>{allow('edit', p.workspaceId) && <Link to={`/app/editor/${p.id}`} className="text-mute hover:text-paper">Open editor →</Link>}</div></div>
        {allow('edit', p.workspaceId) && p.review === 'draft' && <Button onClick={() => update((d) => { const x = d.projects.find((y) => y.id === p.id)!; x.review = 'in_review'; x.stage = 'review'; })}>Send for review</Button>}
      </div>
      <div className="grid xl:grid-cols-[1fr_400px] gap-6">
        <div>
          {url ? (
            <>
              <video ref={vid} src={url} controls className="w-full rounded-2xl bg-black max-h-[60vh]" onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} />
              <p className="text-xs text-dim mt-2">Reviewing export “{render!.name}” · {ago(render!.createdAt)}. Newer edits need a fresh export.</p>
            </>
          ) : <LivePreview project={p} onTime={setTime} seekTo={seek} />}
          {/* comment markers */}
          <div className="relative h-6 mt-4 rounded bg-white/[0.04]" aria-label="Comment markers">
            {comments.map((c) => <button key={c.id} onClick={() => jump(c.time)} className={cx('absolute top-1 size-4 -translate-x-1/2 rounded-full', c.resolved ? 'bg-ok/60' : 'bg-amber')} style={{ left: `${(c.time / Math.max(1, render?.duration ?? projectDuration(p))) * 100}%` }} aria-label={`Comment at ${tc(c.time)}`} />)}
          </div>
          {canComment && (
            <Card className="p-4 mt-4">
              <div className="flex items-center gap-2 text-xs text-mute mb-2"><MessageSquare className="size-3.5" />Comment at <span className="font-mono text-amber">{tc(time)}</span></div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What should change here?" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }} />
              <div className="flex justify-end mt-2"><Button size="sm" variant="primary" onClick={add} disabled={!text.trim()}>Post comment</Button></div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {canApprove && (
            <Card className="p-5">
              <div className="font-medium mb-3">Decision</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" rows={2} />
              <div className="grid grid-cols-2 gap-2 mt-3"><Button variant="primary" icon={<CheckCircle2 className="size-4" />} onClick={() => decide('approved')}>Approve</Button><Button icon={<XCircle className="size-4" />} onClick={() => decide('changes_requested')}>Request changes</Button></div>
            </Card>
          )}
          <Card className="p-5">
            <div className="font-medium mb-3">Feedback ({comments.filter((c) => !c.resolved).length} open)</div>
            <ul className="space-y-2 max-h-[420px] overflow-y-auto scroll-thin">
              {comments.map((c) => (
                <li key={c.id} className={cx('rounded-xl hairline p-3 text-sm', c.resolved && 'opacity-50')}>
                  <div className="flex justify-between gap-2"><button onClick={() => jump(c.time)} className="font-mono text-xs text-azure hover:underline">{tc(c.time)}</button><span className="text-xs text-dim">{c.author} · {ago(c.at)}</span></div>
                  <p className="mt-1">{c.text}</p>
                  {allow('edit', p.workspaceId) && <button onClick={() => update((d) => { const x = d.comments.find((y) => y.id === c.id); if (x) x.resolved = !x.resolved; })} className="text-xs text-mute hover:text-paper mt-1.5 inline-flex items-center gap-1">{c.resolved ? <><RotateCcw className="size-3" />Reopen</> : <><Check className="size-3" />Resolve</>}</button>}
                </li>
              ))}
              {!comments.length && <li className="text-sm text-dim">No comments yet.</li>}
            </ul>
          </Card>
          <Card className="p-5"><div className="font-medium mb-3">History</div><ul className="text-sm space-y-1.5">{approvals.map((a) => <li key={a.id}><span className={a.decision === 'approved' ? 'text-ok' : 'text-warn'}>{a.decision.replace('_', ' ')}</span> by {a.by} <span className="text-dim text-xs">· {ago(a.at)}</span>{a.note && <div className="text-xs text-mute">“{a.note}”</div>}</li>)}{!approvals.length && <li className="text-dim">No decisions yet.</li>}</ul></Card>
          <p className="text-xs text-dim flex gap-1.5"><Flag className="size-3.5 shrink-0" />Reviewers must be members of this workspace on this device. Public review links need the hosted database integration.</p>
        </div>
      </div>
    </div>
  );
}

import { Building2, Plus, Trash2, Users, CalendarClock, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Empty, Field, Input, PageHeader, Select, Tabs, cx, useConfirm, useToast } from '../components/ui';
import { useApp, setActiveWorkspace } from '../lib/useApp';
import { audit, notify, roleIn, update } from '../lib/db';
import { uid } from '../lib/id';
import { validateEmail } from '../lib/auth';
import type { PipelineStage, Role } from '../lib/types';

const STAGES: { id: PipelineStage; label: string }[] = [{ id: 'idea', label: 'Idea' }, { id: 'scripting', label: 'Scripting' }, { id: 'editing', label: 'Editing' }, { id: 'review', label: 'In review' }, { id: 'delivered', label: 'Delivered' }];

export default function Agency() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'spaces') as 'spaces' | 'pipeline' | 'reviews';
  return (
    <div>
      <PageHeader eyebrow="Agency & Teams" title="Clients, roles & delivery" desc="Workspaces keep each client’s projects, media and brand kits separate. Roles control who can edit, render, approve or manage." />
      <Tabs className="mb-8" value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ id: 'spaces', label: 'Workspaces & members' }, { id: 'pipeline', label: 'Pipeline' }, { id: 'reviews', label: 'Reviews' }]} />
      {tab === 'spaces' && <Spaces />}
      {tab === 'pipeline' && <Pipeline />}
      {tab === 'reviews' && <Reviews />}
    </div>
  );
}

function Spaces() {
  const { db, user, workspaces, workspace, allow, plan } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'agency' | 'client'>('agency');
  const [parent, setParent] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const members = db.members.filter((m) => m.workspaceId === workspace?.id);
  const canManage = allow('manage');
  const create = () => {
    if (!name.trim()) return;
    const id = uid('ws_');
    update((d) => { d.workspaces.push({ id, name: name.trim(), ownerId: user.id, kind, parentId: kind === 'client' && parent ? parent : undefined, createdAt: Date.now() }); });
    audit(user.id, 'workspace.create', id, `${kind}: ${name}`);
    setName(''); setActiveWorkspace(id);
    toast(`“${name}” created and opened.`, 'ok');
  };
  const invite = () => {
    const e = email.trim().toLowerCase();
    if (!validateEmail(e)) { toast('Enter a valid email address.', 'warn'); return; }
    if (members.some((m) => m.email === e)) { toast('Already a member.', 'info'); return; }
    if (members.length + 1 >= plan.seats + 50 && plan.id === 'free' && members.length >= 3) { toast('Free plan workspaces can have up to 3 members.', 'warn'); return; }
    const u = db.users.find((x) => x.email === e);
    update((d) => { d.members.push({ id: uid('m_'), workspaceId: workspace.id, email: e, userId: u?.id, role, addedAt: Date.now() }); });
    if (u) notify(u.id, `${user.name} added you to “${workspace.name}” as ${role}.`, 'info', '/app');
    audit(user.id, 'member.add', workspace.id, `${e} as ${role}`);
    setEmail('');
    toast(u ? `${e} added.` : `${e} added — they’ll get access when they sign up with this email on this device.`, 'ok');
  };
  return (
    <div className="grid xl:grid-cols-[1fr_420px] gap-6">
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4"><div className="font-medium">Members of “{workspace?.name}”</div><span className="text-xs text-dim">Your role: {roleIn(db, user.id, workspace.id)}</span></div>
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center gap-3 text-sm"><span className="size-8 rounded-full bg-gradient-to-br from-violet to-amber grid place-items-center text-ink text-xs font-bold">{db.users.find((u) => u.id === workspace.ownerId)?.name[0]}</span><span className="flex-1">{db.users.find((u) => u.id === workspace.ownerId)?.email}</span><span className="text-xs text-amber">owner</span></li>
            {members.map((m) => (
              <li key={m.id} className="py-3 flex items-center gap-3 text-sm">
                <span className="size-8 rounded-full bg-white/10 grid place-items-center text-xs">{m.email[0].toUpperCase()}</span>
                <span className="flex-1 truncate">{m.email}{!m.userId && <span className="text-xs text-dim"> · invited</span>}</span>
                <Select disabled={!canManage} value={m.role} onChange={(e) => { update((d) => { const x = d.members.find((y) => y.id === m.id); if (x) x.role = e.target.value as Role; }); audit(user.id, 'member.role', m.email, e.target.value); }} className="w-32 py-1.5 text-xs" aria-label={`Role for ${m.email}`}>{(['admin', 'editor', 'reviewer', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}</Select>
                {canManage && <button aria-label={`Remove ${m.email}`} className="text-dim hover:text-bad" onClick={async () => { if (await confirm({ title: 'Remove member?', body: `${m.email} will lose access to ${workspace.name}.`, confirm: 'Remove', danger: true })) { update((d) => { d.members = d.members.filter((x) => x.id !== m.id); }); audit(user.id, 'member.remove', m.email); } }}><Trash2 className="size-4" /></button>}
              </li>
            ))}
          </ul>
          {canManage ? (
            <div className="flex flex-col md:flex-row gap-2 mt-4">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@studio.com" aria-label="Email to invite" />
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)} className="md:w-36" aria-label="Role"><option value="admin">Admin</option><option value="editor">Editor</option><option value="reviewer">Reviewer</option><option value="viewer">Viewer</option></Select>
              <Button icon={<Plus className="size-4" />} onClick={invite}>Add</Button>
            </div>
          ) : <p className="text-xs text-dim mt-4">Only owners and admins can manage members.</p>}
          <p className="text-xs text-dim mt-4">Email invitations and cross-device access need the hosted database + email provider. Members are matched by email on this device today.</p>
        </Card>
        <Card className="p-5">
          <div className="font-medium mb-3">What each role can do</div>
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[520px]"><thead><tr className="text-dim text-left"><th className="pb-2">Role</th>{['View', 'Comment', 'Edit', 'Render', 'Approve', 'Manage'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{([['owner', [1, 1, 1, 1, 1, 1]], ['admin', [1, 1, 1, 1, 1, 1]], ['editor', [1, 1, 1, 1, 0, 0]], ['reviewer', [1, 1, 0, 0, 1, 0]], ['viewer', [1, 0, 0, 0, 0, 0]]] as const).map(([r, p]) => <tr key={r} className="border-t border-line"><td className="py-2 capitalize">{r}</td>{p.map((v, i) => <td key={i} className={v ? 'text-ok' : 'text-dim'}>{v ? '✓' : '—'}</td>)}</tr>)}</tbody></table></div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="p-5">
          <div className="font-medium mb-3">Your workspaces</div>
          <ul className="space-y-1">{workspaces.map((w) => <li key={w.id}><button onClick={() => setActiveWorkspace(w.id)} className={cx('w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-left', w.id === workspace.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]')}>{w.kind === 'personal' ? <Users className="size-4 text-dim" /> : <Building2 className="size-4 text-dim" />}<span className="flex-1 truncate">{w.parentId && <span className="text-dim">{db.workspaces.find((p) => p.id === w.parentId)?.name} / </span>}{w.name}</span><span className="text-[10px] text-dim">{w.kind}</span></button></li>)}</ul>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="font-medium">New workspace</div>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northlight Agency · or · Client: Marigold Bakery" /></Field>
          <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as never)}><option value="agency">Agency</option><option value="client">Client space</option></Select></Field>
          {kind === 'client' && <Field label="Under agency" hint="Agency members inherit access to client spaces."><Select value={parent} onChange={(e) => setParent(e.target.value)}><option value="">None</option>{workspaces.filter((w) => w.kind === 'agency' && w.ownerId === user.id).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>}
          <Button variant="primary" onClick={create} disabled={!name.trim()}>Create</Button>
          <p className="text-xs text-dim">Per-client invoicing needs the payments integration.</p>
        </Card>
      </div>
    </div>
  );
}

function Pipeline() {
  const { db, workspace, user, allow } = useApp();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<PipelineStage | null>(null);
  const ps = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt);
  const canEdit = allow('edit');
  const move = (id: string, stage: PipelineStage) => { update((d) => { const p = d.projects.find((x) => x.id === id); if (p) { p.stage = stage; p.updatedAt = Date.now(); } }); audit(user.id, 'pipeline.move', id, stage); };
  const set = (id: string, patch: { assignee?: string; deadline?: string }) => update((d) => { const p = d.projects.find((x) => x.id === id); if (p) Object.assign(p, patch); });
  const today = new Date().toISOString().slice(0, 10);
  if (!ps.length) return <Empty icon={<CalendarClock className="size-5" />} title="No projects in this workspace" desc="Create a project to start tracking it." action={<Link to="/app/create"><Button variant="primary">Create</Button></Link>} />;
  return (
    <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-3">
      {STAGES.map((s) => (
        <div key={s.id} onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(s.id); } }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) move(drag, s.id); setDrag(null); setOver(null); }}
          className={cx('rounded-2xl hairline p-3 min-h-64 transition-colors', over === s.id ? 'bg-amber/[0.06] border-amber/40' : 'bg-coal/60')}>
          <div className="flex justify-between items-center px-1 mb-3"><span className="text-sm font-medium">{s.label}</span><span className="text-xs text-dim">{ps.filter((p) => p.stage === s.id).length}</span></div>
          <div className="space-y-2">
            {ps.filter((p) => p.stage === s.id).map((p) => (
              <div key={p.id} draggable={canEdit} onDragStart={() => setDrag(p.id)} className="rounded-xl bg-panel hairline p-3 text-sm cursor-grab active:cursor-grabbing">
                <Link to={`/app/editor/${p.id}`} className="font-medium hover:text-amber block truncate">{p.title}</Link>
                <input disabled={!canEdit} defaultValue={p.assignee ?? ''} onBlur={(e) => set(p.id, { assignee: e.target.value.trim() || undefined })} placeholder="Assignee" aria-label="Assignee" className="mt-2 w-full bg-transparent text-xs text-mute placeholder:text-dim focus:outline-none" />
                <div className="flex items-center gap-2 mt-1">
                  <input type="date" disabled={!canEdit} defaultValue={p.deadline ?? ''} onChange={(e) => set(p.id, { deadline: e.target.value || undefined })} aria-label="Deadline" className={cx('bg-transparent text-xs focus:outline-none', p.deadline && p.deadline < today && p.stage !== 'delivered' ? 'text-bad' : 'text-dim')} />
                  {p.deadline && p.deadline < today && p.stage !== 'delivered' && <span className="text-[10px] text-bad">overdue</span>}
                </div>
                <Select disabled={!canEdit} value={p.stage} onChange={(e) => move(p.id, e.target.value as PipelineStage)} className="mt-2 py-1 text-[11px] md:hidden" aria-label="Move to stage">{STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Reviews() {
  const { db, workspace } = useApp();
  const ps = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt && p.review !== 'draft');
  if (!ps.length) return <Empty icon={<MessageSquare className="size-5" />} title="Nothing in review" desc="Open a project’s Review page and press “Send for review”." />;
  return (
    <div className="space-y-2">{ps.map((p) => { const open = db.comments.filter((c) => c.projectId === p.id && !c.resolved).length; return (
      <Link key={p.id} to={`/app/review/${p.id}`} className="flex items-center gap-4 rounded-2xl hairline p-4 hover:bg-white/[0.03]">
        <span className={cx('rounded-full px-2.5 py-0.5 text-xs', p.review === 'approved' ? 'bg-ok/15 text-ok' : p.review === 'changes_requested' ? 'bg-warn/15 text-warn' : 'bg-azure/15 text-azure')}>{p.review.replace('_', ' ')}</span>
        <span className="flex-1 truncate">{p.title}</span><span className="text-xs text-dim">{open} open comment{open === 1 ? '' : 's'}</span>
      </Link>
    ); })}</div>
  );
}

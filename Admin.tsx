import { ShieldAlert, Ban, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Input, PageHeader, Select, Tabs, cx, useConfirm, useToast } from '../components/ui';
import { useApp } from '../lib/useApp';
import { addCredits, audit, balanceOf, update } from '../lib/db';
import { PLANS, planById } from '../lib/plans';
import { cancelJob, retryJob } from '../lib/jobs';
import { ago } from '../lib/id';
import type { PlanId } from '../lib/types';

type Tab = 'users' | 'jobs' | 'reports' | 'audit' | 'errors' | 'config';

export default function Admin() {
  const { db, user } = useApp();
  const [tab, setTab] = useState<Tab>('users');
  const toast = useToast();
  const confirm = useConfirm();
  const [grant, setGrant] = useState<Record<string, string>>({});
  if (user.role !== 'admin') return <Navigate to="/app" replace />;
  const name = (id: string) => db.users.find((u) => u.id === id)?.email ?? id;
  return (
    <div>
      <PageHeader eyebrow="Admin console" title="Operations" desc="Every admin action is written to the audit log with your account." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Users', count: db.users.length }, { id: 'jobs', label: 'Jobs', count: db.jobs.length }, { id: 'reports', label: 'Reports', count: db.reports.filter((r) => r.status === 'open').length }, { id: 'audit', label: 'Audit log' }, { id: 'errors', label: 'Errors', count: db.errors.length }, { id: 'config', label: 'Pricing config' }]} />
      {tab === 'users' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]"><thead><tr className="text-xs text-dim text-left"><th className="p-4">User</th><th>Role</th><th>Plan</th><th>Credits</th><th>Grant / deduct</th><th>Status</th></tr></thead>
            <tbody>{db.users.map((u) => { const sub = db.subscriptions.find((s) => s.userId === u.id); return (
              <tr key={u.id} className="border-t border-line">
                <td className="p-4"><div>{u.name}</div><div className="text-xs text-dim">{u.email} · joined {ago(u.createdAt)}</div></td>
                <td><Select value={u.role} disabled={u.id === user.id} onChange={(e) => { update((d) => { d.users.find((x) => x.id === u.id)!.role = e.target.value as 'user' | 'admin'; }); audit(user.id, 'admin.role', u.email, e.target.value); }} className="w-24 py-1 text-xs"><option value="user">user</option><option value="admin">admin</option></Select></td>
                <td><Select value={sub?.plan ?? 'free'} onChange={async (e) => { const plan = e.target.value as PlanId; if (!(await confirm({ title: `Set ${u.email} to ${planById(plan).name}?`, body: 'Manual plan assignment (no payment collected). Monthly credits apply from the next period.', confirm: 'Assign plan' }))) return; update((d) => { const s = d.subscriptions.find((x) => x.userId === u.id); if (s) s.plan = plan; }); audit(user.id, 'admin.plan', u.email, plan); toast('Plan assigned.', 'ok'); }} className="w-28 py-1 text-xs">{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></td>
                <td className="tabular">{balanceOf(db, u.id)}</td>
                <td><div className="flex gap-1"><Input type="number" value={grant[u.id] ?? ''} onChange={(e) => setGrant({ ...grant, [u.id]: e.target.value })} className="w-24 py-1 text-xs" placeholder="±credits" aria-label="Credit adjustment" /><Button size="sm" onClick={() => { const n = Math.trunc(Number(grant[u.id])); if (!n) return; if (balanceOf(db, u.id) + n < 0) { toast('Balance can’t go below zero.', 'warn'); return; } update((d) => { addCredits(d, u.id, n, 'adjust', `Admin adjustment by ${user.email}`); }); audit(user.id, 'admin.credits', u.email, String(n)); setGrant({ ...grant, [u.id]: '' }); toast('Ledger updated.', 'ok'); }}>Apply</Button></div></td>
                <td>{u.id !== user.id && <Button size="sm" variant={u.suspended ? 'ghost' : 'danger'} icon={<Ban className="size-3.5" />} onClick={async () => { if (!(await confirm({ title: u.suspended ? 'Reactivate user?' : 'Suspend user?', body: u.email, confirm: u.suspended ? 'Reactivate' : 'Suspend', danger: !u.suspended }))) return; update((d) => { const x = d.users.find((y) => y.id === u.id)!; x.suspended = !x.suspended; }); audit(user.id, u.suspended ? 'admin.reactivate' : 'admin.suspend', u.email); }}>{u.suspended ? 'Reactivate' : 'Suspend'}</Button>}</td>
              </tr>); })}</tbody></table>
        </Card>
      )}
      {tab === 'jobs' && (
        <Card className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]"><thead><tr className="text-xs text-dim text-left"><th className="p-4">Job</th><th>User</th><th>Status</th><th>Credits</th><th>When</th><th /></tr></thead>
          <tbody>{db.jobs.slice(0, 200).map((j) => <tr key={j.id} className="border-t border-line"><td className="p-4"><div>{j.label}</div><div className="text-xs text-dim font-mono">{j.id} · {j.type}</div>{j.error && <div className="text-xs text-bad">{j.error}</div>}</td><td className="text-xs">{name(j.userId)}</td><td className={cx('text-xs', j.status === 'failed' ? 'text-bad' : j.status === 'succeeded' ? 'text-ok' : 'text-mute')}>{j.status}{j.status === 'running' ? ` ${Math.round(j.progress * 100)}%` : ''}</td><td className="tabular">{j.credits}</td><td className="text-xs text-dim">{ago(j.createdAt)}</td><td>{(j.status === 'running' || j.status === 'queued') && <Button size="sm" variant="quiet" onClick={() => { cancelJob(j.id); audit(user.id, 'admin.job.cancel', j.id); }}>Cancel</Button>}{j.status === 'failed' && j.userId === user.id && <Button size="sm" variant="quiet" icon={<RotateCcw className="size-3.5" />} onClick={() => { try { retryJob(j.id); } catch (e) { toast((e as Error).message, 'warn'); } }}>Retry</Button>}</td></tr>)}</tbody></table></Card>
      )}
      {tab === 'reports' && (
        <div className="space-y-2">{db.reports.map((r) => <Card key={r.id} className="p-4 flex items-start gap-4"><ShieldAlert className={cx('size-5 shrink-0', r.status === 'open' ? 'text-bad' : 'text-dim')} /><div className="flex-1"><div className="text-sm">{r.reason}</div><div className="text-xs text-dim mt-1">{r.reporter} · on {r.target} · {ago(r.at)}</div></div><Button size="sm" onClick={() => { update((d) => { const x = d.reports.find((y) => y.id === r.id)!; x.status = x.status === 'open' ? 'resolved' : 'open'; }); audit(user.id, 'admin.report', r.id, r.status === 'open' ? 'resolved' : 'reopened'); }}>{r.status === 'open' ? 'Resolve' : 'Reopen'}</Button></Card>)}{!db.reports.length && <p className="text-sm text-dim">No reports.</p>}</div>
      )}
      {tab === 'audit' && <Card className="p-2 max-h-[70vh] overflow-y-auto scroll-thin">{db.audit.slice(0, 500).map((a) => <div key={a.id} className="grid grid-cols-[140px_200px_1fr] gap-3 px-3 py-1.5 text-xs border-b border-line last:border-0"><span className="text-dim">{new Date(a.at).toLocaleString()}</span><span className="truncate">{name(a.actorId)}</span><span><span className="font-mono text-amber">{a.action}</span> <span className="text-mute">{a.target}</span> {a.meta && <span className="text-dim">· {a.meta}</span>}</span></div>)}</Card>}
      {tab === 'errors' && <Card className="p-2">{db.errors.map((e) => <div key={e.id} className="px-3 py-2 text-xs border-b border-line last:border-0"><span className="text-dim mr-3">{new Date(e.at).toLocaleString()}</span><span className="text-bad">{e.message}</span></div>)}{!db.errors.length && <p className="p-4 text-sm text-dim">No errors logged.</p>}</Card>}
      {tab === 'config' && (
        <Card className="p-6 max-w-xl space-y-3">
          {(Object.keys(db.config.costs) as (keyof typeof db.config.costs)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-4 text-sm"><span className="text-mute">{k}</span><Input type="number" min={0} className="w-28" defaultValue={db.config.costs[k]} onBlur={(e) => { const v = Math.max(0, Math.trunc(Number(e.target.value))); if (v === db.config.costs[k]) return; update((d) => { d.config.costs[k] = v; }); audit(user.id, 'admin.config', k, String(v)); toast(`${k} = ${v}`, 'ok'); }} /></label>
          ))}
          <p className="text-xs text-dim pt-2">Failed-job policy: full refund (fixed).</p>
        </Card>
      )}
    </div>
  );
}

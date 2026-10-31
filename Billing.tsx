import { Check, Coins, Download, Lock, Info } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CountUp, PageHeader, StatusPill, Tabs, cx, download } from '../components/ui';
import { useApp } from '../lib/useApp';
import { PLANS } from '../lib/plans';
import { useIntegrations, createCheckoutSession } from '../lib/integrations';
import { addCredits, audit, update } from '../lib/db';
import { UsageChart } from './Dashboard';
import { FEATURES, featureRoute } from '../lib/features';

export default function Billing() {
  const { db, user, plan, sub, balance } = useApp();
  const { data } = useIntegrations();
  const [filter, setFilter] = useState<'all' | 'charge' | 'refund' | 'grant'>('all');
  const ledger = db.credits.filter((c) => c.userId === user.id && (filter === 'all' || c.kind === filter || (filter === 'grant' && c.kind === 'adjust')));
  const c = db.config.costs;
  const payState = data?.payments?.state ?? 'not_configured';
  const csv = () => {
    const rows = [['date', 'kind', 'amount', 'balance_after', 'reason', 'job_id'], ...db.credits.filter((x) => x.userId === user.id).map((x) => [new Date(x.at).toISOString(), x.kind, x.amount, x.balanceAfter, `"${x.reason.replace(/"/g, '""')}"`, x.jobId ?? ''])];
    download(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }), 'obscura-credit-ledger.csv');
  };
  return (
    <div>
      <PageHeader eyebrow="Billing & Settings" title="Credits & plan" desc="Every credit movement is recorded. Nothing is ever deducted without a ledger entry you can see." actions={<Link to="/app/settings"><Button>Preferences & accessibility</Button></Link>} />
      <div className="grid lg:grid-cols-3 gap-4 mb-10">
        <Card className="p-6 bg-gradient-to-br from-panel to-[#1d1810]"><div className="flex items-center gap-2 text-sm text-mute"><Coins className="size-4 text-amber" />Available</div><div className="font-display text-6xl mt-3"><CountUp value={balance} /></div><div className="text-sm text-dim mt-1">credits</div></Card>
        <Card className="p-6"><div className="text-sm text-mute">Current plan</div><div className="font-display text-4xl mt-3">{plan.name}</div><div className="text-sm text-dim mt-1">{plan.monthlyCredits.toLocaleString()} credits/month · up to {plan.maxRes}p · status {sub?.status}</div>{sub && <div className="text-xs text-dim mt-3">Period renews {new Date(sub.periodEnd).toLocaleDateString()} — next grant is added automatically when you sign in after that date.</div>}</Card>
        <Card className="p-6"><div className="text-sm text-mute mb-3">Last 14 days</div><UsageChart userId={user.id} /></Card>
      </div>

      <h2 className="font-display text-3xl mb-4">Plans</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {PLANS.map((p) => (
          <Card key={p.id} className={cx('p-5 flex flex-col', p.id === plan.id && 'border-amber/50')}>
            <div className="flex justify-between items-baseline"><span className="font-display text-2xl">{p.name}</span><span className="text-sm">${p.price}/mo</span></div>
            <ul className="text-sm text-mute space-y-1 mt-4 flex-1">{[`${p.monthlyCredits.toLocaleString()} credits`, `${p.maxRes}p exports`, `${p.seats} seat${p.seats > 1 ? 's' : ''}`, `${(p.storageMB / 1000).toFixed(0)} GB storage`].map((x) => <li key={x} className="flex gap-2"><Check className="size-4 text-ok shrink-0" />{x}</li>)}</ul>
            {p.id === plan.id ? <Button className="mt-5" disabled>Current plan</Button> : <Button className="mt-5" variant={p.id === 'creator' ? 'primary' : 'ghost'} onClick={async () => {
              try {
                const res = await createCheckoutSession(p.id, user.email);
                if (res.mode === 'stripe' && res.url) { window.location.href = res.url; return; }
                update((d) => {
                  const s = d.subscriptions.find((x) => x.userId === user.id);
                  if (s) s.plan = p.id;
                  addCredits(d, user.id, p.monthlyCredits, 'grant', `${p.name} plan activated`);
                });
                audit(user.id, 'billing.upgrade', p.id, res.mode);
              } catch (err) {
                alert((err as Error).message);
              }
            }}>{p.price === 0 ? 'Switch to Free' : `Upgrade to ${p.name}`}</Button>}
          </Card>
        ))}
      </div>
      <p className="text-xs text-dim mb-10 flex items-center gap-2">Payments (Stripe): <StatusPill status={payState} /> Plan changes are disabled until checkout + webhooks are deployed (see Docs). Admins can assign plans manually from the Admin console — every change is audited.</p>

      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <Card className="p-5">
          <div className="font-medium mb-4">Price list</div>
          <table className="w-full text-sm"><tbody>
            {[['Draft export (480p)', c.draftPer15s ? `${c.draftPer15s} per 15s` : 'Free'], ['HD / Full HD export', `${c.renderPer15s} per started 15s`], ['AI script draft', c.aiScript], ['AI hooks (6)', c.aiHooks], ['AI publishing copy', c.aiTitles], ['AI fact-check', c.aiFactcheck], ['All analysis tools, uploads, beat & highlight detection', 'Free']].map(([a, b]) => <tr key={a as string} className="border-t border-line first:border-0"><td className="py-2.5 text-mute">{a}</td><td className="text-right tabular">{b}</td></tr>)}
          </tbody></table>
        </Card>
        <Card className="p-5 text-sm space-y-3">
          <div className="font-medium flex items-center gap-2"><Info className="size-4 text-azure" />How credits work</div>
          <p className="text-mute">Before any paid job you see its exact cost. When it starts, credits are <b className="text-paper">reserved</b> (a “Reserved” ledger line).</p>
          <p className="text-mute">If the job <b className="text-paper">fails, is canceled, or the tab closes</b> mid-job, the full amount is <b className="text-paper">refunded automatically</b> with its own ledger line.</p>
          <p className="text-mute">Provider costs: AI features call third-party providers (e.g. a text model) that charge per request; credits cover those calls. Browser exports use your device, so drafts are free.</p>
          <p className="text-xs text-dim">Enforcement currently runs in the app’s data layer on this device. Server-side metering activates with the hosted database.</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4"><h2 className="font-display text-3xl">Ledger</h2><div className="flex gap-2"><Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'charge', label: 'Charges' }, { id: 'refund', label: 'Refunds' }, { id: 'grant', label: 'Grants' }]} /><Button size="sm" icon={<Download className="size-3.5" />} onClick={csv}>CSV</Button></div></div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]"><thead><tr className="text-xs text-dim text-left"><th className="p-4">When</th><th>What</th><th className="text-right">Amount</th><th className="text-right pr-4">Balance</th></tr></thead>
          <tbody>{ledger.slice(0, 200).map((x) => <tr key={x.id} className="border-t border-line"><td className="p-4 text-xs text-dim whitespace-nowrap">{new Date(x.at).toLocaleString()}</td><td><span className={cx('text-[10px] uppercase tracking-wider mr-2', x.kind === 'refund' ? 'text-ok' : x.kind === 'charge' ? 'text-warn' : 'text-azure')}>{x.kind}</span>{x.reason}</td><td className={cx('text-right tabular', x.amount > 0 ? 'text-ok' : 'text-paper')}>{x.amount > 0 ? '+' : ''}{x.amount}</td><td className="text-right pr-4 tabular">{x.balanceAfter}</td></tr>)}</tbody></table>
        {!ledger.length && <p className="p-6 text-sm text-dim">No entries.</p>}
      </Card>
      <div className="mt-10 grid md:grid-cols-3 gap-3">{FEATURES.filter((f) => f.cats.includes('billing')).map((f) => <Link key={f.id} to={featureRoute(f)} className="rounded-2xl hairline p-4 hover:bg-white/[0.03]"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{f.name}</span><StatusPill status={f.status} /></div><p className="text-xs text-dim mt-1">{f.desc}</p></Link>)}</div>
    </div>
  );
}

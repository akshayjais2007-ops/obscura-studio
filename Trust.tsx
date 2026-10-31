import { RefreshCw, ShieldCheck, Database, Brain, Scale, AlertTriangle, Plug } from 'lucide-react';
import { Button, Card, PageHeader, StatusPill } from '../components/ui';
import { INTEGRATIONS, useIntegrations } from '../lib/integrations';
import { FEATURES } from '../lib/features';
import { Link } from 'react-router-dom';

export default function Trust() {
  const { data, loading, refresh } = useIntegrations();
  return (
    <div>
      <PageHeader eyebrow="Trust & Transparency Center" title="Plain answers about AI, data and limits." desc="What runs where, what we store, what we never do, and which providers are actually connected right now." />
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {[
          { icon: Brain, t: 'How AI is used', b: ['AI is only called when you press a button that says so, with its credit cost shown.', 'Scripts, hooks, titles and fact-checks go to the text provider configured by the operator. Nothing is sent otherwise.', 'Analysis tools (Retention Doctor, Accessibility, Safe zones, Quality Gate, beats, highlights) are deterministic code running on your device — not AI guesses.', 'AI output is always editable and labeled. Fact-check results include sources you should open.'] },
          { icon: Database, t: 'Where your data lives', b: ['Accounts, projects, timelines and the credit ledger are stored in this browser (localStorage). Passwords are hashed with PBKDF2-SHA256 (120k iterations).', 'Media files are stored in this browser’s IndexedDB. Source files and renders are stored separately; renders never overwrite sources.', 'Provider API keys live only in server environment variables and are never sent to your browser.', 'Export a full backup or delete your account from Settings at any time.'] },
          { icon: Scale, t: 'Rights & licenses', b: ['You own what you upload and render.', 'The License Tracker records what you enter. We never invent or assume a license.', 'Sample media is clearly labeled “demo” and includes its real license (Pexels License, or AI-generated for samples).', 'Report unsafe or infringing content from the Help panel; admins review every report.'] },
          { icon: AlertTriangle, t: 'Honest limits', b: ['Exports render in real time in your browser tab; keep it visible. Cloud rendering needs the render worker integration.', 'Multi-device sync, shareable review links and server-side credit enforcement need the hosted database.', 'No audience analytics are shown until a platform account is connected. We never simulate views or CTR.', `${FEATURES.filter((f) => f.status === 'pending').length} tools need a provider before they work; ${FEATURES.filter((f) => f.status === 'partial').length} work partly today. Each is labeled.`] },
        ].map(({ icon: I, t, b }) => (
          <Card key={t} className="p-6"><I className="size-5 text-amber mb-4" /><h2 className="font-display text-2xl">{t}</h2><ul className="mt-3 space-y-2 text-sm text-mute leading-relaxed">{b.map((x) => <li key={x} className="flex gap-2"><ShieldCheck className="size-4 shrink-0 mt-0.5 text-dim" />{x}</li>)}</ul></Card>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div><h2 className="font-display text-3xl flex items-center gap-3"><Plug className="size-6" />Integrations</h2><p className="text-sm text-mute mt-1">“Connected” appears only after a live test against the provider succeeds.</p></div>
        <div className="flex gap-2"><Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => refresh(false)}>Refresh</Button><Button size="sm" variant="primary" loading={loading} onClick={() => refresh(true)}>Run live tests</Button></div>
      </div>
      <Card className="divide-y divide-line">
        {INTEGRATIONS.map((i) => {
          const st = data?.[i.id];
          return (
            <div key={i.id} className="p-4 grid md:grid-cols-[1fr_auto] gap-3 items-center">
              <div><div className="text-sm font-medium">{i.label}</div><div className="text-xs text-dim mt-0.5">{i.provider} · <span className="font-mono">{i.envVars.join(', ')}</span></div>{st?.detail && <div className="text-xs text-mute mt-1">{st.detail}</div>}</div>
              <StatusPill status={st?.state ?? 'not_configured'} />
            </div>
          );
        })}
      </Card>
      <p className="text-sm text-mute mt-4">Setup instructions and an env template are in <Link to="/app/docs" className="text-amber hover:underline">Docs</Link>.</p>
    </div>
  );
}

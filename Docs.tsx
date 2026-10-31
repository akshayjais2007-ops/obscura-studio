import { CheckCircle2, XCircle, Play, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader, StatusPill, Tabs, useToast } from '../components/ui';
import { runSelfTests } from '../lib/selftest';
import { FEATURES, featureRoute } from '../lib/features';
import { INTEGRATIONS } from '../lib/integrations';
import { exportSupported, pickMime } from '../lib/engine';
import { recognitionSupported } from '../lib/speech';

const ENV = `# Server-side only. Set in your host's environment (e.g. Vercel → Project → Settings → Environment Variables).
# Never prefix with VITE_ — that would expose them to the browser.
OPENAI_API_KEY=            # text: scripts, hooks, titles, fact-check
OPENAI_MODEL=gpt-4o-mini   # optional
OPENAI_BASE_URL=           # optional, any OpenAI-compatible endpoint
REPLICATE_API_TOKEN=       # image/video generation, consistency lock
DEEPGRAM_API_KEY=          # speech-to-text, speaker labels
ELEVENLABS_API_KEY=        # text-to-speech, dubbing
MUSIC_API_KEY=             # licensed music library
PEXELS_API_KEY=            # stock photos/video
YOUTUBE_CLIENT_ID=         # analytics + publishing (OAuth)
YOUTUBE_CLIENT_SECRET=
STRIPE_SECRET_KEY=         # payments
STRIPE_WEBHOOK_SECRET=
RENDER_WORKER_URL=         # cloud FFmpeg render worker
RENDER_WORKER_TOKEN=
DATABASE_URL=              # Postgres for multi-device sync (see docs/schema.sql)
S3_BUCKET=                 # object storage for media
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=`;

const API = [
  ['GET', '/api/integrations', 'Which providers have credentials. Add ?test=1 to run live provider checks. Never returns secrets.', '{ integrations: { text: { state: "connected"|"configured"|"not_configured"|"error", detail } … }, checkedAt }'],
  ['POST', '/api/generate', 'Text generation. Body { kind: "script"|"hooks"|"titles"|"factcheck", input }. 15 req/min/IP. 501 if not configured.', '{ result, usage }'],
  ['GET', '/api/stock?q=', 'Stock photo search via Pexels. 501 if not configured.', '{ results: [{ id, thumb, full, photographer, url }] }'],
];

const CHECKLIST = [
  ['P0', 'Hosted Postgres + S3 adapter for the data layer (schema in docs/schema.sql) → multi-device accounts, shareable review links, server-side credit enforcement'],
  ['P0', 'Stripe checkout + webhook route → paid plans, credit top-ups'],
  ['P1', 'Cloud render worker (FFmpeg) → background, faster-than-real-time exports on any device'],
  ['P1', 'Speech-to-text → auto captions, transcripts, speaker detection, podcast summaries'],
  ['P1', 'Text-to-speech → recorded narration, voiced audio description, dubbing'],
  ['P2', 'Image/video generation with references → AI visuals, Visual Consistency Lock'],
  ['P2', 'YouTube/Meta analytics OAuth → Thumbnail A/B winners, Ad Experiment results, performance memory'],
  ['P2', 'Licensed music library adapter'],
  ['P3', 'Full translations for long-form help text'],
];

export default function Docs() {
  const [tab, setTab] = useState<'status' | 'setup' | 'api' | 'tests'>('status');
  const [results, setResults] = useState<ReturnType<typeof runSelfTests> | null>(null);
  const toast = useToast();
  const groups = (['working', 'partial', 'pending'] as const).map((s) => ({ s, items: FEATURES.filter((f) => f.status === s) }));
  return (
    <div>
      <PageHeader eyebrow="Docs" title="Status, setup & API" desc="An honest report of what works today, what’s partial, and exactly what to connect next." />
      <Tabs className="mb-8" value={tab} onChange={setTab} tabs={[{ id: 'status', label: 'Status report' }, { id: 'setup', label: 'Setup & deploy' }, { id: 'api', label: 'API' }, { id: 'tests', label: 'Self-checks' }]} />
      {tab === 'status' && (
        <div className="space-y-8">
          <div className="grid md:grid-cols-3 gap-3">{groups.map((g) => <Card key={g.s} className="p-5"><StatusPill status={g.s} /><div className="font-display text-5xl mt-3">{g.items.length}</div><div className="text-xs text-dim">of 55 tools</div></Card>)}</div>
          <Card className="p-5">
            <div className="font-medium mb-3">Core platform (Phase 1)</div>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {[['Sign up / sign in / onboarding', 'working', 'PBKDF2 hashed, lockout after 5 failures; device-local'], ['Projects, autosave, trash, duplicate', 'working', ''], ['Uploads with magic-byte checks + SHA-256 dedupe', 'working', 'stored in IndexedDB'], ['Multitrack editor: trim, split, snap, undo/redo', 'working', ''], ['Job queue with cancel / retry / refund', 'working', 'in-tab worker'], ['Real export (MediaRecorder MP4/WebM)', 'working', 'real time, tab must stay visible'], ['Credits, ledger, plan limits', 'working', 'enforced client-side'], ['Paid subscriptions', 'pending', 'needs Stripe'], ['Teams, roles, reviews, approvals', 'partial', 'same-device until hosted DB'], ['Admin console with audit log', 'working', ''], ['Multi-device sync', 'pending', 'needs DATABASE_URL + S3']].map(([a, s, n]) => <li key={a} className="flex items-center gap-2"><StatusPill status={s as 'working'} /><span>{a}</span>{n && <span className="text-xs text-dim">— {n}</span>}</li>)}
            </ul>
          </Card>
          <Card className="p-5"><div className="font-medium mb-3">Prioritized checklist</div><ol className="space-y-2 text-sm">{CHECKLIST.map(([p, t]) => <li key={t} className="flex gap-3"><span className="font-mono text-xs text-amber w-6">{p}</span><span className="text-mute">{t}</span></li>)}</ol></Card>
          {groups.map((g) => (
            <div key={g.s}><div className="flex items-center gap-2 mb-3"><StatusPill status={g.s} /><span className="text-sm text-mute">{g.items.length} tools</span></div>
              <div className="grid md:grid-cols-2 gap-2">{g.items.map((f) => <Link key={f.id} to={featureRoute(f)} className="rounded-xl hairline p-3 text-sm hover:bg-white/[0.03]"><span className="font-mono text-xs text-dim mr-2">#{f.n}</span>{f.name}<div className="text-xs text-dim mt-1">{f.note}</div></Link>)}</div></div>
          ))}
        </div>
      )}
      {tab === 'setup' && (
        <div className="space-y-6 max-w-4xl">
          <Card className="p-6 text-sm space-y-3">
            <div className="font-display text-2xl">Run locally</div>
            <pre className="bg-coal rounded-xl p-4 text-xs font-mono overflow-x-auto">{`npm install\nnpm run dev          # app at http://localhost:5173 (API routes need \`vercel dev\`)\nnpm test             # unit tests (Vitest) — same checks as the Self-checks tab\nnpm run build        # type-check + production build`}</pre>
            <div className="font-display text-2xl pt-3">Deploy (Vercel)</div>
            <ol className="list-decimal pl-5 space-y-1 text-mute"><li>Import the repo. Framework: Vite. Output: <code>dist</code>.</li><li><code>/api/*.js</code> deploy as serverless functions automatically; <code>vercel.json</code> rewrites all other routes to the SPA.</li><li>Add environment variables from the template below (server-side only).</li><li>Open Trust Center → Run live tests. Integrations show “Connected” only when the provider accepts the key.</li></ol>
            <div className="font-display text-2xl pt-3">Database migration</div>
            <p className="text-mute"><code>docs/schema.sql</code> contains the relational schema (users, workspaces, members, projects, scenes, tracks/clips, assets, captions, render_jobs, credit_transactions, subscriptions, approvals, comments, audit_log, snapshots). The in-browser store uses identical tables and foreign keys, so a Postgres adapter can replace <code>src/lib/db.ts</code> without UI changes. Run with <code>psql "$DATABASE_URL" -f docs/schema.sql</code>.</p>
            <div className="font-display text-2xl pt-3">Backups</div>
            <p className="text-mute">Settings → Export backup downloads every record as JSON; Restore re-imports it. With Postgres, use your provider’s point-in-time recovery.</p>
          </Card>
          <Card className="p-6"><div className="flex justify-between items-center mb-3"><div className="font-display text-2xl">.env template</div><Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => navigator.clipboard.writeText(ENV).then(() => toast('Copied.', 'ok'))}>Copy</Button></div><pre className="bg-coal rounded-xl p-4 text-xs font-mono overflow-x-auto">{ENV}</pre></Card>
          <Card className="p-6"><div className="font-display text-2xl mb-3">Integrations needing credentials</div><ul className="space-y-2 text-sm">{INTEGRATIONS.map((i) => <li key={i.id} className="flex flex-wrap gap-2"><span className="font-medium">{i.label}</span><span className="text-dim">· {i.provider}</span><span className="font-mono text-xs text-amber">{i.envVars.join(', ')}</span></li>)}</ul></Card>
        </div>
      )}
      {tab === 'api' && (
        <div className="space-y-3 max-w-4xl">
          {API.map(([m, p, d, r]) => <Card key={p} className="p-5"><div className="flex items-center gap-3"><span className="font-mono text-xs rounded bg-violet/20 text-violet px-2 py-0.5">{m}</span><span className="font-mono text-sm">{p}</span></div><p className="text-sm text-mute mt-2">{d}</p><pre className="bg-coal rounded-lg p-3 text-xs font-mono mt-3 overflow-x-auto">{r}</pre></Card>)}
          <p className="text-xs text-dim">All routes are rate-limited per IP, validate input size, and read secrets only from <code>process.env</code>.</p>
        </div>
      )}
      {tab === 'tests' && (
        <div className="max-w-4xl">
          <Card className="p-5 mb-4 text-sm">
            <div className="font-medium mb-2">This browser</div>
            <ul className="space-y-1 text-mute">
              <li className="flex items-center gap-2">{exportSupported() ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}Video export · {pickMime() || 'not supported'}</li>
              <li className="flex items-center gap-2">{recognitionSupported() ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}Voice input</li>
              <li className="flex items-center gap-2">{'speechSynthesis' in window ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}Read-aloud</li>
              <li className="flex items-center gap-2">{'indexedDB' in window ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}Media storage (IndexedDB)</li>
            </ul>
          </Card>
          <Button variant="primary" icon={<Play className="size-4" />} onClick={() => setResults(runSelfTests())}>Run self-checks now</Button>
          <p className="text-xs text-dim mt-2">These execute the real logic for credits, uploads, captions, permissions, saving, versions and export rules — results are computed live, never hard-coded.</p>
          {results && (
            <Card className="p-5 mt-4">
              <div className="text-sm mb-3"><span className="text-ok">{results.filter((r) => r.pass).length} passed</span> · <span className={results.some((r) => !r.pass) ? 'text-bad' : 'text-dim'}>{results.filter((r) => !r.pass).length} failed</span></div>
              <ul className="space-y-1.5">{results.map((r) => <li key={r.name} className="flex items-start gap-2 text-sm">{r.pass ? <CheckCircle2 className="size-4 text-ok mt-0.5 shrink-0" /> : <XCircle className="size-4 text-bad mt-0.5 shrink-0" />}<span className="font-mono text-[11px] text-dim w-20 shrink-0 mt-0.5">{r.area}</span><span>{r.name}{!r.pass && <span className="text-bad text-xs block">{r.error}</span>}</span></li>)}</ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

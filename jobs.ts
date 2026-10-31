// Background job queue: persisted job records, credit reservation, cancel, retry, refund-on-failure.
import { addCredits, audit, balanceOf, getDB, notify, update, logError } from './db';
import { uid } from './id';
import type { Asset, Job, JobType } from './types';
import { renderProject } from './engine';
import { putBlob } from './idb';
import { callAI, IntegrationRequired } from './integrations';
import { planById } from './plans';
import { snapshot } from './project';

type Ctx = { signal: AbortSignal; progress: (p: number) => void };
type Handler = (job: Job, ctx: Ctx) => Promise<{ result?: Record<string, unknown>; outputAssetId?: string }>;

const controllers = new Map<string, AbortController>();
const queue: string[] = [];
let running = false;

const handlers: Record<JobType, Handler> = {
  render: async (job, ctx) => {
    const d = getDB();
    const project = d.projects.find((p) => p.id === job.projectId);
    if (!project) throw new Error('Project not found — it may have been deleted.');
    const res = Number(job.params.res ?? 720);
    const sub = d.subscriptions.find((s) => s.userId === job.userId);
    if (res > planById(sub?.plan ?? 'free').maxRes) throw new Error(`${res}p isn’t included in your plan.`);
    const assets = d.assets.filter((a) => a.workspaceId === project.workspaceId);
    const out = await renderProject(project, assets, { short: res, signal: ctx.signal, onProgress: ctx.progress });
    const id = uid('as_');
    await putBlob(id, out.blob);
    const ext = out.mime.includes('mp4') ? 'mp4' : 'webm';
    const asset: Asset = {
      id, workspaceId: project.workspaceId, ownerId: job.userId, name: `${project.title} — ${res}p${job.params.draft ? ' draft' : ''}.${ext}`,
      type: 'video', mime: out.mime, size: out.blob.size, duration: out.duration, width: out.width, height: out.height, hash: id,
      tags: ['render', project.aspect], source: 'render', license: 'Your render', attribution: '', projectId: project.id, createdAt: Date.now(),
    };
    update((x) => { x.assets.unshift(asset); });
    snapshot(project.id, `Exported ${res}p`);
    return { outputAssetId: id, result: { size: out.blob.size, mime: out.mime, width: out.width, height: out.height } };
  },
  ai_script: async (job, ctx) => ({ result: { data: await callAI('script', job.params, ctx.signal) } }),
  ai_hooks: async (job, ctx) => ({ result: { data: await callAI('hooks', job.params, ctx.signal) } }),
  ai_titles: async (job, ctx) => ({ result: { data: await callAI('titles', job.params, ctx.signal) } }),
  ai_factcheck: async (job, ctx) => ({ result: { data: await callAI('factcheck', job.params, ctx.signal) } }),
  analyze_media: async () => ({ result: {} }),
};

function patch(id: string, p: Partial<Job>) {
  update((d) => { const j = d.jobs.find((x) => x.id === id); if (j) Object.assign(j, p); });
}

export class InsufficientCredits extends Error {}

export function enqueue(userId: string, type: JobType, label: string, params: Record<string, unknown>, opts: { projectId?: string; credits: number; attempt?: number }) {
  const bal = balanceOf(getDB(), userId);
  if (opts.credits > 0 && bal < opts.credits) throw new InsufficientCredits(`This needs ${opts.credits} credits and you have ${bal}. Lower the resolution, use a draft, or add credits in Billing.`);
  const id = uid('job_');
  update((d) => {
    if (opts.credits > 0) addCredits(d, userId, -opts.credits, 'charge', `Reserved: ${label}`, id);
    d.jobs.unshift({ id, userId, type, label, params, projectId: opts.projectId, status: 'queued', progress: 0, credits: opts.credits, attempt: opts.attempt ?? 1, createdAt: Date.now() });
    d.jobs = d.jobs.slice(0, 300);
  });
  audit(userId, 'job.enqueue', id, `${type} · ${opts.credits} credits`);
  queue.push(id);
  pump();
  return id;
}

function refund(job: Job, why: string) {
  if (job.credits > 0) update((d) => { addCredits(d, job.userId, job.credits, 'refund', `Refund (${why}): ${job.label}`, job.id); });
}

async function pump() {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  const job = getDB().jobs.find((j) => j.id === id);
  if (!job || job.status !== 'queued') { pump(); return; }
  running = true;
  const ac = new AbortController();
  controllers.set(id, ac);
  patch(id, { status: 'running', startedAt: Date.now(), progress: 0 });
  let lastP = 0;
  try {
    const out = await handlers[job.type](job, { signal: ac.signal, progress: (p) => { if (p - lastP >= 0.02 || p >= 1) { lastP = p; patch(id, { progress: Math.min(0.999, p) }); } } });
    patch(id, { status: 'succeeded', progress: 1, finishedAt: Date.now(), result: out.result, outputAssetId: out.outputAssetId });
    if (job.type === 'render') notify(job.userId, `Export finished: ${job.label}`, 'ok', '/app/projects?tab=exports');
    audit(job.userId, 'job.succeeded', id, job.type);
  } catch (e) {
    const err = e as Error;
    const fresh = getDB().jobs.find((j) => j.id === id)!;
    if (err.name === 'AbortError' || ac.signal.aborted) {
      patch(id, { status: 'canceled', finishedAt: Date.now() });
      refund(fresh, 'canceled');
      audit(job.userId, 'job.canceled', id, job.type);
    } else {
      const msg = e instanceof IntegrationRequired ? `Integration required: connect a ${e.integration} provider (see Trust Center → Integrations).` : err.message || 'Unknown error';
      patch(id, { status: 'failed', finishedAt: Date.now(), error: msg });
      refund(fresh, 'failed');
      notify(job.userId, `${job.label} failed — credits refunded. ${msg}`, 'bad', '/app/projects?tab=jobs');
      logError(`${job.type}: ${msg}`);
      audit(job.userId, 'job.failed', id, msg);
    }
  } finally {
    controllers.delete(id);
    running = false;
    pump();
  }
}

export function cancelJob(id: string) {
  const job = getDB().jobs.find((j) => j.id === id);
  if (!job) return;
  if (job.status === 'queued') {
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
    patch(id, { status: 'canceled', finishedAt: Date.now() });
    refund(job, 'canceled');
  } else if (job.status === 'running') controllers.get(id)?.abort();
}

export function retryJob(id: string) {
  const job = getDB().jobs.find((j) => j.id === id);
  if (!job) return;
  return enqueue(job.userId, job.type, job.label, job.params, { projectId: job.projectId, credits: job.credits, attempt: job.attempt + 1 });
}

/** Wait for a job to settle (used by AI flows that need the result inline). */
export function waitFor(id: string): Promise<Job> {
  return new Promise((res) => {
    const check = () => {
      const j = getDB().jobs.find((x) => x.id === id);
      if (j && ['succeeded', 'failed', 'canceled'].includes(j.status)) { res(j); return true; }
      return false;
    };
    if (check()) return;
    const iv = setInterval(() => { if (check()) clearInterval(iv); }, 250);
  });
}

/** On boot: anything left running/queued from a closed tab is marked interrupted and refunded. */
export function recoverJobs() {
  const stale = getDB().jobs.filter((j) => j.status === 'running' || j.status === 'queued');
  if (!stale.length) return;
  for (const j of stale) {
    patch(j.id, { status: 'failed', error: 'Interrupted because the tab was closed or reloaded. Retry to run it again.', finishedAt: Date.now() });
    refund(j, 'interrupted');
  }
}

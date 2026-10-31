import { useEffect, useState } from 'react';

export type IntegrationState = 'connected' | 'configured' | 'not_configured' | 'error' | 'unreachable';
export interface IntegrationInfo { id: string; label: string; category: string; envVars: string[]; state: IntegrationState; detail?: string; provider: string }

export const INTEGRATIONS: Omit<IntegrationInfo, 'state'>[] = [
  { id: 'text', label: 'Text generation (scripts, hooks, titles, fact-check)', category: 'AI', envVars: ['OPENAI_API_KEY', 'OPENAI_MODEL (optional)'], provider: 'OpenAI-compatible' },
  { id: 'image', label: 'Image & video generation', category: 'AI', envVars: ['REPLICATE_API_TOKEN'], provider: 'Replicate' },
  { id: 'stt', label: 'Speech-to-text & speaker labels', category: 'AI', envVars: ['DEEPGRAM_API_KEY'], provider: 'Deepgram' },
  { id: 'tts', label: 'Text-to-speech, dubbing & voices', category: 'AI', envVars: ['ELEVENLABS_API_KEY'], provider: 'ElevenLabs' },
  { id: 'music', label: 'Licensed music library', category: 'Media', envVars: ['MUSIC_API_KEY'], provider: 'Music provider' },
  { id: 'stock', label: 'Stock photos & video', category: 'Media', envVars: ['PEXELS_API_KEY'], provider: 'Pexels' },
  { id: 'analytics', label: 'Platform analytics (YouTube, Meta, TikTok)', category: 'Data', envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'], provider: 'YouTube Data/Analytics API' },
  { id: 'payments', label: 'Payments & subscriptions', category: 'Billing', envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], provider: 'Stripe' },
  { id: 'render', label: 'Cloud rendering (background, faster than real time)', category: 'Infra', envVars: ['RENDER_WORKER_URL', 'RENDER_WORKER_TOKEN'], provider: 'Self-hosted FFmpeg worker' },
  { id: 'database', label: 'Hosted database & object storage (multi-device sync)', category: 'Infra', envVars: ['DATABASE_URL', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'], provider: 'Postgres + S3' },
];

let cache: { at: number; data: Record<string, { state: IntegrationState; detail?: string }> } | null = null;

export async function fetchIntegrationStatus(test = false): Promise<Record<string, { state: IntegrationState; detail?: string }>> {
  if (cache && !test && Date.now() - cache.at < 60_000) return cache.data;
  try {
    const r = await fetch(`/api/integrations${test ? '?test=1' : ''}`, { headers: { accept: 'application/json' } });
    const ct = r.headers.get('content-type') ?? '';
    if (!r.ok || !ct.includes('json')) throw new Error('API not deployed');
    const data = await r.json();
    cache = { at: Date.now(), data: data.integrations };
    return data.integrations;
  } catch {
    const data = Object.fromEntries(INTEGRATIONS.map((i) => [i.id, { state: 'unreachable' as IntegrationState, detail: 'The server API isn’t reachable from this deployment.' }]));
    cache = { at: Date.now(), data };
    return data;
  }
}

export function useIntegrations() {
  const [data, setData] = useState<Record<string, { state: IntegrationState; detail?: string }> | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);
  const refresh = async (test = false) => {
    setLoading(true);
    const d = await fetchIntegrationStatus(test);
    setData(d);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const isReady = (id: string) => data?.[id]?.state === 'connected' || data?.[id]?.state === 'configured';
  return { data, loading, refresh, isReady };
}

export class IntegrationRequired extends Error {
  constructor(public integration: string) { super(`Integration required: ${integration}`); }
}

export async function callAI<T = unknown>(kind: 'script' | 'hooks' | 'titles' | 'factcheck', input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, input }), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new IntegrationRequired('text');
  }
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new IntegrationRequired('text');
  const data = await r.json();
  if (r.status === 501) throw new IntegrationRequired('text');
  if (r.status === 429) throw new Error('Too many requests right now. Wait a minute and retry.');
  if (!r.ok) throw new Error(data.error ?? `Provider error (${r.status}).`);
  return data.result as T;
}

export async function searchStock(query: string): Promise<{ id: number; thumb: string; full: string; photographer: string; url: string }[]> {
  const r = await fetch(`/api/stock?q=${encodeURIComponent(query)}`);
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('json') || r.status === 501) throw new IntegrationRequired('stock');
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? 'Stock search failed.');
  return d.results;
}

export async function createCheckoutSession(planId: string, email?: string): Promise<{ mode: 'stripe' | 'sandbox'; url?: string; credits?: number; message?: string }> {
  const r = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ planId, email, origin: window.location.origin }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Checkout failed.');
  return data;
}

export const uid = (p = '') =>
  p + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12).replace(/-/g, '') : Math.random().toString(36).slice(2, 14));

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function tc(sec: number, frames = false, fps = 30) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const base = `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  if (!frames) return base;
  const f = Math.floor((s % 1) * fps);
  return `${base}:${String(f).padStart(2, '0')}`;
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function ago(t: number) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

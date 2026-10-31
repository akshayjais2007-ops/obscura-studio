import { useSyncExternalStore } from 'react';
import type {
  AbuseReport, Approval, Asset, Audit, BrandKit, Comment, Config, CreditTx, Experiment, Job, Member, Notice,
  Preference, Project, Settings, Snapshot, StylePreset, Subscription, User, Workspace,
} from './types';
import { DEFAULT_CONFIG } from './plans';
import { uid } from './id';

/**
 * Relational data layer. Every entity lives in its own table keyed by id with foreign keys
 * (workspaceId, projectId, userId). Persisted to localStorage on this device; media blobs live in
 * IndexedDB (see idb.ts). The shape mirrors docs/schema.sql so a hosted Postgres adapter can replace it.
 */
export interface DB {
  version: 1;
  users: User[];
  workspaces: Workspace[];
  members: Member[];
  projects: Project[];
  assets: Asset[];
  jobs: Job[];
  credits: CreditTx[];
  subscriptions: Subscription[];
  comments: Comment[];
  approvals: Approval[];
  audit: Audit[];
  snapshots: Snapshot[];
  notices: Notice[];
  brandKits: BrandKit[];
  styles: StylePreset[];
  prefs: Preference[];
  reports: AbuseReport[];
  experiments: Experiment[];
  settings: Record<string, Settings>;
  config: Config;
  loginFailures: Record<string, { count: number; until: number }>;
  errors: { id: string; message: string; at: number }[];
}

const KEY = 'obscura.db.v1';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'beginner', textScale: 1, contrast: 'normal', motion: 'system', familySafe: true, lang: 'en', toursDone: [],
};

export function emptyDB(): DB {
  return {
    version: 1, users: [], workspaces: [], members: [], projects: [], assets: [], jobs: [], credits: [], subscriptions: [],
    comments: [], approvals: [], audit: [], snapshots: [], notices: [], brandKits: [], styles: [], prefs: [], reports: [],
    experiments: [], settings: {}, config: DEFAULT_CONFIG, loginFailures: {}, errors: [],
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDB();
    return { ...emptyDB(), ...JSON.parse(raw) };
  } catch {
    return emptyDB();
  }
}

let state: DB = typeof localStorage !== 'undefined' ? load() : emptyDB();
const listeners = new Set<() => void>();
let storageError: string | null = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageError = null;
  } catch (e) {
    storageError = 'Your browser storage is full. Delete unused renders or assets in Projects & Assets to keep autosave working.';
    console.error(e);
  }
}

export const getDB = () => state;
export const getStorageError = () => storageError;

export function update(fn: (d: DB) => void) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  persist();
  scheduleServerSync();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export function audit(actorId: string, action: string, target: string, meta?: string) {
  update((d) => {
    d.audit.unshift({ id: uid('au_'), actorId, action, target, meta, at: Date.now() });
    d.audit = d.audit.slice(0, 1000);
  });
}

export function notify(userId: string, text: string, tone: Notice['tone'] = 'info', link?: string) {
  update((d) => {
    d.notices.unshift({ id: uid('n_'), userId, text, tone, link, read: false, at: Date.now() });
    d.notices = d.notices.slice(0, 200);
  });
}

export function logError(message: string) {
  update((d) => {
    d.errors.unshift({ id: uid('e_'), message, at: Date.now() });
    d.errors = d.errors.slice(0, 100);
  });
}

export function balanceOf(d: DB, userId: string) {
  const last = d.credits.find((c) => c.userId === userId);
  return last ? last.balanceAfter : 0;
}

/** Writes a ledger entry. Credits list is newest-first so balanceOf reads index 0. */
export function addCredits(d: DB, userId: string, amount: number, kind: CreditTx['kind'], reason: string, jobId?: string) {
  const bal = balanceOf(d, userId) + amount;
  d.credits.unshift({ id: uid('tx_'), userId, amount, kind, reason, jobId, balanceAfter: bal, at: Date.now() });
  return bal;
}

/** Download a JSON backup of all non-media records */
export function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  return blob;
}

export function importBackup(json: string) {
  const parsed = JSON.parse(json);
  if (parsed?.version !== 1 || !Array.isArray(parsed.users)) throw new Error('This file is not an Obscura backup.');
  state = { ...emptyDB(), ...parsed };
  persist();
  listeners.forEach((l) => l());
}

/** Role permissions */
export const PERMS = {
  owner: ['view', 'comment', 'edit', 'render', 'approve', 'manage', 'billing'],
  admin: ['view', 'comment', 'edit', 'render', 'approve', 'manage'],
  editor: ['view', 'comment', 'edit', 'render'],
  reviewer: ['view', 'comment', 'approve'],
  viewer: ['view'],
} as const;
export type Perm = (typeof PERMS)['owner'][number];

export function roleIn(d: DB, userId: string, workspaceId: string) {
  const ws = d.workspaces.find((w) => w.id === workspaceId);
  if (!ws) return null;
  if (ws.ownerId === userId) return 'owner' as const;
  const user = d.users.find((u) => u.id === userId);
  const m = d.members.find((m) => m.workspaceId === workspaceId && (m.userId === userId || (user && m.email === user.email)));
  if (m) return m.role;
  if (ws.parentId) return roleIn(d, userId, ws.parentId);
  return null;
}

export function can(d: DB, userId: string, workspaceId: string, perm: Perm) {
  const r = roleIn(d, userId, workspaceId);
  if (!r) return false;
  return (PERMS[r] as readonly string[]).includes(perm);
}


// Automatic non-blocking background sync with /api/db when deployed
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleServerSync() {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch('/api/db', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ db: state }),
    }).catch(() => {});
  }, 1200);
}

if (typeof window !== 'undefined') {
  fetch('/api/db', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.db?.version === 1 && Array.isArray(data.db.users) && state.users.length === 0 && data.db.users.length > 0) {
        state = { ...emptyDB(), ...data.db };
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
        listeners.forEach((l) => l());
      }
    })
    .catch(() => {});
}

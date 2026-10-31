import { useSyncExternalStore } from 'react';
import { useDB, balanceOf, can, type Perm } from './db';
import { useUser } from './auth';
import { planById } from './plans';

const WS_KEY = 'obscura.ws';
const wsListeners = new Set<() => void>();
export function setActiveWorkspace(id: string) { localStorage.setItem(WS_KEY, id); wsListeners.forEach((l) => l()); }
const readWs = () => localStorage.getItem(WS_KEY);

/** Current user, active workspace, plan, balance and permission helper. */
export function useApp() {
  const user = useUser();
  const db = useDB();
  const wsPref = useSyncExternalStore((l) => { wsListeners.add(l); return () => wsListeners.delete(l); }, readWs, readWs);
  const accessible = user ? db.workspaces.filter((w) => w.ownerId === user.id || db.members.some((m) => m.workspaceId === w.id && (m.userId === user.id || m.email === user.email)) || (w.parentId && db.workspaces.find((p) => p.id === w.parentId)?.ownerId === user.id)) : [];
  const workspace = accessible.find((w) => w.id === wsPref) ?? accessible.find((w) => w.kind === 'personal' && w.ownerId === user?.id) ?? accessible[0];
  const sub = user ? db.subscriptions.find((s) => s.userId === user.id) : undefined;
  const plan = planById(sub?.plan ?? 'free');
  const balance = user ? balanceOf(db, user.id) : 0;
  const allow = (perm: Perm, wsId = workspace?.id) => !!user && !!wsId && can(db, user.id, wsId, perm);
  return { user: user!, db, workspace: workspace!, workspaces: accessible, sub, plan, balance, allow };
}

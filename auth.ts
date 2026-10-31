import { useSyncExternalStore } from 'react';
import { addCredits, audit, getDB, update, useDB, DEFAULT_SETTINGS, notify } from './db';
import { uid } from './id';
import { planById } from './plans';
import type { User } from './types';

const SESSION_KEY = 'obscura.session';
const sessionListeners = new Set<() => void>();
const readSession = () => localStorage.getItem(SESSION_KEY);

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function hashPassword(password: string, saltB64?: string) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return { hash: b64(bits), salt: b64(salt.buffer as ArrayBuffer) };
}

export function validateEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
}

export function passwordProblems(p: string) {
  const out: string[] = [];
  if (p.length < 8) out.push('Use at least 8 characters');
  if (!/[0-9]/.test(p) && !/[^a-zA-Z]/.test(p)) out.push('Add a number or symbol');
  return out;
}

function setSession(userId: string | null) {
  if (userId) localStorage.setItem(SESSION_KEY, userId);
  else localStorage.removeItem(SESSION_KEY);
  sessionListeners.forEach((l) => l());
}

export async function signUp(name: string, email: string, password: string) {
  email = email.trim().toLowerCase();
  if (!name.trim()) throw new Error('Please tell us your name.');
  if (!validateEmail(email)) throw new Error('That email doesn’t look right. Try name@example.com.');
  const probs = passwordProblems(password);
  if (probs.length) throw new Error(probs.join('. ') + '.');
  if (getDB().users.some((u) => u.email === email)) throw new Error('An account with this email already exists. Try signing in.');
  const { hash, salt } = await hashPassword(password);
  const id = uid('u_');
  const now = Date.now();
  const first = getDB().users.length === 0;
  update((d) => {
    const user: User = { id, email, name: name.trim(), passHash: hash, salt, role: first ? 'admin' : 'user', onboarded: false, createdAt: now };
    d.users.push(user);
    const wsId = uid('ws_');
    d.workspaces.push({ id: wsId, name: `${name.trim().split(' ')[0]}'s Studio`, ownerId: id, kind: 'personal', createdAt: now });
    d.subscriptions.push({ userId: id, plan: 'free', status: 'active', periodStart: now, periodEnd: now + 30 * 864e5 });
    addCredits(d, id, planById('free').monthlyCredits, 'grant', 'Free plan monthly credits');
    d.settings[id] = { ...DEFAULT_SETTINGS };
    // Members on invited workspaces get linked on signup
    d.members.forEach((m) => { if (m.email === email) m.userId = id; });
  });
  audit(id, 'user.signup', email, first ? 'first account → admin' : undefined);
  notify(id, `Welcome to Obscura. You have ${planById('free').monthlyCredits} free credits this month.`, 'ok', '/app/billing');
  setSession(id);
  return id;
}

export async function signIn(email: string, password: string) {
  email = email.trim().toLowerCase();
  const d = getDB();
  const lock = d.loginFailures[email];
  if (lock && lock.until > Date.now()) {
    const s = Math.ceil((lock.until - Date.now()) / 1000);
    throw new Error(`Too many attempts. For your safety, wait ${s} seconds and try again.`);
  }
  const user = d.users.find((u) => u.email === email);
  const fail = () => {
    update((x) => {
      const f = x.loginFailures[email] ?? { count: 0, until: 0 };
      f.count += 1;
      if (f.count >= 5) { f.until = Date.now() + 60_000; f.count = 0; }
      x.loginFailures[email] = f;
    });
    throw new Error('Email or password is incorrect. Check spelling, or create a new account.');
  };
  if (!user) return fail();
  const { hash } = await hashPassword(password, user.salt);
  if (hash !== user.passHash) return fail();
  if (user.suspended) throw new Error('This account is suspended. Contact support from the Help panel.');
  update((x) => { delete x.loginFailures[email]; });
  rollPeriod(user.id);
  audit(user.id, 'user.login', email);
  setSession(user.id);
  return user.id;
}

/** Monthly credit grant when the billing period ends */
export function rollPeriod(userId: string) {
  const sub = getDB().subscriptions.find((s) => s.userId === userId);
  if (!sub || sub.periodEnd > Date.now()) return;
  update((d) => {
    const s = d.subscriptions.find((x) => x.userId === userId)!;
    s.periodStart = Date.now();
    s.periodEnd = Date.now() + 30 * 864e5;
    addCredits(d, userId, planById(s.plan).monthlyCredits, 'grant', `${planById(s.plan).name} plan monthly credits`);
  });
}

export function signOut() {
  const id = readSession();
  if (id) audit(id, 'user.logout', id);
  setSession(null);
}

export function useSessionId() {
  return useSyncExternalStore(
    (l) => { sessionListeners.add(l); return () => sessionListeners.delete(l); },
    readSession,
    readSession,
  );
}

export function useUser() {
  const id = useSessionId();
  const db = useDB();
  return id ? db.users.find((u) => u.id === id) ?? null : null;
}

export function currentUserId() {
  return readSession();
}

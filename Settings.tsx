import { Download, Upload, Trash2, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, PageHeader, Select, Toggle, useConfirm, useToast, download, cx } from '../components/ui';
import { useApp } from '../lib/useApp';
import { LANGS, setSettings, useSettings } from '../lib/i18n';
import { audit, exportBackup, importBackup, update } from '../lib/db';
import { hashPassword, passwordProblems, signOut } from '../lib/auth';
import { ReadAloud } from '../components/shared';
import type { Settings as S } from '../lib/types';

export default function Settings() {
  const { user, db } = useApp();
  const s = useSettings();
  const set = (p: Partial<S>) => setSettings(user.id, p);
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [oldPw, setOld] = useState('');
  const [newPw, setNew] = useState('');
  const changePw = async () => {
    const { hash } = await hashPassword(oldPw, user.salt);
    if (hash !== user.passHash) { toast('Current password is incorrect.', 'bad'); return; }
    const probs = passwordProblems(newPw);
    if (probs.length) { toast(probs.join('. '), 'warn'); return; }
    const n = await hashPassword(newPw);
    update((d) => { const u = d.users.find((x) => x.id === user.id)!; u.passHash = n.hash; u.salt = n.salt; });
    audit(user.id, 'user.password', user.id);
    setOld(''); setNew(''); toast('Password changed.', 'ok');
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete your account?', body: 'This removes your account, personal workspace, projects and ledger from this device. Export a backup first if you want to keep anything. This can’t be undone.', confirm: 'Delete account', danger: true }))) return;
    const mine = db.workspaces.filter((w) => w.ownerId === user.id).map((w) => w.id);
    update((d) => {
      d.users = d.users.filter((u) => u.id !== user.id); d.workspaces = d.workspaces.filter((w) => w.ownerId !== user.id);
      d.projects = d.projects.filter((p) => !mine.includes(p.workspaceId)); d.assets = d.assets.filter((a) => !mine.includes(a.workspaceId));
      d.credits = d.credits.filter((c) => c.userId !== user.id); d.jobs = d.jobs.filter((j) => j.userId !== user.id); d.subscriptions = d.subscriptions.filter((x) => x.userId !== user.id);
      d.prefs = d.prefs.filter((x) => x.userId !== user.id); d.notices = d.notices.filter((x) => x.userId !== user.id); delete d.settings[user.id];
    });
    audit(user.id, 'user.delete', user.email);
    signOut(); nav('/');
  };
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Settings" title="Make it yours" desc="Comfort, language, safety and your data." />
      <Card className="p-6 mb-6">
        <h2 className="font-display text-2xl mb-2">Comfort & accessibility</h2>
        <div className="divide-y divide-line">
          <div className="py-3"><div className="text-sm font-medium mb-2">Interface mode</div><div className="grid grid-cols-2 gap-2">{(['beginner', 'pro'] as const).map((m) => <button key={m} onClick={() => set({ mode: m })} aria-pressed={s.mode === m} className={cx('rounded-xl hairline p-3 text-left text-sm', s.mode === m ? 'bg-paper text-ink' : 'hover:bg-white/5')}><b className="capitalize">{m}</b><span className={cx('block text-xs mt-0.5', s.mode === m ? 'text-ink/60' : 'text-dim')}>{m === 'beginner' ? 'One step at a time, bigger targets' : 'All controls, denser panels'}</span></button>)}</div></div>
          <div className="py-3"><div className="text-sm font-medium mb-2">Text size</div><div className="flex gap-2">{([1, 1.125, 1.25, 1.4] as const).map((v) => <button key={v} onClick={() => set({ textScale: v })} aria-pressed={s.textScale === v} className={cx('flex-1 rounded-xl hairline h-12', s.textScale === v ? 'bg-paper text-ink' : 'hover:bg-white/5')} style={{ fontSize: 14 * v }}>Aa</button>)}</div></div>
          <Toggle checked={s.contrast === 'high'} onChange={(v) => set({ contrast: v ? 'high' : 'normal' })} label="High contrast" desc="Brighter text and stronger borders." />
          <div className="py-3"><div className="text-sm font-medium mb-2">Motion</div><Select value={s.motion} onChange={(e) => set({ motion: e.target.value as S['motion'] })}><option value="system">Follow my device setting</option><option value="reduced">Reduce motion</option><option value="full">Full motion</option></Select></div>
          <Toggle checked={s.familySafe} onChange={(v) => set({ familySafe: v })} label="Family-safe" desc="Asks AI providers for family-safe content and hides mature templates." />
          <div className="py-3 flex items-center justify-between"><span className="text-sm">Read-aloud test</span><ReadAloud text="Read aloud is working. You can use it in Help and in every tool." /></div>
          <Toggle checked={s.toursDone.length === 0} onChange={(v) => set({ toursDone: v ? [] : ['main'] })} label="Show the welcome tour again" />
        </div>
      </Card>
      <Card className="p-6 mb-6">
        <h2 className="font-display text-2xl mb-4">Language</h2>
        <Select value={s.lang} onChange={(e) => set({ lang: e.target.value as S['lang'] })} aria-label="Language">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
        <p className="text-xs text-dim mt-2">Navigation and core labels are translated. Detailed help and tool text are English for now.</p>
      </Card>
      <Card className="p-6 mb-6">
        <h2 className="font-display text-2xl mb-4">Security</h2>
        <div className="grid md:grid-cols-2 gap-3"><Field label="Current password"><Input type="password" value={oldPw} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></Field><Field label="New password"><Input type="password" value={newPw} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></Field></div>
        <Button className="mt-3" icon={<KeyRound className="size-4" />} onClick={changePw} disabled={!oldPw || !newPw}>Change password</Button>
      </Card>
      <Card className="p-6 mb-6">
        <h2 className="font-display text-2xl mb-2">Your data</h2>
        <p className="text-sm text-mute mb-4">Backups include accounts, projects, scenes, timelines, ledger and audit records (not media files, which stay in this browser’s storage).</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="size-4" />} onClick={() => { download(exportBackup(), `obscura-backup-${new Date().toISOString().slice(0, 10)}.json`); audit(user.id, 'backup.export', user.id); }}>Export backup</Button>
          <Button icon={<Upload className="size-4" />} onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; if (!(await confirm({ title: 'Restore backup?', body: 'This replaces all records on this device with the backup.', confirm: 'Restore', danger: true }))) return; try { importBackup(await f.text()); toast('Backup restored.', 'ok'); } catch (e) { toast((e as Error).message, 'bad'); } }; i.click(); }}>Restore backup</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={del}>Delete account</Button>
        </div>
      </Card>
    </div>
  );
}

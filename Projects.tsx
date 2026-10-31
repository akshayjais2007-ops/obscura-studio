import { Copy, Download, FolderOpen, Play, Plus, RotateCcw, Search, Trash2, Film, Image as ImageIcon, Music, Tag, Palette, LayoutTemplate } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Dialog, Empty, Field, Input, PageHeader, Select, Tabs, Textarea, useConfirm, useToast, download, cx } from '../components/ui';
import { AssetThumb, Dropzone } from '../components/shared';
import { JobsList } from '../components/JobsList';
import { useApp } from '../lib/useApp';
import { audit, update } from '../lib/db';
import { createProject, projectDuration } from '../lib/project';
import { ago, bytes, tc, uid } from '../lib/id';
import { blobUrl, delBlob, getBlob, storageEstimate } from '../lib/idb';
import { TEMPLATES } from '../lib/templates';
import type { Asset, BrandKit } from '../lib/types';
import { useEffect } from 'react';

type Tab = 'projects' | 'assets' | 'exports' | 'jobs' | 'brand' | 'templates';

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'projects';
  const { db, workspace, user } = useApp();
  const nav = useNavigate();
  const ps = db.projects.filter((p) => p.workspaceId === workspace?.id && !p.deletedAt);
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt);
  return (
    <div>
      <PageHeader eyebrow="Projects & Assets" title="Your library" desc="Projects, source media and finished exports are stored separately. Sources are never overwritten by renders."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => nav('/app/create')}>New project</Button>} />
      <Tabs className="mb-8" value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'projects', label: 'Projects', count: ps.length }, { id: 'assets', label: 'Media', count: assets.filter((a) => a.source !== 'render').length },
        { id: 'exports', label: 'Exports', count: assets.filter((a) => a.source === 'render').length }, { id: 'jobs', label: 'Jobs', count: db.jobs.filter((j) => j.userId === user.id).length },
        { id: 'brand', label: 'Brand kits', count: db.brandKits.filter((k) => k.workspaceId === workspace?.id).length }, { id: 'templates', label: 'Templates' },
      ]} />
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'assets' && <AssetsTab />}
      {tab === 'exports' && <ExportsTab />}
      {tab === 'jobs' && <JobsList />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'templates' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(TEMPLATES).map((t) => (
            <Link key={t.id} to={`/app/create?flow=${t.id}`} className="rounded-2xl hairline bg-panel p-5 hover:bg-raise">
              <LayoutTemplate className="size-5 text-amber mb-3" /><div className="font-display text-2xl">{t.name}</div>
              <p className="text-sm text-mute mt-1">{t.fields.length} questions · {t.aspect}</p><p className="text-xs text-dim mt-2">{t.mediaHint}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectsTab() {
  const { db, workspace, user, allow } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'name' | 'created'>('updated');
  const [showTrash, setShowTrash] = useState(false);
  const all = db.projects.filter((p) => p.workspaceId === workspace?.id);
  const list = all.filter((p) => (showTrash ? p.deletedAt : !p.deletedAt) && p.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
  const thumb = (pid: string) => {
    const p = db.projects.find((x) => x.id === pid);
    const c = p?.tracks.flatMap((t) => t.clips).find((c) => c.assetId && (c.kind === 'image' || c.kind === 'video'));
    return c ? db.assets.find((a) => a.id === c.assetId) : undefined;
  };
  const remove = async (id: string, title: string) => {
    if (!allow('edit')) return toast('You don’t have permission to delete here.', 'warn');
    if (!(await confirm({ title: 'Move to trash?', body: `“${title}” will move to Trash. You can restore it any time.`, confirm: 'Move to trash', danger: true }))) return;
    update((d) => { const p = d.projects.find((x) => x.id === id); if (p) p.deletedAt = Date.now(); });
    audit(user.id, 'project.trash', id);
    toast('Moved to trash.', 'info', { label: 'Undo', run: () => update((d) => { const p = d.projects.find((x) => x.id === id); if (p) delete p.deletedAt; }) });
  };
  const purge = async (id: string) => {
    if (!(await confirm({ title: 'Delete forever?', body: 'This permanently deletes the project, its snapshots and comments. Media files stay in your library.', confirm: 'Delete forever', danger: true }))) return;
    update((d) => { d.projects = d.projects.filter((p) => p.id !== id); d.snapshots = d.snapshots.filter((s) => s.projectId !== id); d.comments = d.comments.filter((c) => c.projectId !== id); });
    audit(user.id, 'project.purge', id);
  };
  const dup = (id: string) => {
    const p = db.projects.find((x) => x.id === id)!;
    const n = createProject(user.id, p.workspaceId, { ...structuredClone(p), id: undefined as never, title: `${p.title} (copy)`, createdAt: Date.now(), updatedAt: Date.now(), review: 'draft', demo: p.demo });
    toast('Duplicated.', 'ok', { label: 'Open', run: () => nav(`/app/editor/${n.id}`) });
  };
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-48 max-w-sm"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="pl-9" aria-label="Search projects" /></div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as never)} className="w-44" aria-label="Sort"><option value="updated">Recently edited</option><option value="created">Newest</option><option value="name">Name A–Z</option></Select>
        <Button variant={showTrash ? 'primary' : 'ghost'} icon={<Trash2 className="size-4" />} onClick={() => setShowTrash(!showTrash)}>Trash ({all.filter((p) => p.deletedAt).length})</Button>
      </div>
      {!list.length ? (
        <Empty icon={<FolderOpen className="size-5" />} title={showTrash ? 'Trash is empty' : q ? 'No matches' : 'No projects yet'} desc={showTrash ? 'Deleted projects appear here.' : 'Create your first video to see it here.'} action={!showTrash && <Link to="/app/create"><Button variant="primary">Create a video</Button></Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((p) => (
            <Card key={p.id} className="overflow-hidden group">
              <Link to={showTrash ? '#' : `/app/editor/${p.id}`} className="block relative aspect-video bg-raise overflow-hidden">
                <AssetThumb asset={thumb(p.id)} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-700" />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[11px]"><span className="font-mono bg-black/60 rounded px-1.5">{tc(projectDuration(p))}</span><span className="bg-black/60 rounded px-1.5">{p.aspect}</span></div>
                {p.demo && <span className="absolute top-2 left-2 text-[10px] uppercase bg-amber text-ink rounded px-1.5 py-0.5 font-semibold">Demo</span>}
              </Link>
              <div className="p-4">
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-xs text-dim mt-0.5">{ago(p.updatedAt)} · {p.stage} · {p.review.replace('_', ' ')}</div>
                <div className="flex gap-1 mt-3">
                  {showTrash ? (<>
                    <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => update((d) => { const x = d.projects.find((y) => y.id === p.id); if (x) delete x.deletedAt; })}>Restore</Button>
                    <Button size="sm" variant="danger" onClick={() => purge(p.id)}>Delete forever</Button>
                  </>) : (<>
                    <Link to={`/app/editor/${p.id}`}><Button size="sm" variant="ghost">Open</Button></Link>
                    <Button size="sm" variant="quiet" icon={<Copy className="size-3.5" />} onClick={() => dup(p.id)} aria-label={`Duplicate ${p.title}`} />
                    <Button size="sm" variant="quiet" icon={<Trash2 className="size-3.5" />} onClick={() => remove(p.id, p.title)} aria-label={`Delete ${p.title}`} />
                  </>)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function AssetsTab() {
  const { db, workspace, user, allow } = useApp();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [type, setType] = useState<'all' | Asset['type']>('all');
  const [edit, setEdit] = useState<Asset | null>(null);
  const [view, setView] = useState<'grid' | 'dupes'>('grid');
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => { storageEstimate().then(setEst); }, [db.assets.length]);
  const assets = db.assets.filter((a) => a.workspaceId === workspace?.id && !a.deletedAt && a.source !== 'render');
  const list = assets.filter((a) => (type === 'all' || a.type === type) && (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.tags.some((t) => t.includes(q.toLowerCase()))));
  const usage = (id: string) => db.projects.filter((p) => !p.deletedAt && p.tracks.some((t) => t.clips.some((c) => c.assetId === id)));
  const dupes = useMemo(() => {
    const groups = new Map<string, Asset[]>();
    for (const a of assets) { const k = `${a.type}:${a.size}:${Math.round(a.duration)}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
    const byName = new Map<string, Asset[]>();
    for (const a of assets) { const k = a.name.toLowerCase().replace(/\s*\(\d+\)|[-_ ]copy|\.[a-z0-9]+$/g, ''); byName.set(k, [...(byName.get(k) ?? []), a]); }
    return [...groups.values(), ...byName.values()].filter((g) => g.length > 1);
  }, [assets]);
  const remove = async (a: Asset) => {
    const used = usage(a.id);
    if (!(await confirm({ title: `Delete “${a.name}”?`, body: used.length ? `It’s used in ${used.length} project(s): ${used.map((p) => p.title).join(', ')}. Those clips will show “Missing media”.` : 'This removes the file from this device.', confirm: 'Delete', danger: true }))) return;
    update((d) => { const x = d.assets.find((y) => y.id === a.id); if (x) x.deletedAt = Date.now(); });
    audit(user.id, 'asset.delete', a.id, a.name);
    const timer = setTimeout(() => delBlob(a.id), 9000);
    toast('Deleted.', 'info', { label: 'Undo', run: () => { clearTimeout(timer); update((d) => { const x = d.assets.find((y) => y.id === a.id); if (x) delete x.deletedAt; }); } });
  };
  return (
    <>
      {allow('edit') && <div className="mb-6"><Dropzone /></div>}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names and tags" className="pl-9" aria-label="Search media" /></div>
        <Tabs value={type} onChange={setType} tabs={[{ id: 'all', label: 'All' }, { id: 'video', label: 'Video' }, { id: 'image', label: 'Images' }, { id: 'audio', label: 'Audio' }]} />
        <Tabs value={view} onChange={setView} tabs={[{ id: 'grid', label: 'Library' }, { id: 'dupes', label: 'Possible duplicates', count: dupes.length }]} />
        {est && est.quota > 0 && <span className="text-xs text-dim ml-auto">Device storage: {bytes(est.usage)} of {bytes(est.quota)}</span>}
      </div>
      {view === 'dupes' ? (
        dupes.length ? <div className="space-y-4">{dupes.map((g, i) => <Card key={i} className="p-4"><div className="text-sm mb-3">{g.length} files look alike (same size/length or similar names). Exact copies are blocked at upload by SHA-256.</div><div className="flex gap-3 flex-wrap">{g.map((a) => <div key={a.id} className="w-40"><AssetThumb asset={a} className="w-full aspect-video rounded-lg" /><div className="text-xs truncate mt-1">{a.name}</div><div className="text-[10px] text-dim">used in {usage(a.id).length}</div><button className="text-[11px] text-bad" onClick={() => remove(a)}>Delete</button></div>)}</div></Card>)}</div>
          : <Empty icon={<Copy className="size-5" />} title="No likely duplicates" desc="Exact duplicates are detected by fingerprint when you upload." />
      ) : !list.length ? (
        <Empty icon={<ImageIcon className="size-5" />} title={assets.length ? 'No matches' : 'No media yet'} desc="Upload videos, images and audio. They’re checked, fingerprinted and stored on this device." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {list.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <button onClick={() => setEdit(a)} className="block w-full text-left">
                <div className="relative"><AssetThumb asset={a} className="w-full aspect-video" />
                  <span className="absolute top-1.5 left-1.5 size-6 rounded-md bg-black/60 grid place-items-center">{a.type === 'video' ? <Film className="size-3.5" /> : a.type === 'audio' ? <Music className="size-3.5" /> : <ImageIcon className="size-3.5" />}</span>
                  {a.demo && <span className="absolute top-1.5 right-1.5 text-[9px] uppercase bg-amber text-ink rounded px-1 font-bold">demo</span>}
                </div>
                <div className="p-3"><div className="text-sm truncate">{a.name}</div><div className="text-[11px] text-dim">{bytes(a.size)}{a.duration ? ` · ${tc(a.duration)}` : ''} · used in {usage(a.id).length}</div>
                  <div className="flex flex-wrap gap-1 mt-2">{a.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-mute">{t}</span>)}{!a.license && <span className="text-[10px] rounded bg-warn/15 text-warn px-1.5 py-0.5">no license</span>}</div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
      <AssetDialog asset={edit} onClose={() => setEdit(null)} onDelete={(a) => { setEdit(null); remove(a); }} usage={edit ? usage(edit.id).map((p) => p.title) : []} />
    </>
  );
}

function AssetDialog({ asset, onClose, onDelete, usage }: { asset: Asset | null; onClose: () => void; onDelete: (a: Asset) => void; usage: string[] }) {
  const [tags, setTags] = useState('');
  const [license, setLicense] = useState('');
  const [attr, setAttr] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const { user } = useApp();
  const toast = useToast();
  useEffect(() => { if (asset) { setTags(asset.tags.join(', ')); setLicense(asset.license); setAttr(asset.attribution); blobUrl(asset.id).then(setUrl); } else setUrl(null); }, [asset]);
  if (!asset) return <Dialog open={false} onClose={onClose} title=""><span /></Dialog>;
  const save = () => {
    update((d) => { const a = d.assets.find((x) => x.id === asset.id); if (a) { a.tags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean); a.license = license.trim(); a.attribution = attr.trim(); } });
    audit(user.id, 'asset.update', asset.id, `license=${license}`);
    toast('Saved.', 'ok'); onClose();
  };
  return (
    <Dialog open={!!asset} onClose={onClose} title={asset.name} wide footer={<><Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => onDelete(asset)}>Delete</Button><div className="flex-1" /><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          {url && asset.type === 'video' && <video src={url} controls className="w-full rounded-xl bg-black" />}
          {url && asset.type === 'image' && <img src={url} alt={asset.name} className="w-full rounded-xl" />}
          {url && asset.type === 'audio' && <><AssetThumb asset={asset} className="w-full h-24 rounded-xl" /><audio src={url} controls className="w-full mt-2" /></>}
          <dl className="grid grid-cols-2 gap-2 text-xs mt-4">
            {[['Type', asset.mime], ['Size', bytes(asset.size)], ['Dimensions', asset.width ? `${asset.width}×${asset.height}` : '—'], ['Length', asset.duration ? tc(asset.duration) : '—'], ['Source', asset.source], ['Fingerprint', asset.hash.slice(0, 12) + '…'], ['Uploaded', new Date(asset.createdAt).toLocaleString()]].map(([a, b]) => <div key={a}><dt className="text-dim">{a}</dt><dd className="font-mono truncate">{b}</dd></div>)}
          </dl>
        </div>
        <div className="space-y-4">
          <Field label="Tags" hint="Comma-separated. Used by search and Auto B-Roll."><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
          <Field label="License" hint="What you’re allowed to do with it. We never fill this in for you."><Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="e.g. Own footage · CC BY 4.0 · Pexels License" /></Field>
          <Field label="Attribution"><Textarea value={attr} onChange={(e) => setAttr(e.target.value)} placeholder="e.g. Photo by Jane Doe via Unsplash" rows={2} /></Field>
          <div><div className="text-sm font-medium mb-1 flex items-center gap-1.5"><Tag className="size-3.5" />Used in</div>{usage.length ? <ul className="text-sm text-mute list-disc pl-5">{usage.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-sm text-dim">Not used in any project.</p>}</div>
        </div>
      </div>
    </Dialog>
  );
}

function ExportsTab() {
  const { db, workspace, user } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const [play, setPlay] = useState<{ url: string; name: string } | null>(null);
  const list = db.assets.filter((a) => a.workspaceId === workspace?.id && a.source === 'render' && !a.deletedAt);
  if (!list.length) return <Empty icon={<Film className="size-5" />} title="No exports yet" desc="Open a project and press Export. Real files appear here." />;
  return (
    <>
      <div className="space-y-2">
        {list.map((a) => {
          const p = db.projects.find((x) => x.id === a.projectId);
          return (
            <div key={a.id} className="flex items-center gap-4 rounded-2xl hairline p-3 bg-panel/60">
              <button onClick={async () => { const u = await blobUrl(a.id); if (u) setPlay({ url: u, name: a.name }); else toast('File not found on this device.', 'bad'); }} className="size-12 rounded-xl bg-white/5 grid place-items-center hover:bg-white/10" aria-label={`Play ${a.name}`}><Play className="size-4" /></button>
              <div className="flex-1 min-w-0"><div className="text-sm truncate">{a.name}</div><div className="text-xs text-dim">{a.width}×{a.height} · {tc(a.duration)} · {bytes(a.size)} · {a.mime} · {ago(a.createdAt)}{p ? ` · from “${p.title}”` : ''}</div></div>
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={async () => { const b = await getBlob(a.id); if (b) download(b, a.name); }}>Download</Button>
              <Button size="sm" variant="quiet" icon={<Trash2 className="size-3.5" />} aria-label="Delete export" onClick={async () => { if (await confirm({ title: 'Delete this export?', body: 'The project stays; you can export again.', confirm: 'Delete', danger: true })) { update((d) => { const x = d.assets.find((y) => y.id === a.id); if (x) x.deletedAt = Date.now(); }); delBlob(a.id); audit(user.id, 'render.delete', a.id); } }} />
            </div>
          );
        })}
      </div>
      <Dialog open={!!play} onClose={() => setPlay(null)} title={play?.name ?? ''} wide>{play && <video src={play.url} controls autoPlay className="w-full rounded-xl bg-black" />}</Dialog>
    </>
  );
}

function BrandTab() {
  const { db, workspace, user, allow } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const kits = db.brandKits.filter((k) => k.workspaceId === workspace?.id);
  const [edit, setEdit] = useState<BrandKit | null>(null);
  const logos = db.assets.filter((a) => a.workspaceId === workspace?.id && a.type === 'image' && !a.deletedAt);
  const blank = (): BrandKit => ({ id: uid('bk_'), workspaceId: workspace.id, name: 'New brand', colors: ['#e9b56a', '#f3eee5', '#9a8cff'], headingFont: 'display', bodyFont: 'sans', disclaimer: '', createdAt: Date.now() });
  const save = () => {
    if (!edit) return;
    update((d) => { const i = d.brandKits.findIndex((k) => k.id === edit.id); if (i >= 0) d.brandKits[i] = edit; else d.brandKits.push(edit); });
    audit(user.id, 'brandkit.save', edit.id, edit.name);
    toast('Brand kit saved.', 'ok'); setEdit(null);
  };
  return (
    <>
      <div className="flex justify-between mb-5"><p className="text-sm text-mute max-w-lg">Brand kits hold colors, fonts, logo and required disclaimers. Brand Guardian checks videos against them.</p>{allow('edit') && <Button icon={<Plus className="size-4" />} onClick={() => setEdit(blank())}>New brand kit</Button>}</div>
      {!kits.length ? <Empty icon={<Palette className="size-5" />} title="No brand kits" desc="Create one to keep every video on-brand." /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {kits.map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex gap-1.5 mb-4">{k.colors.map((c) => <span key={c} className="size-8 rounded-lg border border-line2" style={{ background: c }} />)}</div>
              <div className="font-display text-2xl">{k.name}</div>
              <div className="text-xs text-dim mt-1">Headings: {k.headingFont} · Body: {k.bodyFont}{k.disclaimer ? ' · has disclaimer' : ''}</div>
              <div className="flex gap-1 mt-4"><Button size="sm" onClick={() => setEdit(structuredClone(k))}>Edit</Button><Link to={`/app/tool/brand-guardian`}><Button size="sm" variant="quiet">Check a video</Button></Link>
                <Button size="sm" variant="quiet" icon={<Trash2 className="size-3.5" />} aria-label="Delete brand kit" onClick={async () => { if (await confirm({ title: 'Delete brand kit?', body: k.name, confirm: 'Delete', danger: true })) update((d) => { d.brandKits = d.brandKits.filter((x) => x.id !== k.id); }); }} /></div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onClose={() => setEdit(null)} title="Brand kit" footer={<><Button variant="quiet" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div><div className="text-sm font-medium mb-2">Colors</div><div className="flex gap-2 flex-wrap">{edit.colors.map((c, i) => <div key={i} className="flex flex-col items-center gap-1"><input type="color" value={c} onChange={(e) => { const cs = [...edit.colors]; cs[i] = e.target.value; setEdit({ ...edit, colors: cs }); }} className="size-10 rounded bg-transparent" aria-label={`Color ${i + 1}`} /><button className="text-[10px] text-dim hover:text-bad" onClick={() => setEdit({ ...edit, colors: edit.colors.filter((_, j) => j !== i) })}>remove</button></div>)}{edit.colors.length < 6 && <button className="size-10 rounded-lg hairline grid place-items-center" onClick={() => setEdit({ ...edit, colors: [...edit.colors, '#ffffff'] })} aria-label="Add color"><Plus className="size-4" /></button>}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heading font"><Select value={edit.headingFont} onChange={(e) => setEdit({ ...edit, headingFont: e.target.value as never })}><option value="display">Serif display</option><option value="sans">Grotesk</option><option value="mono">Mono</option></Select></Field>
              <Field label="Body font"><Select value={edit.bodyFont} onChange={(e) => setEdit({ ...edit, bodyFont: e.target.value as never })}><option value="sans">Grotesk</option><option value="display">Serif display</option><option value="mono">Mono</option></Select></Field>
            </div>
            <Field label="Logo" hint="Pick an uploaded image."><Select value={edit.logoAssetId ?? ''} onChange={(e) => setEdit({ ...edit, logoAssetId: e.target.value || undefined })}><option value="">None</option>{logos.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Required disclaimer" hint="Brand Guardian flags videos where this doesn’t appear on screen."><Textarea value={edit.disclaimer} onChange={(e) => setEdit({ ...edit, disclaimer: e.target.value })} rows={2} placeholder="e.g. Results may vary. Not financial advice." /></Field>
          </div>
        )}
      </Dialog>
      <span className={cx('hidden')} />
    </>
  );
}

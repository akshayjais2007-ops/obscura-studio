import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, signUp, passwordProblems, useUser } from '../lib/auth';
import { Button, Field, Input, cx } from '../components/ui';
import { Logo } from '../components/shared';
import { update, getDB } from '../lib/db';
import { setSettings } from '../lib/i18n';
import { ease } from '../lib/motion';
import { Eye, EyeOff, Sparkles, Smartphone, Youtube, Megaphone, GraduationCap, Mic, Heart, Users } from 'lucide-react';

function Frame({ children, title, sub }: { children: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 grain">
      <div className="relative hidden lg:block overflow-hidden">
        <img src="/media/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink" />
        <div className="absolute bottom-12 left-12 max-w-md">
          <p className="font-display text-5xl leading-[1] italic">“The tools disappear. The story stays.”</p>
        </div>
      </div>
      <div className="flex flex-col px-6 md:px-16 py-10">
        <Link to="/" aria-label="Home"><Logo /></Link>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: ease.out }} className="my-auto w-full max-w-md py-10">
          <h1 className="font-display text-5xl leading-none">{title}</h1>
          <p className="text-mute mt-3 mb-8">{sub}</p>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const id = await signIn(email, pw);
      const u = getDB().users.find((x) => x.id === id);
      nav(u?.onboarded ? '/app' : '/onboarding');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Frame title="Welcome back" sub="Sign in to your studio.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password">
          <div className="relative"><Input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required className="pr-11" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 size-8 grid place-items-center text-dim hover:text-paper" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
        </Field>
        {err && <p role="alert" className="text-sm text-bad bg-bad/10 rounded-xl px-3 py-2">{err}</p>}
        <Button variant="primary" size="lg" className="w-full" loading={busy} type="submit">Sign in</Button>
      </form>
      <p className="text-sm text-mute mt-6">New here? <Link to="/signup" className="text-amber hover:underline">Create a free account</Link></p>
      <p className="text-xs text-dim mt-8 leading-relaxed">Accounts are stored securely on this device (passwords hashed with PBKDF2). Multi-device sign-in activates when the hosted database is connected.</p>
    </Frame>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const probs = pw ? passwordProblems(pw) : [];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await signUp(name, email, pw); nav('/onboarding'); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Frame title="Make your first film" sub="Free forever plan · 200 credits every month · no card needed.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your name"><Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint={probs.length ? probs.join(' · ') : pw ? 'Strong enough ✓' : 'At least 8 characters with a number or symbol'}>
          <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {err && <p role="alert" className="text-sm text-bad bg-bad/10 rounded-xl px-3 py-2">{err}</p>}
        <Button variant="primary" size="lg" className="w-full" loading={busy} type="submit">Create account</Button>
      </form>
      <p className="text-sm text-mute mt-6">Already have an account? <Link to="/login" className="text-amber hover:underline">Sign in</Link></p>
    </Frame>
  );
}

const INTENTS = [
  { id: 'shorts', label: 'Shorts & Reels', icon: Smartphone },
  { id: 'youtube', label: 'YouTube videos', icon: Youtube },
  { id: 'ads', label: 'Business & ads', icon: Megaphone },
  { id: 'learn', label: 'Teaching', icon: GraduationCap },
  { id: 'podcasts', label: 'Podcasts & gaming', icon: Mic },
  { id: 'personal', label: 'Family & personal', icon: Heart },
  { id: 'agency', label: 'Client work', icon: Users },
  { id: 'create', label: 'Just exploring', icon: Sparkles },
];

export function Onboarding() {
  const user = useUser();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState('');
  const [mode, setMode] = useState<'beginner' | 'pro'>('beginner');
  const [big, setBig] = useState(false);
  if (!user) return null;
  const finish = () => {
    update((d) => { const u = d.users.find((x) => x.id === user.id); if (u) { u.onboarded = true; u.intent = intent; } });
    setSettings(user.id, { mode, textScale: big ? 1.25 : 1 });
    nav(intent && intent !== 'create' ? `/app/hub/${intent === 'agency' ? 'agency' : intent}` : '/app');
  };
  return (
    <div className="min-h-screen grain flex flex-col px-6 md:px-16 py-10">
      <div className="flex justify-between items-center"><Logo /><div className="font-mono text-xs text-dim">Step {step + 1} of 3</div></div>
      <motion.div key={step} initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease: ease.out }} className="my-auto mx-auto w-full max-w-2xl py-10">
        {step === 0 && (
          <>
            <h1 className="font-display text-5xl md:text-6xl">Hi {user.name.split(' ')[0]}. What will you make?</h1>
            <p className="text-mute mt-3 mb-8">Pick one — you can do everything later.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {INTENTS.map(({ id, label, icon: I }) => (
                <button key={id} onClick={() => setIntent(id)} aria-pressed={intent === id} className={cx('rounded-2xl hairline p-5 text-left transition-all min-h-28', intent === id ? 'bg-paper text-ink' : 'bg-panel hover:bg-raise')}>
                  <I className="size-6 mb-4" /><div className="font-medium text-sm">{label}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="font-display text-5xl md:text-6xl">How much control do you want?</h1>
            <p className="text-mute mt-3 mb-8">Switch anytime from the top bar.</p>
            <div className="grid md:grid-cols-2 gap-4">
              {[['beginner', 'Beginner', 'One clear step per screen, plain words, big buttons. Recommended.'], ['pro', 'Pro', 'All editor controls, keyboard-first, dense panels.']].map(([id, t, d]) => (
                <button key={id} onClick={() => setMode(id as 'beginner' | 'pro')} aria-pressed={mode === id} className={cx('rounded-3xl hairline p-7 text-left', mode === id ? 'bg-paper text-ink' : 'bg-panel hover:bg-raise')}>
                  <div className="font-display text-3xl">{t}</div><p className={cx('text-sm mt-2', mode === id ? 'text-ink/70' : 'text-mute')}>{d}</p>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="font-display text-5xl md:text-6xl">Make it comfortable.</h1>
            <p className="text-mute mt-3 mb-8">More options live in Settings.</p>
            <button onClick={() => setBig(!big)} aria-pressed={big} className={cx('w-full rounded-3xl hairline p-7 text-left flex items-center justify-between', big ? 'bg-paper text-ink' : 'bg-panel')}>
              <div><div className="font-display text-3xl">Larger text</div><p className={cx('text-sm mt-1', big ? 'text-ink/70' : 'text-mute')}>Makes all text 25% bigger.</p></div>
              <span className="text-3xl font-display">{big ? 'Aa' : 'Aa'}</span>
            </button>
          </>
        )}
        <div className="flex justify-between mt-10">
          <Button variant="quiet" onClick={() => (step ? setStep(step - 1) : finish())}>{step ? 'Back' : 'Skip'}</Button>
          <Button variant="primary" size="lg" onClick={() => (step < 2 ? setStep(step + 1) : finish())} disabled={step === 0 && !intent}>{step < 2 ? 'Continue' : 'Enter the studio'}</Button>
        </div>
      </motion.div>
    </div>
  );
}

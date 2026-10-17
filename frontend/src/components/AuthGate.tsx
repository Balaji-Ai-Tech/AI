'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Mail, UserRound, Waves } from 'lucide-react';
import { AuthUser, clearAuthSession, createGuestSession, getAuthToken, getCurrentAccount, loginAccount, registerAccount, saveAuthSession } from '../utils/api';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handleLogout = () => setUser(null);
    window.addEventListener('transformhub:logout', handleLogout);
    const token = getAuthToken();
    if (!token) { setReady(true); return () => window.removeEventListener('transformhub:logout', handleLogout); }
    getCurrentAccount().then((account) => {
      if (cancelled) return;
      setUser(account);
      localStorage.setItem('transformhub_user', JSON.stringify({ name: account.name, email: account.email, role: account.role, organization: 'TransformHub Workspace', twoFactorEnabled: false }));
    }).catch(() => { if (!cancelled) clearAuthSession(); }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; window.removeEventListener('transformhub:logout', handleLogout); };
  }, []);

  const finishSignIn = (session: Awaited<ReturnType<typeof loginAccount>>) => {
    saveAuthSession(session);
    setUser(session.user);
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const session = creatingAccount
        ? await registerAccount({ name: name.trim(), email: email.trim(), password })
        : await loginAccount({ email: email.trim(), password });
      finishSignIn(session);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  const continueAsGuest = async () => {
    setBusy(true); setError('');
    try { finishSignIn(await createGuestSession()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Guest workspace could not be started.'); }
    finally { setBusy(false); }
  };

  if (user) return <>{children}</>;
  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#061026] text-sm text-slate-300">Loading your secure workspace…</main>;
  return <main className="flex min-h-screen items-center justify-center bg-[#061026] px-4 py-10 text-slate-100">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl md:grid-cols-[1fr_.9fr]">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-indigo-950 via-slate-950 to-cyan-950 p-10 md:flex">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Waves className="h-5 w-5"/></div><div><p className="text-sm font-bold tracking-widest text-white">TRANSFORMHUB AI</p><p className="text-xs text-slate-400">Enterprise content pipeline</p></div></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">One source. Many audiences.</p><h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight text-white">Turn source documents into clear, reviewable deliverables.</h1><p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Transform, review, and export in your audience’s language with a focused seven-step workspace.</p></div>
        <p className="text-xs text-slate-500">Your projects are kept in your own account workspace.</p>
      </section>
      <section className="p-6 sm:p-10">
        <div className="mb-8 md:hidden"><p className="text-sm font-bold tracking-widest text-white">TRANSFORMHUB AI</p><p className="mt-1 text-xs text-slate-400">Enterprise content pipeline</p></div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Welcome</p><h2 className="mt-2 text-2xl font-semibold text-white">{creatingAccount ? 'Create your account' : 'Sign in to TransformHub'}</h2><p className="mt-2 text-sm text-slate-400">Your workspace and projects stay isolated to your account.</p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {creatingAccount && <label className="block text-sm text-slate-300">Name<div className="relative mt-1.5"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-500"/><input autoComplete="name" required minLength={2} maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 py-2.5 pl-10 pr-3 text-white outline-none focus:border-violet-400/60" placeholder="Your name"/></div></label>}
          <label className="block text-sm text-slate-300">Email<div className="relative mt-1.5"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500"/><input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 py-2.5 pl-10 pr-3 text-white outline-none focus:border-violet-400/60" placeholder="you@example.com"/></div></label>
          <label className="block text-sm text-slate-300">Password<div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-500"/><input autoComplete={creatingAccount ? 'new-password' : 'current-password'} required minLength={creatingAccount ? 8 : 1} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-900 py-2.5 pl-10 pr-3 text-white outline-none focus:border-violet-400/60" placeholder={creatingAccount ? 'At least 8 characters' : 'Your password'}/></div></label>
          <button disabled={busy} className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{busy ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in'}</button>
        </form>
        <button disabled={busy} onClick={() => { setCreatingAccount(!creatingAccount); setError(''); }} className="mt-4 w-full text-sm text-violet-300 hover:text-violet-200">{creatingAccount ? 'Already have an account? Sign in' : 'New to TransformHub? Create an account'}</button>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/10"/>or<span className="h-px flex-1 bg-white/10"/></div>
        <button disabled={busy} onClick={continueAsGuest} className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 hover:border-white/20 disabled:opacity-50">{busy ? 'Starting…' : 'Continue with a private guest workspace'}</button>
        <p className="mt-3 text-center text-xs leading-5 text-slate-500">Guest workspaces are private to this browser session and can’t be recovered if you clear this browser’s data.</p>
      </section>
    </div>
  </main>;
}

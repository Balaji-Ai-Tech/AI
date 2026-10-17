import React, { useState } from 'react';
import { ArrowRight, Play, X, Sparkles, FileText, Languages, ShieldCheck, Workflow, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LanguageSelector } from './LanguageSelector';

export const SplashView: React.FC = () => {
  const { setCurrentRoute, t } = useApp();
  const [showTour, setShowTour] = useState(false);

  const handleProceed = () => setCurrentRoute('dashboard');

  return (
    <main className="th-splash relative min-h-screen w-full overflow-hidden text-slate-100">
      <div className="th-orb th-orb-one" aria-hidden="true" />
      <div className="th-orb th-orb-two" aria-hidden="true" />
      <div className="th-grid" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <img src="/brand/transformhub-logo.svg" alt="TransformHub AI logo" className="h-11 w-11" />
          <div>
            <div className="text-sm font-extrabold tracking-[0.12em] text-white">TRANSFORMHUB <span className="text-cyan-300">AI</span></div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-500">Content intelligence workspace</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-slate-300 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Private-by-design workflow
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-8 md:px-10 md:pb-24 md:pt-12 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3.5 py-2 text-xs font-semibold text-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> ONE TRUSTED CORE. MANY AUDIENCE-READY OUTPUTS.
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
            Turn complex information into <span className="th-gradient-text">clear action.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
            Transform reports, documents, presentations and media into accurate summaries, advisories, briefings and content tailored to every audience.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={handleProceed} className="th-primary-button group inline-flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-300/70">
              {t('Get Started')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button onClick={() => setShowTour(true)} className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-300/50">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/40 bg-cyan-300/10 text-cyan-200"><Play className="ml-0.5 h-3.5 w-3.5 fill-current" /></span>
              {t('Play product tour')} <span className="text-xs font-normal text-slate-500">0:12</span>
            </button>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Human review built in</span>
            <span className="inline-flex items-center gap-2"><Workflow className="h-4 w-4 text-cyan-300" /> Traceable workflow</span>
            <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4 text-violet-300" /> Multi-audience outputs</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[610px]">
          <div className="th-preview-glow" aria-hidden="true" />
          <div className="th-product-window relative overflow-hidden rounded-[26px] border border-white/15 bg-[#0b1325]/95 p-4 shadow-2xl shadow-violet-950/50 sm:p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <img src="/brand/transformhub-logo.svg" alt="" className="h-8 w-8" />
                <div><div className="text-xs font-bold text-white">Transform workspace</div><div className="mt-0.5 text-[10px] text-slate-500">Live pipeline preview</div></div>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">READY</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 py-4">
              {[{icon: FileText,label:'Sources',value:'04 files',color:'violet'},{icon: Workflow,label:'Knowledge core',value:'Unified',color:'cyan'},{icon: Sparkles,label:'Outputs',value:'08 formats',color:'emerald'}].map((item) => {
                const Icon = item.icon;
                return <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 sm:p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${item.color === 'violet' ? 'bg-violet-400/15 text-violet-200' : item.color === 'cyan' ? 'bg-cyan-400/15 text-cyan-200' : 'bg-emerald-400/15 text-emerald-200'}`}><Icon className="h-4 w-4" /></div><div className="text-[10px] text-slate-500 sm:text-xs">{item.label}</div><div className="mt-1 text-xs font-bold text-slate-100 sm:text-sm">{item.value}</div></div>;
              })}
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#080f1e] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-bold text-slate-100">Transformation pipeline</div><div className="mt-1 text-[10px] text-slate-500">One source → many useful formats</div></div><span className="text-[10px] font-mono text-cyan-200">01 / 04</span></div>
              <div className="space-y-3">
                {[{n:'01',title:'Ingest & extract',desc:'PDF · DOCX · PPTX · media',width:'100%',tone:'from-violet-500 to-indigo-400'},{n:'02',title:'Understand the content',desc:'Title · summary · key information',width:'82%',tone:'from-indigo-400 to-cyan-300'},{n:'03',title:'Generate audience-ready outputs',desc:'Briefings · advisories · social · slides',width:'64%',tone:'from-cyan-300 to-emerald-300'}].map((step) => <div key={step.n} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] font-mono text-[10px] text-slate-300">{step.n}</span><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-200">{step.title}</div><div className="mt-1 truncate text-[10px] text-slate-500">{step.desc}</div></div><ChevronRight className="h-4 w-4 text-slate-600" /></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full bg-gradient-to-r ${step.tone}`} style={{width:step.width}} /></div></div>)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-2.5"><div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Human review remains in control</div><span className="text-[10px] font-semibold text-cyan-200">Evidence-aware AI</span></div>
          </div>
          <div className="th-floating-chip th-chip-top hidden items-center gap-2 rounded-xl border border-white/10 bg-[#111b30]/95 px-3 py-2.5 text-xs text-slate-200 shadow-xl sm:flex"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-4 w-4" /></span><span><b className="block text-[11px]">Trusted output</b><small className="text-[10px] text-slate-500">Review before export</small></span></div>
          <div className="th-floating-chip th-chip-bottom hidden items-center gap-2 rounded-xl border border-white/10 bg-[#111b30]/95 px-3 py-2.5 text-xs text-slate-200 shadow-xl sm:flex"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200"><Sparkles className="h-4 w-4" /></span><span><b className="block text-[11px]">One knowledge core</b><small className="text-[10px] text-slate-500">Many formats & audiences</small></span></div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/[0.07] px-5 py-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between md:px-10">
        <span>© {new Date().getFullYear()} TransformHub AI</span><span>Transform once. Communicate everywhere.</span>
      </footer>

      {showTour && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="TransformHub AI product tour" onClick={(e) => { if (e.target === e.currentTarget) setShowTour(false); }}>
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#0b1325] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5"><div className="flex items-center gap-2.5"><img src="/brand/transformhub-logo.svg" alt="" className="h-7 w-7" /><div><div className="text-sm font-semibold text-white">TransformHub AI product tour</div><div className="text-[10px] text-slate-500">A quick look at the transformation pipeline</div></div></div><button onClick={() => setShowTour(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Close product tour"><X className="h-5 w-5" /></button></div>
          <video className="aspect-video w-full bg-black" controls autoPlay playsInline preload="metadata" poster="/media/transformhub-poster.jpg"><source src="/media/transformhub-product-tour.mp4" type="video/mp4" />Your browser does not support embedded video.</video>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs leading-5 text-slate-400">See how multiple sources become structured, audience-ready deliverables with a review step before export.</p><button onClick={handleProceed} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-400">Get Started <ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
      </div>}
    </main>
  );
};

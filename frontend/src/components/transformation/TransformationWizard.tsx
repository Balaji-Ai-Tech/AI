'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PROFESSIONAL_TEMPLATES } from '../../data/templates';
import { CONTENT_LANGUAGES, toggleContentLanguage } from '../../utils/contentLanguages';
import { createTransformation, downloadTransformationExport, generateTransformationOutputs, listTransformationOutputs, reviewTransformationOutput, uploadRssSource, uploadTextSource, uploadTransformationFiles, uploadUrlSource, type ExportFormat, type GeneratedOutput } from '../../utils/api';
import { OUTPUT_TYPE_MAP, toOutputItem } from '../../utils/transformationOutputs';

const OUTPUTS = Object.keys(OUTPUT_TYPE_MAP);
const STEPS = [
  ['upload', 'Source'], ['title-summary', 'Information'], ['configure', 'Configure'],
  ['templates', 'Templates'], ['generate', 'Generate'], ['review', 'Review'], ['export', 'Export'],
] as const;
const ACCEPTED = '.pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json,.xml,.html,.htm,.log,.rtf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,.mov,.webm,.avi,.mkv,.m4v';
const formats: ExportFormat[] = ['md', 'txt', 'docx', 'pdf', 'pptx', 'html', 'json'];
function supportedFormats(outputType: string): ExportFormat[] {
  if (outputType === 'executive_summary') return ['pdf', 'docx', 'txt', 'json', 'md'];
  if (outputType === 'advisory') return ['pdf', 'docx', 'html', 'json', 'md'];
  if (outputType === 'presentation') return ['pptx', 'pdf', 'md'];
  if (['linkedin', 'x_post', 'x_thread'].includes(outputType)) return ['txt', 'docx', 'html', 'json', 'md'];
  if (outputType === 'infographic') return ['pdf', 'html', 'json', 'md'];
  if (outputType === 'video_package') return ['docx', 'pdf', 'txt', 'json', 'md'];
  return formats.filter((format) => format !== 'pptx');
}
type SourceMode = 'file' | 'url' | 'rss' | 'text';

function classes(active: boolean) { return `rounded-lg border px-3 py-2 text-sm transition ${active ? 'border-violet-400 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20'}`; }

export function TransformationWizard() {
  const { transformationState: state, updateTransformationState, setTransformationStep, saveCompletedTransformation, showToast, setCurrentRoute } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('file');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [dragging, setDragging] = useState(false);
  const step = state.currentStep;
  const config = state.configuration;
  const selectedIndex = STEPS.findIndex(([id]) => id === step);

  useEffect(() => {
    if (!state.backendTransformationId || outputs.length) return;
    let cancelled = false;
    listTransformationOutputs(state.backendTransformationId).then((items) => { if (!cancelled) { setOutputs(items); updateTransformationState({ outputs: items.map(toOutputItem) }); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [state.backendTransformationId]);

  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request failed.'); } finally { setBusy(false); } };
  const setConfig = (patch: Partial<typeof config>) => updateTransformationState({ configuration: { ...config, ...patch } });
  const updateFiles = (selection: File[]) => {
    const total = selection.reduce((sum, file) => sum + file.size, 0);
    if (selection.length > 10) return setError('Choose up to 10 files per transformation.');
    if (selection.some((file) => file.size > 50 * 1024 * 1024) || total > 200 * 1024 * 1024) return setError('Each file must be 50 MB or smaller and the total batch must be 200 MB or smaller.');
    setError(''); setFiles(selection);
  };
  const updateMetadata = async () => {
    const patch = { title: state.title.trim() || state.source?.name || 'New transformation', summary: state.summary.trim(), configuration: config as unknown as Record<string, unknown> };
    if (state.backendTransformationId) await import('../../utils/api').then(({ updateTransformation }) => updateTransformation(state.backendTransformationId!, patch));
    updateTransformationState({ title: patch.title });
  };
  const persistSource = async () => {
    let extractedSummary = '';
    if (!state.backendTransformationId) {
      const project = await createTransformation({ title: state.title.trim() || files[0]?.name || 'New transformation', summary: state.summary, configuration: config as unknown as Record<string, unknown> });
      updateTransformationState({ backendTransformationId: project.id, title: project.title });
      if (sourceMode === 'file') extractedSummary = (await uploadTransformationFiles(project.id, files)).summary;
      else if (sourceMode === 'url') extractedSummary = (await uploadUrlSource(project.id, sourceUrl.trim())).summary;
      else if (sourceMode === 'rss') extractedSummary = (await uploadRssSource(project.id, sourceUrl.trim())).summary;
      else extractedSummary = (await uploadTextSource(project.id, 'pasted-source.txt', sourceText.trim())).summary;
    }
    const name = sourceMode === 'file' ? (files.length === 1 ? files[0].name : `${files.length} source files`) : sourceMode === 'text' ? 'Pasted text' : sourceUrl.trim();
    updateTransformationState({ source: { name, size: files.reduce((sum, file) => sum + file.size, 0), type: sourceMode === 'file' ? files[0]?.type || 'document' : sourceMode === 'text' ? 'text/plain' : 'text/html (Web Document)', uploadedAt: new Date().toISOString(), sourceKind: sourceMode === 'file' ? 'file' : sourceMode === 'rss' ? 'rss' : 'url', sourceUrl: sourceMode === 'text' ? undefined : sourceUrl.trim() }, ...(extractedSummary ? { summary: extractedSummary } : {}) });
    setNotice('Source saved to the backend. You can continue with its title and scope.');
    setTransformationStep('title-summary');
  };
  const sourceReady = sourceMode === 'file' ? files.length > 0 : sourceMode === 'text' ? sourceText.trim().length >= 20 : /^https?:\/\//i.test(sourceUrl.trim());
  const suggestSummary = () => {
    if (state.summary.trim()) setNotice('Source synopsis is ready. Review or edit it before continuing.');
    else setNotice('No extracted synopsis is available for this source. Add context manually or continue; the source chunks are still used for grounded generation.');
  };
  const selectTemplate = (template: typeof PROFESSIONAL_TEMPLATES[number]) => {
    const recommended = template.recommendedOutputs.filter((name) => OUTPUT_TYPE_MAP[name]);
    updateTransformationState({ selectedTemplateId: template.id, configuration: { ...config, outputTypes: recommended.length ? recommended : config.outputTypes, audience: template.defaultAudience, tone: template.defaultTone, objective: template.defaultObjective } });
  };
  const generate = () => run(async () => {
    if (!state.backendTransformationId) throw new Error('Save a source before generating deliverables.');
    if (!config.outputTypes.length) throw new Error('Select at least one deliverable.');
    if (!config.languages.length) throw new Error('Select at least one target language.');
    if (config.outputTypes.length * config.languages.length > 40) throw new Error('Generate no more than 40 deliverable-language combinations at once. Select fewer formats or languages, then run the remaining outputs separately.');
    await updateMetadata();
    setTransformationStep('generate');
    const response = await generateTransformationOutputs(state.backendTransformationId, config.outputTypes.map((name) => OUTPUT_TYPE_MAP[name] || name), config.languages);
    setOutputs(response.outputs); updateTransformationState({ outputs: response.outputs.map(toOutputItem) });
    saveCompletedTransformation({ backendTransformationId: state.backendTransformationId, status: response.outputs.length ? 'In Review' : 'Failed' });
    if (response.failed_outputs.length) setError(`Some deliverables could not be generated:\n${response.failed_outputs.map((item) => `${item.output_type} (${item.language}): ${item.error}`).join('\n')}`);
    if (response.outputs.length) setTransformationStep('review');
    else if (!response.failed_outputs.length) setError('No outputs were returned. Check the generation provider configuration and retry.');
  });
  const refreshOutputs = () => run(async () => { if (!state.backendTransformationId) return; const rows = await listTransformationOutputs(state.backendTransformationId); setOutputs(rows); updateTransformationState({ outputs: rows.map(toOutputItem) }); });
  const saveReview = (output: GeneratedOutput, decision: 'save' | 'approve' | 'reject', content = output.content) => run(async () => {
    if (!state.backendTransformationId) throw new Error('This project is not connected to the backend.');
    const result = await reviewTransformationOutput(state.backendTransformationId, output.id, { decision, comment, edited_content: content });
    const next = outputs.map((item) => item.id === output.id ? result.output : item); setOutputs(next); updateTransformationState({ outputs: next.map(toOutputItem) });
    saveCompletedTransformation({ backendTransformationId: state.backendTransformationId, status: next.every((item) => item.status === 'approved') ? 'Completed' : 'In Review' }); setComment(''); showToast(decision === 'approve' ? 'Deliverable approved.' : 'Review changes saved.');
  });
  const download = (output: GeneratedOutput, format: ExportFormat) => run(async () => {
    if (output.status !== 'approved') throw new Error('Approve this deliverable before exporting.');
    const blob = await downloadTransformationExport(state.backendTransformationId!, output.id, format); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${output.title.replace(/[^a-z0-9-_]+/gi, '_')}.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const goNext = () => {
    if (step === 'upload') return run(persistSource);
    if (step === 'title-summary') return run(async () => { await updateMetadata(); setTransformationStep('configure'); });
    if (step === 'configure') return run(async () => { if (!config.outputTypes.length) throw new Error('Select at least one deliverable.'); if (!config.languages.length) throw new Error('Select at least one target language.'); await updateMetadata(); setTransformationStep('templates'); });
    if (step === 'templates') return run(async () => { await updateMetadata(); setTransformationStep('generate'); });
    if (step === 'generate') return generate();
    if (step === 'review') return setTransformationStep('export');
    return setCurrentRoute('dashboard');
  };
  const goBack = () => { const previous: Record<string, typeof step> = { 'title-summary': 'upload', configure: 'title-summary', templates: 'configure', generate: 'templates', review: 'generate', export: 'review' }; const target = previous[step]; if (target) setTransformationStep(target); };
  const completed = useMemo(() => new Set(STEPS.slice(0, Math.max(0, selectedIndex)).map(([id]) => id)), [selectedIndex]);

  return <section className="mx-auto w-full max-w-6xl p-5 md:p-8">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><button onClick={() => setCurrentRoute('dashboard')} className="mb-3 text-sm text-cyan-300 hover:text-cyan-200">← Back to dashboard</button><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Pipeline workflow</p><h1 className="mt-1 text-2xl font-semibold text-white">{state.title || 'New Transformation'}</h1><p className="mt-1 text-sm text-slate-400">Transform one source into professional, reviewable deliverables in multiple languages.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">Step {Math.max(1, selectedIndex + 1)} of 7</span></div>
    <nav aria-label="Transformation steps" className="mb-6 grid grid-cols-4 gap-2 md:grid-cols-7">{STEPS.map(([id, label], index) => <button key={id} onClick={() => { if (index <= selectedIndex || completed.has(id)) setTransformationStep(id); }} className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-left text-xs ${id === step ? 'border-violet-400 text-violet-200' : completed.has(id) ? 'border-emerald-400/60 text-emerald-200' : 'border-white/10 text-slate-500'}`}><span className={`grid h-5 w-5 place-items-center rounded-full ${id === step ? 'bg-violet-500 text-white' : completed.has(id) ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800'}`}>{completed.has(id) ? '✓' : index + 1}</span>{label}</button>)}</nav>
    {error && <div role="alert" className="mb-5 whitespace-pre-line rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}{notice && <div role="status" className="mb-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100">{notice}</div>}
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 md:p-7">
      {step === 'upload' && <div className="space-y-5"><div><h2 className="text-lg font-semibold text-white">Upload & understand source content</h2><p className="mt-1 text-sm text-slate-400">Start with files, a web page, an RSS feed, or pasted text.</p></div><div className="flex flex-wrap gap-2">{([['file','Upload files'],['url','Web URL'],['rss','RSS feed'],['text','Paste text']] as [SourceMode,string][]).map(([mode,label]) => <button key={mode} className={classes(sourceMode === mode)} onClick={() => setSourceMode(mode)}>{label}</button>)}</div>
        {sourceMode === 'file' ? <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); updateFiles(Array.from(event.dataTransfer.files)); }} className={`rounded-xl border border-dashed p-8 text-center ${dragging ? 'border-violet-300 bg-violet-500/10' : 'border-slate-600 bg-slate-950/50'}`}><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-xl text-violet-200">⇧</div><p className="text-sm text-slate-200">Drag and drop your source files here, or <label className="cursor-pointer text-violet-300 underline">browse<input className="sr-only" type="file" multiple accept={ACCEPTED} onChange={(event) => updateFiles(Array.from(event.target.files || []))} /></label></p><p className="mt-2 text-xs text-slate-500">Up to 10 files, 50 MB per file (200 MB total). PDF, Office, text, images, audio and video.</p>{files.length > 0 && <div className="mt-4 text-sm text-cyan-200">{files.map((file) => file.name).join(' · ')} · {(files.reduce((sum,file)=>sum+file.size,0)/1024/1024).toFixed(1)} MB</div>}</div> : sourceMode === 'text' ? <label className="block text-sm text-slate-300">Source text<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={10} maxLength={500000} placeholder="Paste source material here…" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 p-3 text-sm text-white"/><span className="mt-1 block text-right text-xs text-slate-500">{sourceText.length.toLocaleString()} / 500,000 characters</span></label> : <label className="block text-sm text-slate-300">{sourceMode === 'rss' ? 'RSS feed URL' : 'Web page URL'}<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder={sourceMode === 'rss' ? 'https://example.com/feed.xml' : 'https://example.com/article'} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white"/><span className="mt-2 block text-xs text-slate-500">The backend fetches and extracts this source when you continue. Only submit URLs you are authorized to process.</span></label>}
      </div>}
      {step === 'title-summary' && <div className="space-y-5"><div><h2 className="text-lg font-semibold text-white">Document information & scope</h2><p className="mt-1 text-sm text-slate-400">Name this transformation and add context to guide the outputs.</p></div><label className="block text-sm text-slate-300">Transformation title *<input value={state.title} onChange={(event) => updateTransformationState({ title: event.target.value })} maxLength={500} placeholder="TransformHub AI: One Source, Many Outputs" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white"/></label><label className="block text-sm text-slate-300">Executive synopsis & key synthesis<textarea value={state.summary} onChange={(event) => updateTransformationState({ summary: event.target.value })} rows={7} maxLength={10000} placeholder="Summarize the source context, key question, or decisions this work should support…" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 p-3 text-white"/><span className="mt-1 block text-xs text-slate-500">This context is passed to the generation backend.</span></label><button onClick={suggestSummary} className={classes(false)}>✦ Use AI to Suggest Summary</button>{state.source && <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">Selected source · {state.source.name}</div>}</div>}
      {step === 'configure' && <div className="space-y-7"><div><h2 className="text-lg font-semibold text-white">Configure transformation</h2><p className="mt-1 text-sm text-slate-400">Select deliverables, audience, tone, languages, objective, and depth.</p></div><fieldset><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><legend className="text-sm font-semibold text-slate-200">Output deliverables <span className="text-violet-300">{config.outputTypes.length} selected</span></legend><div className="flex gap-2"><button className={classes(false)} onClick={() => setConfig({ outputTypes: [...OUTPUTS] })}>Select all</button><button className={classes(false)} onClick={() => setConfig({ outputTypes: [] })}>Clear</button></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{OUTPUTS.map((type) => <label key={type} className={classes(config.outputTypes.includes(type))}><input type="checkbox" checked={config.outputTypes.includes(type)} onChange={() => setConfig({ outputTypes: config.outputTypes.includes(type) ? config.outputTypes.filter((item) => item !== type) : [...config.outputTypes, type] })} className="mr-2 accent-violet-400"/>{type}</label>)}</div></fieldset>
        <div className="grid gap-6 md:grid-cols-2">{([['Target audience','audience',['Executives','Analysts','General Public']],['Tone','tone',['Formal','Technical','Urgent','Simple']],['Objective','objective',['Inform','Educate','Alert','Summarize']]] as const).map(([title,key,choices]) => <fieldset key={key}><legend className="mb-2 text-sm font-semibold text-slate-300">{title}</legend><div className="grid grid-cols-2 gap-2">{choices.map((choice) => <button type="button" key={choice} onClick={() => setConfig({ [key]: choice } as any)} className={classes(config[key] === choice)}>{config[key] === choice ? '◉ ' : '◯ '}{choice}</button>)}</div></fieldset>)}
          <fieldset className="md:col-span-2"><div className="mb-2 flex justify-between"><legend className="text-sm font-semibold text-slate-300">Target languages</legend><span className="text-xs text-slate-500">{config.languages.length} selected</span></div><div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">{CONTENT_LANGUAGES.map((language) => <label key={language.code} className={classes(config.languages.includes(language.code))}><input type="checkbox" checked={config.languages.includes(language.code)} onChange={() => setConfig({ languages: toggleContentLanguage(config.languages, language.code) })} className="mr-2 accent-violet-400"/>{language.name} <span className="text-slate-400">({language.nativeName})</span></label>)}</div><p className="mt-2 text-xs text-slate-500">Outputs are generated separately for every selected language. Provider language quality depends on the configured model.</p></fieldset>
        </div><fieldset><legend className="mb-2 text-sm font-semibold text-slate-300">Detail & depth · {config.detail}</legend><div className="grid grid-cols-3 gap-2">{(['Brief','Balanced','Detailed'] as const).map((choice) => <button key={choice} onClick={() => setConfig({ detail: choice })} className={`${classes(config.detail === choice)} py-3`}>{choice}</button>)}</div></fieldset>
      </div>}
      {step === 'templates' && <div><div className="mb-5"><h2 className="text-lg font-semibold text-white">Choose a professional template</h2><p className="mt-1 text-sm text-slate-400">Templates set a recommended deliverable mix and writing defaults. You can still adjust everything.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{PROFESSIONAL_TEMPLATES.map((template) => <article key={template.id} className={`flex flex-col rounded-xl border p-4 ${state.selectedTemplateId === template.id ? 'border-violet-400 bg-violet-500/10' : 'border-white/10 bg-slate-950/50'}`}><p className="text-xs font-semibold uppercase tracking-wide text-violet-300">{template.subtitle}</p><h3 className="mt-2 font-semibold text-white">{template.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{template.description}</p><p className="mt-3 text-xs text-slate-500">Outputs: {template.recommendedOutputs.join(', ')}</p><p className="mt-2 text-xs text-slate-500">{template.defaultAudience} · {template.defaultTone} · {template.defaultObjective}</p><button onClick={() => selectTemplate(template)} className={`mt-4 ${classes(state.selectedTemplateId === template.id)}`}>{state.selectedTemplateId === template.id ? 'Selected template' : 'Use template'}</button></article>)}</div></div>}
      {step === 'generate' && <div className="space-y-5"><div><h2 className="text-lg font-semibold text-white">Generate outputs</h2><p className="mt-1 text-sm text-slate-400">Review your configuration, then generate grounded drafts from the saved source.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase text-slate-500">Source</p><p className="mt-2 font-medium text-white">{state.source?.name || 'No source saved'}</p></div><div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase text-slate-500">Language targets</p><p className="mt-2 text-sm text-white">{config.languages.map((code) => CONTENT_LANGUAGES.find((language) => language.code === code)?.name || code).join(', ')}</p></div></div><div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="mb-2 text-xs uppercase text-slate-500">Deliverables · {config.outputTypes.length}</p><div className="flex flex-wrap gap-2">{config.outputTypes.map((type) => <span key={type} className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-100">{type}</span>)}</div><p className="mt-4 text-sm text-slate-400">{config.audience} · {config.tone} · {config.objective} · {config.detail}</p></div><button disabled={busy} onClick={generate} className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{busy ? 'Generating…' : '✦ Generate outputs'}</button></div>}
      {step === 'review' && <div><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Review deliverables</h2><p className="mt-1 text-sm text-slate-400">Edit drafts, save reviewer notes, and approve each output before export.</p></div><button disabled={busy} onClick={refreshOutputs} className={classes(false)}>Refresh outputs</button></div>{outputs.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">No outputs yet. Return to Generate to create them.</div> : <div className="space-y-4">{outputs.map((output) => <article key={output.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-medium text-white">{output.title}</h3><p className="mt-1 text-xs text-slate-400">{output.output_type.replaceAll('_',' ')} · {output.status.replaceAll('_',' ')}</p></div>{output.status === 'approved' && <span className="text-xs text-emerald-300">Approved</span>}</div><textarea aria-label={`Edit ${output.title}`} value={drafts[output.id] ?? output.content} onChange={(event) => setDrafts((previous) => ({ ...previous, [output.id]: event.target.value }))} rows={10} className="w-full rounded-lg border border-white/10 bg-slate-900 p-3 font-mono text-sm leading-6 text-slate-200"/><div className="mt-3 flex flex-wrap gap-2"><input aria-label="Reviewer note" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Reviewer note (optional)" className="min-w-48 flex-1 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"/><button disabled={busy} onClick={() => void saveReview(output,'save',drafts[output.id] ?? output.content)} className={classes(false)}>Save edits</button>{output.status !== 'approved' && <button disabled={busy} onClick={() => void saveReview(output,'approve',drafts[output.id] ?? output.content)} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">Approve</button>}</div></article>)}</div>}</div>}
      {step === 'export' && <div><div className="mb-5"><h2 className="text-lg font-semibold text-white">Export approved deliverables</h2><p className="mt-1 text-sm text-slate-400">Download individual outputs in common document and data formats.</p></div>{outputs.length === 0 ? <p className="text-sm text-slate-400">Generate and review outputs before exporting.</p> : <div className="space-y-3">{outputs.map((output) => <div key={output.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4"><div><p className="font-medium text-white">{output.title}</p><p className={`mt-1 text-xs ${output.status === 'approved' ? 'text-emerald-300' : 'text-amber-300'}`}>{output.status === 'approved' ? 'Approved · ready to export' : 'Pending approval · return to Review'}</p></div><div className="flex flex-wrap gap-2">{supportedFormats(output.output_type).map((format) => <button key={format} disabled={busy || output.status !== 'approved'} onClick={() => download(output,format)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">{format.toUpperCase()}</button>)}</div></div>)}</div>}</div>}
      <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5"><button onClick={goBack} disabled={step === 'upload' || busy} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 disabled:opacity-40">← Back</button><button onClick={goNext} disabled={busy || (step === 'upload' && !sourceReady)} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Working…' : step === 'generate' ? 'Generate outputs →' : step === 'review' ? 'Continue to export →' : step === 'export' ? 'Return to dashboard' : 'Continue →'}</button></div>
    </div>
  </section>;
}

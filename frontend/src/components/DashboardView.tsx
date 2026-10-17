import React, { useState, useRef } from 'react';
import { 
  PlusCircle, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  Files, 
  UploadCloud, 
  Trash2, 
  Loader2, 
  FileDown, 
  FileCode, 
  Check, 
  RefreshCw,
  Sparkles,
  Zap,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PROFESSIONAL_TEMPLATES } from '../data/templates';
import { TransformationTemplate, CompletedTransformationRecord } from '../types';
import { normalizeContentLanguage } from '../utils/contentLanguages';
import {
  createTransformation,
  generateTransformationOutputs,
  uploadTransformationFiles,
  uploadUrlSource,
} from '../utils/api';
import { OUTPUT_TYPE_MAP, toOutputItem } from '../utils/transformationOutputs';
import { downloadRecordAsPDF, downloadRecordAsJSON, downloadAllRecordsAsJSON } from '../utils/exportUtils';

interface BatchItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  url?: string;
  status: 'queued' | 'analyzing' | 'generating' | 'in_review' | 'failed';
  error?: string;
  result?: CompletedTransformationRecord;
}

export const DashboardView: React.FC = () => {
  const { 
    currentUser, 
    historyRecords, 
    setCurrentRoute, 
    setTransformationStep, 
    resetTransformationState,
    saveCompletedTransformation,
    openTransformationForReview,
    showToast,
    setSyncStatus,
    appSettings,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'batch'>('overview');

  // Batch Transformation State
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(PROFESSIONAL_TEMPLATES[0].id);
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchDragActive, setBatchDragActive] = useState(false);
  const [batchCompletedResults, setBatchCompletedResults] = useState<CompletedTransformationRecord[]>([]);

  const selectedTemplate = PROFESSIONAL_TEMPLATES.find((t) => t.id === selectedTemplateId) || PROFESSIONAL_TEMPLATES[0];

  const total = historyRecords.length;
  const completed = historyRecords.filter((r) => r.status === 'Completed').length;
  const inReview = historyRecords.filter((r) => r.status === 'In Review').length;
  const failed = historyRecords.filter((r) => r.status === 'Failed').length;

  const handleStartNewTransformation = () => {
    resetTransformationState();
    setTransformationStep('upload');
    setCurrentRoute('transformation/new');
  };

  // Batch file handling
  const handleBatchFiles = (fileList: FileList) => {
    const newItems: BatchItem[] = Array.from(fileList).map((f) => ({
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      file: f,
      status: 'queued',
    }));

    setBatchItems((prev) => [...prev, ...newItems]);
    showToast(`${t('Added')} ${newItems.length} ${t('file(s) to batch queue.')}`);
  };

  const handleAddBatchUrls = () => {
    const urls = batchUrlsInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 5);
    const normalizedUrls = urls.map((url) => /^https?:\/\//i.test(url) ? url : `https://${url}`);

    if (normalizedUrls.length === 0) return;

    const newItems: BatchItem[] = normalizedUrls.map((u) => ({
      id: `batch-url-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: u,
      size: 0,
      type: 'text/html (Web Document)',
      url: u,
      status: 'queued',
    }));

    setBatchItems((prev) => [...prev, ...newItems]);
    setBatchUrlsInput('');
    showToast(`${t('Added')} ${newItems.length} ${t('URL(s) to batch queue.')}`);
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearBatch = () => {
    setBatchItems([]);
    setBatchCompletedResults([]);
  };

  // Run Batch Processing
  const handleRunBatchTransformation = async () => {
    const itemsToProcess = batchItems.filter((item) => item.status === 'queued' || item.status === 'failed');
    if (itemsToProcess.length === 0 || isBatchProcessing) return;

    setIsBatchProcessing(true);
    const completedList: CompletedTransformationRecord[] = [];
    let failedCount = 0;
    setSyncStatus({
      state: 'syncing',
      message: `Batch pipeline initiated: processing ${itemsToProcess.length} items with the backend...`,
    });

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      setSyncStatus({
        state: 'syncing',
        message: `Processing batch item ${i + 1}/${itemsToProcess.length}: "${item.name}"...`,
      });
      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'analyzing', error: undefined } : it))
      );
      const startedAt = performance.now();
      try {
        const language = normalizeContentLanguage(appSettings.transformationDefaults.defaultLanguage);
        const outputTypes = selectedTemplate.recommendedOutputs;
        const outputKeys = outputTypes.map((type) => OUTPUT_TYPE_MAP[type]).filter(Boolean);
        if (!outputKeys.length || outputKeys.length !== outputTypes.length) {
          throw new Error('The selected template contains an unsupported output type.');
        }

        const transformation = await createTransformation({
          title: item.file?.name || item.name,
          configuration: {
            output_types: outputTypes,
            audience: selectedTemplate.defaultAudience,
            tone: selectedTemplate.defaultTone,
            languages: [language],
            language,
            objective: selectedTemplate.defaultObjective,
            detail: 'Balanced',
          },
        });

        const source = item.file
          ? await uploadTransformationFiles(transformation.id, [item.file])
          : item.url
            ? await uploadUrlSource(transformation.id, item.url)
            : null;
        if (!source) throw new Error('This batch item has no file or URL source.');

        setBatchItems((prev) =>
          prev.map((queuedItem) => (queuedItem.id === item.id ? { ...queuedItem, status: 'generating' } : queuedItem))
        );
        const generated = await generateTransformationOutputs(transformation.id, outputKeys, [language]);
        const outputs = generated.outputs.map(toOutputItem);
        if (!outputs.length) throw new Error('The backend returned no generated outputs.');

        const now = new Date();
        const record: CompletedTransformationRecord = {
          id: `backend-${transformation.id}`,
          backendTransformationId: transformation.id,
          title: source.title || item.file?.name || item.name,
          summary: source.summary || '',
          sourceName: item.name,
          sourceType: item.type,
          sourceSize: item.file?.size || 0,
          outputTypes,
          outputs,
          configuration: {
            outputTypes,
            audience: selectedTemplate.defaultAudience,
            tone: selectedTemplate.defaultTone,
            languages: [language],
            objective: selectedTemplate.defaultObjective,
            detail: 'Balanced',
          },
          createdAt: now.toLocaleString(),
          completedAt: now.toLocaleString(),
          status: 'In Review',
          processingDurationSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(1)),
          templateName: selectedTemplate.title,
        };

        saveCompletedTransformation(record);
        completedList.push(record);
        setBatchItems((prev) =>
          prev.map((queuedItem) => (queuedItem.id === item.id
            ? { ...queuedItem, status: 'in_review', result: record }
            : queuedItem))
        );
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : 'Batch item processing failed.';
        setBatchItems((prev) =>
          prev.map((queuedItem) => (queuedItem.id === item.id
            ? { ...queuedItem, status: 'failed', error: message }
            : queuedItem))
        );
      }
    }

    setBatchCompletedResults((previous) => [...previous, ...completedList]);
    setIsBatchProcessing(false);
    setSyncStatus({
      state: completedList.length ? 'saved' : 'synced',
      message: `Batch finished: ${completedList.length} draft(s) saved for review; ${failedCount} item(s) failed.`,
      lastSyncedAt: new Date(),
    });
    showToast(`Batch finished: ${completedList.length} draft(s) ready for review; ${failedCount} item(s) failed.`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            {t('Enterprise Content Engine')}
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
            {t('Welcome back,')} {currentUser.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('Transform single or multiple source documents into audience-ready communication pipelines.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('batch')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Files className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('Batch Transformation')}</span>
          </button>

          <button
            onClick={handleStartNewTransformation}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ {t('New Transformation')}</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher: Overview vs Batch Studio */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('Dashboard Overview')}
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'batch'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Files className="w-3.5 h-3.5" />
          <span>{t('Batch Transformation Suite')}</span>
          {batchItems.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-600 text-white">
              {batchItems.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{t('Total')}</span>
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-3xl font-bold text-white font-mono tabular-nums">
                {total}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('All registered jobs')}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{t('Completed')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-white font-mono tabular-nums">
                {completed}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('All outputs approved')}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{t('In Review')}</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-white font-mono tabular-nums">
                {inReview}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('Awaiting output review')}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{t('Failed')}</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-bold text-white font-mono tabular-nums">
                {failed}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('Processing failures')}
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start a Single Transformation */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{t('Single Transformation Wizard')}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {t('Upload an individual PDF, PPT, DOCX, image, or video file to tailor multi-channel outputs with step-by-step review of available source evidence.')}
                </p>
              </div>
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={handleStartNewTransformation}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{t('Launch Wizard')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Launch Batch Transformation */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <Files className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{t('Batch Transformation Suite')}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {t('Queue multiple documents or URLs, apply one template to each item, and review the generated drafts.')}
                </p>
              </div>
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('batch')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{t('Open Batch Suite')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Transformations Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Recent Transformations
              </h2>
              {historyRecords.length > 0 && (
                <button
                  onClick={() => setCurrentRoute('history')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {t('View all in History')} ({historyRecords.length}) &rarr;
                </button>
              )}
            </div>

            {historyRecords.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">
                  {t('No transformation activity yet')}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {t('Real records will appear here as soon as you upload a document or execute a batch transformation.')}
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">{t('Document Title')}</th>
                        <th className="py-3 px-4">{t('Deliverables')}</th>
                        <th className="py-3 px-4">{t('Status')}</th>
                        <th className="py-3 px-4">{t('Date')}</th>
                        <th className="py-3 px-4 text-center">{t('Quick Export')}</th>
                        <th className="py-3 px-4 text-right">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {historyRecords.slice(0, 5).map((record) => (
                        <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-sans font-medium text-white max-w-xs">
                            <div className="truncate font-semibold">{record.title}</div>
                            <div className="text-[11px] text-slate-500 font-sans mt-0.5 truncate">
                              {record.sourceName}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-slate-400">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {record.outputTypes.slice(0, 2).map((type, idx) => (
                                <span key={idx} className="text-[11px] text-indigo-300">
                                  {type}
                                </span>
                              ))}
                              {record.outputTypes.length > 2 && (
                                <span className="text-[10px] text-slate-500">
                                  +{record.outputTypes.length - 2} {t('more')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <span className={`flex items-center gap-1.5 text-xs ${
                              record.status === 'Completed' ? 'text-emerald-400' : record.status === 'Failed' ? 'text-rose-400' : 'text-amber-400'
                            }`}>
                              {record.status === 'Completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              <span>{record.status}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono">
                            {record.completedAt}
                          </td>
                          <td className="py-3.5 px-4 text-center font-sans">
                            {record.status === 'Completed' ? <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => {
                                  downloadRecordAsPDF(record);
                                  showToast(`Downloaded ${record.title} as PDF.`);
                                }}
                                className="px-2 py-0.5 text-[10px] bg-indigo-600/20 text-indigo-300 hover:text-white rounded border border-indigo-500/30 transition-colors"
                                title={t('Download PDF report')}
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => {
                                  downloadRecordAsJSON(record);
                                  showToast(`Downloaded ${record.title} as JSON.`);
                                }}
                                className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
                                title={t('Download JSON export')}
                              >
                                JSON
                              </button>
                            </div> : <span className="text-[10px] text-amber-400">{t('Review before export')}</span>}
                          </td>
                          <td className="py-3.5 px-4 text-right font-sans">
                            <button
                              onClick={() => setCurrentRoute('history')}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                            >
                              {t('Inspect')} &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ========================================================
           BATCH TRANSFORMATION INTERFACE
           ======================================================== */
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Files className="w-5 h-5 text-indigo-400" />
                  <span>{t('Batch Transformation Pipeline')}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {t('Queue multiple documents or URLs and generate backend drafts one item at a time.')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {batchItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    disabled={isBatchProcessing}
                    className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('Clear All')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Step 1: Select Transformation Blueprint Template */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('1. Select Target Transformation Template')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PROFESSIONAL_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => !isBatchProcessing && setSelectedTemplateId(tmpl.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40 text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white">{tmpl.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {tmpl.description}
                      </p>
                      <div className="mt-2 text-[10px] font-mono text-indigo-400">
                        {t('Outputs:')} {tmpl.recommendedOutputs.map(t).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Upload Files & URLs */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('2. Queue Input Documents & Endpoints')}
              </label>

              {/* Drag and Drop Zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setBatchDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setBatchDragActive(false); }}
                onDragOver={(e) => { e.preventDefault(); setBatchDragActive(true); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setBatchDragActive(false);
                  if (e.dataTransfer.files) handleBatchFiles(e.dataTransfer.files);
                }}
                onClick={() => batchFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  batchDragActive
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <input
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => e.target.files && handleBatchFiles(e.target.files)}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-white">
                  {t('Drop multiple source files here, or')} <span className="text-indigo-400 underline">{t('browse')}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('Upload multiple PDFs, DOCXs, PPTs, images, videos, or text files. Maximum 50 MB per file.')}
                </p>
              </div>

              {/* URL Ingestion Field */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchUrlsInput}
                  onChange={(e) => setBatchUrlsInput(e.target.value)}
                  placeholder={t('Paste URL(s) separated by commas (e.g. https://domain.com/doc1, https://domain.com/doc2)')}
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddBatchUrls}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {t('Add URLs')}
                </button>
              </div>
            </div>

            {/* Queued Items List */}
            {batchItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>{t('Batch Queue')} ({batchItems.length} {t('items queued')})</span>
                  <span className="font-mono text-indigo-400">
                    {t('Template:')} {selectedTemplate.title}
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                  {batchItems.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 truncate">
                          {item.url ? (
                            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                          <span className="text-white font-medium truncate max-w-sm">{item.name}</span>
                          {!item.url && (
                            <span className="text-slate-500 font-mono text-[11px]">
                              {(item.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          )}
                        </div>
                        {item.error && <p className="mt-1 text-[11px] text-rose-300 break-words" role="alert">{item.error}</p>}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.status === 'queued' && (
                          <span className="text-[11px] font-mono text-slate-500">{t('Queued')}</span>
                        )}
                        {item.status === 'analyzing' && (
                          <span className="text-[11px] font-mono text-indigo-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{t('Uploading & Extracting Source')}</span>
                          </span>
                        )}
                        {item.status === 'generating' && (
                          <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{t('Generating Outputs')}</span>
                          </span>
                        )}
                        {item.status === 'in_review' && (
                          <span className="text-[11px] font-mono text-amber-400">{t('Draft ready for review')}</span>
                        )}
                        {item.status === 'failed' && (
                          <span className="text-[11px] font-mono text-rose-400">{t('Failed')}</span>
                        )}

                        {!isBatchProcessing && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchItem(item.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    {t('Applying')} <strong className="text-white">{selectedTemplate.title}</strong> {t('across')} {batchItems.length} {t('queued documents, one at a time.')}
                  </div>

                  <button
                    type="button"
                    onClick={handleRunBatchTransformation}
                    disabled={isBatchProcessing || !batchItems.some((item) => item.status === 'queued' || item.status === 'failed')}
                    className={`px-6 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isBatchProcessing
                        ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {isBatchProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('Processing Batch...')}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>{t('Execute Batch Transformation')} ({batchItems.length} {t('items')})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Batch Completed Results Section */}
            {batchCompletedResults.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{t('Generated Drafts')} ({batchCompletedResults.length} {t('ready for review')})</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t('Backend-generated drafts are saved in history. Review and approve each draft before exporting.')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        downloadAllRecordsAsJSON(batchCompletedResults);
                        showToast('Exported the generated batch drafts as JSON.');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('Download Drafts as JSON')}</span>
                    </button>
                    <button
                      onClick={() => setCurrentRoute('history')}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>{t('Open History')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {batchCompletedResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{result.title}</h4>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {result.sourceName} &bull; {result.templateName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {result.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2">
                        {result.summary}
                      </p>

                      <div className="text-[11px] text-indigo-300 font-mono">
                        {t('Outputs:')} {result.outputTypes.map(t).join(', ')}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {result.processingDurationSeconds} {t('s execution')}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openTransformationForReview(result)}
                            className="px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded border border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>{t('Review Drafts')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

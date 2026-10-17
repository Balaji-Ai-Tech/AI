import React, { useState } from 'react';
import { 
  History, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Download, 
  Trash2, 
  FileText, 
  Repeat, 
  Eye, 
  X,
  FileCode,
  FileDown,
  ClipboardCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CompletedTransformationRecord } from '../types';
import { 
  downloadRecordAsPDF, 
  downloadRecordAsJSON, 
  downloadAllRecordsAsJSON, 
  formatAsMarkdown, 
  downloadFile 
} from '../utils/exportUtils';

export const HistoryView: React.FC = () => {
  const { 
    historyRecords, 
    deleteHistoryRecord, 
    setCurrentRoute, 
    setTransformationStep, 
    resetTransformationState, 
    updateTransformationState, 
    openTransformationForReview,
    showToast,
    t,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CompletedTransformationRecord | null>(null);

  const handleStartNew = () => {
    resetTransformationState();
    setTransformationStep('upload');
    setCurrentRoute('transformation/new');
  };

  const handleRerun = (record: CompletedTransformationRecord) => {
    updateTransformationState({
      title: `${record.title} (Rerun)`,
      summary: record.summary,
      configuration: record.configuration,
      source: {
        name: record.sourceName,
        size: record.sourceSize,
        type: record.sourceType,
        uploadedAt: new Date().toLocaleTimeString(),
      },
      currentStep: 'generate',
    });
    setCurrentRoute('transformation/new');
  };

  const handleExportPDF = (record: CompletedTransformationRecord) => {
    downloadRecordAsPDF(record);
    showToast(`Exported ${record.title} as PDF report.`);
  };

  const handleExportJSON = (record: CompletedTransformationRecord) => {
    downloadRecordAsJSON(record);
    showToast(`Exported ${record.title} as JSON file.`);
  };

  const handleExportAll = () => {
    if (historyRecords.length === 0) return;
    downloadAllRecordsAsJSON(historyRecords);
    showToast(`Exported all ${historyRecords.length} history records as JSON.`);
  };

  const filteredRecords = historyRecords.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      rec.title.toLowerCase().includes(q) ||
      rec.sourceName.toLowerCase().includes(q) ||
      rec.outputTypes.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            {t('Audit Log & Archives')}
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
            {t('Transformation History')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('Export and download completed transformation results as formatted PDF reports or structured JSON files.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {historyRecords.length > 0 && (
            <button
              onClick={handleExportAll}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title={t('Download all history records as JSON audit bundle')}
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('Export All (JSON)')}</span>
            </button>
          )}

          <button
            onClick={handleStartNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('New Transformation')}</span>
          </button>
        </div>
      </div>

      {/* Initial Empty State (When no transformations yet) */}
      {historyRecords.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-16 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">
              {t('No transformations yet')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('Start your first transformation or run a batch transformation to generate deliverables and export audit reports.')}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartNew}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('New Transformation')}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Records List */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Search history by title, file, or outputs...')}
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>{filteredRecords.length} {t('of')} {historyRecords.length} {t('records')}</span>
              <span>&bull;</span>
              <span>{t('PDF & JSON Ready')}</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{t('Transformation')}</th>
                    <th className="py-3 px-4">{t('Source Document')}</th>
                    <th className="py-3 px-4">{t('Outputs')}</th>
                    <th className="py-3 px-4">{t('Status')}</th>
                    <th className="py-3 px-4">{t('Execution Date')}</th>
                    <th className="py-3 px-4 text-center">{t('Export Reports')}</th>
                    <th className="py-3 px-4 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 font-sans font-medium text-white max-w-xs">
                        <div className="truncate font-semibold">{record.title}</div>
                        <div className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                          {record.summary}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-sans text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[140px]">{record.sourceName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {(record.sourceSize / (1024 * 1024)).toFixed(1)} MB &bull; {record.sourceName.split('.').pop()?.toUpperCase()}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-sans text-slate-300">
                        <div className="flex flex-wrap gap-1">
                          {record.outputTypes.slice(0, 3).map((t, idx) => (
                            <span key={idx} className="text-[11px] text-indigo-300">
                              {t}{idx < Math.min(record.outputTypes.length, 3) - 1 ? ' ·' : ''}
                            </span>
                          ))}
                          {record.outputTypes.length > 3 && (
                            <span className="text-[10px] text-slate-500">
                              +{record.outputTypes.length - 3} {t('more')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-sans">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          record.status === 'Completed' ? 'text-emerald-400' : record.status === 'Failed' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {record.status === 'Completed'
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : record.status === 'Failed'
                              ? <AlertTriangle className="w-3.5 h-3.5" />
                              : <Clock className="w-3.5 h-3.5" />}
                          <span>{record.status}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4 font-mono text-slate-400">
                        {record.completedAt}
                      </td>

                      {/* Explicit Download Feature: PDF Report & JSON File */}
                      <td className="py-4 px-4 text-center font-sans">
                        {record.status === 'Completed' ? <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleExportPDF(record)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded border border-indigo-500/40 transition-colors cursor-pointer flex items-center gap-1"
                            title={t('Download Formatted PDF Report')}
                          >
                            <FileDown className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => handleExportJSON(record)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                            title={t('Download Structured JSON Export')}
                          >
                            <FileCode className="w-3 h-3 text-amber-400" />
                            <span>JSON</span>
                          </button>
                        </div> : <span className="text-[11px] text-slate-500">{t('Approve before exporting')}</span>}
                      </td>

                      <td className="py-4 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.status === 'In Review' && record.backendTransformationId && (
                            <button
                              onClick={() => openTransformationForReview(record)}
                              className="p-1.5 text-amber-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title={t('Review Draft')}
                            >
                              <ClipboardCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedRecord(record)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title={t('Inspect Details')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRerun(record)}
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title={t('Rerun Pipeline')}
                          >
                            <Repeat className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteHistoryRecord(record.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title={t('Delete Record')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspect Modal with Full Export Options */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase">
                  {t('Transformation Details')}
                </span>
                <h3 className="text-lg font-bold text-white">
                  {selectedRecord.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('Executed on')} {selectedRecord.completedAt} &bull; {t('Source:')} {selectedRecord.sourceName}
                </p>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Export Action Bar */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white block">
                  {selectedRecord.status === 'Completed' ? t('Export Completed Transformation') : t('Draft requires review')}
                </span>
                <span className="text-[11px] text-slate-400">
                  {t('Deliver formatted report with all')} {selectedRecord.outputs.length} {t('outputs & evidence')}
                </span>
              </div>
              {selectedRecord.status === 'Completed' ? <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPDF(selectedRecord)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{t('Download PDF Report')}</span>
                </button>
                <button
                  onClick={() => handleExportJSON(selectedRecord)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('Download JSON')}</span>
                </button>
              </div> : selectedRecord.status === 'In Review' && selectedRecord.backendTransformationId ? (
                <button
                  onClick={() => {
                    openTransformationForReview(selectedRecord);
                    setSelectedRecord(null);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>{t('Review Draft')}</span>
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('Generated Deliverables')} ({selectedRecord.outputs.length})
              </h4>

              {selectedRecord.outputs.map((out) => (
                <div key={out.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {out.type}
                    </span>
                    {selectedRecord.status === 'Completed' && <button
                      onClick={() => {
                        const content = formatAsMarkdown(out, selectedRecord.title);
                        downloadFile(`${selectedRecord.title}_${out.type}.md`, content, 'text/markdown');
                        showToast(`Downloaded ${out.type} markdown`);
                      }}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                    >
                      MD
                    </button>}
                  </div>

                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    {out.keyFacts.map((fact, idx) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>

                  <p className="text-xs text-slate-400 pt-1 border-t border-slate-900">
                    <strong>{t('Impact:')}</strong> {out.impact}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

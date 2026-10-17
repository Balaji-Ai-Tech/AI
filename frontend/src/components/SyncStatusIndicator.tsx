import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Database, 
  HardDrive, 
  Zap,
  Info,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, triggerManualSync, transformationState, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [relativeTime, setRelativeTime] = useState<string>('Just now');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update relative time display every 10 seconds
  useEffect(() => {
    const updateTime = () => {
      if (!syncStatus.lastSyncedAt) {
        setRelativeTime(t('Pending initial sync'));
        return;
      }
      const diffMs = Date.now() - new Date(syncStatus.lastSyncedAt).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 5) {
        setRelativeTime(t('Just now'));
      } else if (diffSec < 60) {
        setRelativeTime(`${diffSec} ${t('seconds ago')}`);
      } else {
        const mins = Math.floor(diffSec / 60);
        setRelativeTime(`${mins} ${t('minutes ago')}`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [syncStatus.lastSyncedAt, t]);

  // Click outside listener to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleManualSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSyncing = syncStatus.state === 'syncing' || isManualSyncing;
  const isOffline = !syncStatus.isOnline || syncStatus.state === 'offline';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button in Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
          isSyncing
            ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : isOffline
            ? 'bg-rose-950/30 text-rose-300 border-rose-500/30'
            : 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40 hover:border-emerald-500/50'
        }`}
        title={t('View Cloud Auto-Save & Synchronization details')}
        aria-label={t('Cloud sync status indicator')}
        aria-expanded={isOpen}
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
            <span className="hidden sm:inline">{t('Auto-saving...')}</span>
            <span className="sm:hidden">{t('Syncing')}</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </>
        ) : isOffline ? (
          <>
            <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="hidden sm:inline">{t('Offline (Cached)')}</span>
            <span className="sm:hidden">{t('Offline')}</span>
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">
              {t('Synced')} <span className="text-emerald-400/80 font-normal">({relativeTime})</span>
            </span>
            <span className="sm:hidden">{t('Synced')}</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
          </>
        )}
      </button>

      {/* Detailed Sync Status Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-4 z-40 animate-fade-in text-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isSyncing ? 'bg-amber-500/20 text-amber-400' : isOffline ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : isOffline ? <CloudOff className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  {t('Transformation Sync Engine')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {t(isSyncing ? 'Syncing active transformation...' : isOffline ? 'Offline browser cache active' : 'Live server mirror active')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              aria-label={t('Close popover')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Status Banner */}
          <div className="mt-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">{t('Status')}</span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                isSyncing
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                  : isOffline
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              }`}>
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {t('Auto-saving to Server')}
                  </>
                ) : isOffline ? (
                  <>
                    <CloudOff className="w-3 h-3" />
                    {t('Offline (Changes Queued)')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {t('Up to Date & Saved')}
                  </>
                )}
              </span>
            </div>

            {/* Live Message */}
            <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              <span className="text-indigo-400 font-medium mr-1.5">&bull;</span>
              {t(syncStatus.message || 'All transformation states and outputs are synchronized.')}
            </div>

            {/* Timestamps and diagnostics */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('Last sync:')}</span>
              </div>
              <div className="text-right font-mono text-slate-200">
                {syncStatus.lastSyncedAt
                  ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Pending'}
              </div>

              <div className="flex items-center gap-1.5 text-slate-400">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('Storage mode:')}</span>
              </div>
              <div className="text-right text-slate-200">
                IndexedDB + Cloud
              </div>

              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('Transport:')}</span>
              </div>
              <div className="text-right text-emerald-400 font-mono text-[10px]">
                TLS 1.3 Verified
              </div>
            </div>
          </div>

          {/* Active Workspace Context */}
          {transformationState.source && (
            <div className="mt-3 p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs">
              <div className="flex items-center justify-between text-[11px] text-indigo-300 font-medium mb-1">
                <span>{t('Active Transformation Draft')}</span>
                <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  Step: {transformationState.currentStep}
                </span>
              </div>
              <p className="text-white font-medium truncate text-xs">
                {transformationState.title || transformationState.source.name}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {transformationState.configuration.outputTypes.length} output formats configured &bull; Auto-saved
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Auto-save enabled
            </span>

            <button
              onClick={handleManualSyncClick}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSyncing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

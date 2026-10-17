import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FolderOpen, 
  BarChart3, 
  Settings, 
  Cpu,
  User
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ViewRoute } from '../types';

export const Sidebar: React.FC = () => {
  const { currentRoute, setCurrentRoute, historyRecords, t } = useApp();

  const navItems: { route: ViewRoute; label: string; icon: React.ReactNode; badge?: number; path?: string }[] = [
    {
      route: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'history',
      label: 'Projects',
      icon: <FolderOpen className="w-4 h-4 shrink-0" />,
      badge: historyRecords.length > 0 ? historyRecords.length : undefined,
    },
    {
      route: 'transformation/new',
      label: 'New Project',
      icon: <PlusCircle className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
    { route: 'settings', label: 'AI Integrations', icon: <Cpu className="w-4 h-4 shrink-0" />, path: '/settings/integrations' },
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <img src="/brand/transformhub-logo.svg" alt="TransformHub AI" className="h-9 w-9 shrink-0" />
        <div className="flex flex-col overflow-hidden">
          <span className="text-xs font-bold tracking-[0.10em] text-white uppercase truncate">
            TRANSFORMHUB AI
          </span>
          <span className="text-[10px] text-slate-500 truncate">
            Enterprise Pipeline
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
        {navItems.map((item) => {
          const isIntegrationsPage = window.location.pathname.endsWith('/settings/integrations');
          const isActive = currentRoute === item.route
            && (!item.path || window.location.pathname === item.path)
            && !(item.route === 'settings' && !item.path && isIntegrationsPage);
          return (
            <button
              key={item.path || item.route}
              onClick={() => {
                setCurrentRoute(item.route, false, item.path);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{t(item.label)}</span>
              </div>
              {item.badge !== undefined && (
                <span className="text-[11px] font-mono text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCurrentRoute('profile')}
        className="m-3 mt-0 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left hover:bg-slate-800/70"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-semibold text-indigo-200">
          <User className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-200">AI Operator</span>
          <span className="block text-[10px] text-slate-500">Local workspace</span>
        </span>
      </button>

    </aside>
  );
};

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SplashView } from './components/SplashView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransformationWizard } from './components/transformation/TransformationWizard';
import { TemplatesView } from './components/TemplatesView';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { AuthGate } from './components/AuthGate';

const MainLayout: React.FC = () => {
  const { currentRoute, toastMessage } = useApp();

  if (currentRoute === 'splash') {
    return <SplashView />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Persistent Enterprise Sidebar */}
      <Sidebar />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/90 pb-16">
          {currentRoute === 'dashboard' && <DashboardView />}
          {currentRoute === 'transformation/new' && <TransformationWizard />}
          {currentRoute === 'templates' && <TemplatesView />}
          {currentRoute === 'history' && <HistoryView />}
          {currentRoute === 'analytics' && <AnalyticsView />}
          {currentRoute === 'settings' && <SettingsView />}
          {currentRoute === 'profile' && <ProfileView />}
        </main>
      </div>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700/80 text-white text-xs px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 animate-fade-in font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthGate>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthGate>
  );
}

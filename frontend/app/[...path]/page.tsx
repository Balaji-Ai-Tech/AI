'use client';

import dynamic from 'next/dynamic';

const TransformHubApp = dynamic(() => import('../../src/App'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#061026] text-slate-200">
      <div className="rounded-xl border border-cyan-300/15 bg-white/[.03] px-5 py-4 text-sm">
        Loading TransformHub AI workspace.
      </div>
    </main>
  ),
});

export default function WorkspaceRoute() {
  return <TransformHubApp />;
}

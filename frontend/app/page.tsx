'use client';

import dynamic from 'next/dynamic';

// The workspace uses browser storage for its saved session and editor state.
// Disable server rendering for this client-only shell to avoid localStorage SSR errors.
const TransformHubApp = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#061026] text-slate-200">
      <div className="flex items-center gap-3 rounded-xl border border-cyan-300/15 bg-white/[.03] px-5 py-4 text-sm">
        <img src="/brand/transformhub-logo.svg" alt="" className="h-9 w-9" />
        <span>Loading TransformHub AI workspace…</span>
      </div>
    </main>
  ),
});

export default function Page() {
  return <TransformHubApp />;
}

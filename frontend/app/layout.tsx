import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'TransformHub AI — Automated Content Transformation',
  description: 'Transform source information into evidence-linked, audience-ready communication outputs.',
  applicationName: 'TransformHub AI',
  icons: { icon: '/brand/transformhub-logo.svg' },
};

export const viewport: Viewport = {
  themeColor: '#061026',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}

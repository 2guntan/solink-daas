import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DemoBar } from '@/components/demo-bar';
import { isDemoMode } from '@/lib/session';

export const metadata: Metadata = {
  title: { default: 'SOLINK DaaS', template: '%s — SOLINK DaaS' },
  description: 'Postes de travail managés, financés par une banque, en ligne et sans papier (démo).',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {isDemoMode() ? <DemoBar /> : null}
        {children}
      </body>
    </html>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/session';
import { PortalNav } from '@/components/portal-nav';
import { Wordmark } from '@/components/wordmark';

const NAV = [
  { href: '/demo', label: 'Outils démo' },
  { href: '/demo/boite', label: 'Boîte de démo' },
  { href: '/demo/horloge', label: 'Horloge simulée' },
  { href: '/demo/banque-virements', label: 'Virements banque' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="no-underline hover:no-underline">
              <Wordmark />
            </Link>
            <span aria-hidden className="h-4 w-px bg-neutral-200" />
            <span className="text-[13px] text-neutral-500">Simulations</span>
          </div>
          <Link href="/" className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-500 no-underline hover:bg-neutral-100 hover:text-neutral-900 hover:no-underline">
            Accueil
          </Link>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <PortalNav items={NAV} root="/demo" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

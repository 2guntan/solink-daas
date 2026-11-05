import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isDemoMode } from '@/lib/session';

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <nav className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/demo">Outils démo</Link>
        <Link href="/demo/boite">Boîte de démo</Link>
        <Link href="/demo/horloge">Horloge simulée</Link>
        <Link href="/demo/banque-virements">Virements banque (simulation)</Link>
        <Link href="/">Accueil</Link>
      </nav>
      {children}
    </div>
  );
}

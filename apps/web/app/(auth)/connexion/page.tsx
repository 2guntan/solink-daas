import Link from 'next/link';
import { LoginForm } from './login-form';
import { isDemoMode } from '@/lib/session';
import { Wordmark } from '@/components/wordmark';

export const metadata = { title: 'Connexion' };

const DEMO = [
  ['admin@teranga-demo.sn', 'Client admin + signataire (Teranga)'],
  ['admin@ndar-demo.sn', 'Client PME (Ndar)'],
  ['dossier@solink.sn', 'Chargé de dossier SOLINK'],
  ['analyste@banque-demo.sn', 'Analyste Banque Pilote'],
  ['commercial@orange-demo.sn', 'Commercial Orange'],
  ['refi@fonds-demo.org', 'Refinanceur'],
];

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  return (
    <main className="flex min-h-[calc(100vh-36px)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="no-underline hover:no-underline">
          <Wordmark />
        </Link>
        <h1 className="mt-8 text-[28px] font-semibold leading-tight tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-neutral-500">Sans mot de passe : un code à usage unique par email, SMS ou WhatsApp.</p>
        <div className="mt-8 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <LoginForm next={sp.next} demo={demo} />
        </div>
        {demo ? (
          <div className="mt-6 rounded-2xl bg-neutral-100/70 p-5 text-xs text-neutral-600">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Comptes de démonstration · code 000000</p>
            <ul className="mt-3 divide-y divide-neutral-200/70">
              {DEMO.map(([e, l]) => (
                <li key={e} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <code className="bg-transparent px-0 text-[12px] text-neutral-900">{e}</code>
                  <span className="text-neutral-500">{l}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-neutral-500">Liste complète dans le sélecteur de compte en haut de page et dans le README.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

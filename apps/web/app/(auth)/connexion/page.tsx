import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@solink/ui';
import { LoginForm } from './login-form';
import { isDemoMode } from '@/lib/session';

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
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center p-4">
      <Link href="/" className="mb-4 text-lg font-bold text-primary no-underline">SOLINK DaaS</Link>
      <Card>
        <CardHeader>
          <CardTitle>Connexion sans mot de passe</CardTitle>
          <CardDescription>Recevez un code à usage unique par email, SMS ou WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={sp.next} demo={isDemoMode()} />
        </CardContent>
      </Card>
      {isDemoMode() ? (
        <Card className="mt-4">
          <CardContent className="pt-4 text-xs text-slate-600">
            <p className="mb-2 font-medium">Comptes de démonstration (code 000000) :</p>
            <ul className="space-y-1">
              {DEMO.map(([e, l]) => (
                <li key={e}><code>{e}</code> — {l}</li>
              ))}
            </ul>
            <p className="mt-2">Liste complète dans le sélecteur de compte en haut de page et dans le README.</p>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

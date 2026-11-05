import Link from 'next/link';
import { Card, CardContent } from '@solink/ui';
import { currentActor } from '@/lib/session';
import { portalFor } from '@solink/core';

export default async function Page() {
  const a = await currentActor();
  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardContent className="pt-5">
          <h1 className="text-lg font-semibold">Accès refusé</h1>
          <p className="mt-2 text-sm text-slate-600">Cet espace n’est pas accessible avec votre compte.</p>
          {a ? <Link href={`/${portalFor(a.orgType)}`}>Aller à mon espace</Link> : <Link href="/connexion">Se connecter</Link>}
        </CardContent>
      </Card>
    </main>
  );
}

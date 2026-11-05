import Link from 'next/link';
import { buttonVariants } from '@solink/ui';
import { currentActor } from '@/lib/session';
import { portalFor } from '@solink/core';

export default async function Page() {
  const a = await currentActor();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs text-neutral-400">403</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Accès refusé</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">Cet espace n’est pas accessible avec votre compte.</p>
      {a ? (
        <Link href={`/${portalFor(a.orgType)}`} className={`${buttonVariants()} mt-6`}>
          Aller à mon espace
        </Link>
      ) : (
        <Link href="/connexion" className={`${buttonVariants()} mt-6`}>
          Se connecter
        </Link>
      )}
    </main>
  );
}

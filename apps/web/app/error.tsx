'use client';

import { Button } from '@solink/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs text-neutral-400">Erreur</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Une erreur est survenue</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">Nous n’avons pas pu afficher cette page. Réessayez dans un instant.</p>
      <Button className="mt-6" onClick={() => reset()}>
        Réessayer
      </Button>
    </main>
  );
}

import Link from 'next/link';
import { buttonVariants } from '@solink/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs text-neutral-400">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">La page demandée n’existe pas ou n’est plus disponible.</p>
      <Link href="/" className={`${buttonVariants({ variant: 'outline' })} mt-6`}>
        Retour à l’accueil
      </Link>
    </main>
  );
}

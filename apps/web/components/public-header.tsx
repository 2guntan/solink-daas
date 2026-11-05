import Link from 'next/link';
import { buttonVariants } from '@solink/ui';
import { Wordmark } from './wordmark';

/** En-tête des pages publiques (catalogue sans compte). */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="no-underline hover:no-underline">
          <Wordmark />
        </Link>
        <Link href="/connexion" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Me connecter
        </Link>
      </div>
    </header>
  );
}

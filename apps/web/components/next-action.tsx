import Link from 'next/link';
import { dateTime } from '@solink/core';
import { buttonVariants, cn } from '@solink/ui';
import type { NextAction } from '@/lib/next-action';

/** « Prochaine action » unique (v4 §4.3) : bloc d'encre quand l'action vous revient, carte blanche sinon. */
export function NextActionBanner({ a }: { a: NextAction }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6',
        a.mine ? 'bg-neutral-900 text-white shadow-pop' : 'border border-neutral-200/80 bg-white text-neutral-900',
      )}
      data-testid="prochaine-action"
    >
      <div className="min-w-0">
        <p className={cn('text-[11px] font-medium uppercase tracking-[0.14em]', a.mine ? 'text-neutral-400' : 'text-neutral-500')}>
          Prochaine action{a.orderRef ? <span className="normal-case tracking-normal"> · {a.orderRef}</span> : null}
        </p>
        <p className="mt-1.5 text-lg font-semibold leading-snug tracking-tight sm:text-xl" data-testid="prochaine-action-label">
          {a.label}
        </p>
        <p className={cn('mt-1.5 text-[13px]', a.mine ? 'text-neutral-400' : 'text-neutral-500')}>
          Responsable : {a.owner}
          {a.updatedAt ? ` · mis à jour le ${dateTime(a.updatedAt)}` : ''}
        </p>
      </div>
      {a.href && a.mine ? (
        <Link href={a.href} className={cn(buttonVariants({ variant: 'inverse' }), 'sm:shrink-0')}>
          Y aller
          <span aria-hidden>→</span>
        </Link>
      ) : a.href ? (
        <Link href={a.href} className={cn(buttonVariants({ variant: 'outline' }), 'sm:shrink-0')}>
          Voir le suivi
        </Link>
      ) : null}
    </div>
  );
}

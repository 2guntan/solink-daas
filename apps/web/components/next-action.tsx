import Link from 'next/link';
import { dateTime } from '@solink/core';
import { buttonVariants } from '@solink/ui';
import type { NextAction } from '@/lib/next-action';

export function NextActionBanner({ a }: { a: NextAction }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between ${a.mine ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`} data-testid="prochaine-action">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Prochaine action{a.orderRef ? ` · ${a.orderRef}` : ''}</p>
        <p className="text-base font-semibold" data-testid="prochaine-action-label">{a.label}</p>
        <p className="text-xs text-slate-500">Responsable : {a.owner}{a.updatedAt ? ` · dernière mise à jour ${dateTime(a.updatedAt)}` : ''}</p>
      </div>
      {a.href && a.mine ? <Link href={a.href} className={buttonVariants()}>Y aller</Link> : a.href ? <Link href={a.href} className="text-sm">Voir le suivi</Link> : null}
    </div>
  );
}

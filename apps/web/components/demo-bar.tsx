import Link from 'next/link';
import { prisma } from '@solink/db';
import { getOffsetDays, now, date, ROLE_LABEL } from '@solink/core';
import { DemoSwitcher } from './demo-switcher';
import { switchAccount } from '@/app/demo-actions';
import { currentActor } from '@/lib/session';

const GROUP: Record<string, string> = { CLIENT: 'Clients', OPERATEUR: 'SOLINK', FINANCEUR: 'Banque Pilote (démo)', APPORTEUR: 'Orange Business', REFINANCEUR: 'Refinanceur' };

const link = 'rounded-md px-2 py-1 text-neutral-400 no-underline transition-colors hover:bg-white/10 hover:text-white hover:no-underline';

/** Barre de démonstration : sombre et discrète, toujours visible. */
export async function DemoBar() {
  const [users, actor, offset, today] = await Promise.all([
    prisma.user.findMany({ include: { memberships: { include: { organisation: true } } }, orderBy: { email: 'asc' } }),
    currentActor(),
    getOffsetDays(prisma),
    now(prisma),
  ]);
  const unread = actor ? await prisma.notification.count({ where: { recipient: actor.email, read: false } }) : 0;
  const accounts = users
    .filter((u) => u.memberships[0])
    .map((u) => {
      const m = u.memberships[0];
      return { email: u.email, group: GROUP[m.organisation.type], label: `${u.email} — ${m.roles.map((r) => ROLE_LABEL[r]).join(', ')}`, orgType: m.organisation.type };
    })
    .sort((a, b) => a.group.localeCompare(b.group));
  return (
    <div className="no-scrollbar sticky top-0 z-50 flex items-center gap-x-1 overflow-x-auto whitespace-nowrap bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 sm:px-5" data-testid="demo-bar">
      <span className="mr-2 inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-white">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Démo
      </span>
      <DemoSwitcher accounts={accounts} current={actor?.email} action={switchAccount} />
      <span aria-hidden className="mx-1 hidden h-3.5 w-px bg-white/15 sm:inline-block" />
      <Link href="/demo/boite" className={link}>
        Boîte de démo
        {unread ? <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-px text-[10px] font-semibold text-white">{unread}</span> : null}
      </Link>
      <Link href="/demo/horloge" className={link} data-testid="sim-date">
        Horloge : <span className="text-neutral-200">{date(today)}</span>
        {offset ? <span className="ml-1 text-amber-300">J{offset > 0 ? '+' : ''}{offset}</span> : null}
      </Link>
      <Link href="/demo/banque-virements" className={link}>
        Virements banque
      </Link>
      <Link href="/demo" className={link}>
        Outils démo
      </Link>
    </div>
  );
}

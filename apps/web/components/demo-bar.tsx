import Link from 'next/link';
import { prisma } from '@solink/db';
import { getOffsetDays, now, date, ROLE_LABEL } from '@solink/core';
import { DemoSwitcher } from './demo-switcher';
import { switchAccount } from '@/app/demo-actions';
import { currentActor } from '@/lib/session';

const GROUP: Record<string, string> = { CLIENT: 'Clients', OPERATEUR: 'SOLINK', FINANCEUR: 'Banque Pilote (démo)', APPORTEUR: 'Orange Business', REFINANCEUR: 'Refinanceur' };

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
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-xs text-amber-950" data-testid="demo-bar">
      <span className="font-semibold">MODE DÉMO</span>
      <DemoSwitcher accounts={accounts} current={actor?.email} action={switchAccount} />
      <Link href="/demo/boite" className="text-amber-900 underline">
        Boîte de démo{unread ? ` (${unread})` : ''}
      </Link>
      <Link href="/demo/horloge" className="text-amber-900 underline" data-testid="sim-date">
        Horloge : {date(today)}
        {offset ? ` (J${offset > 0 ? '+' : ''}${offset})` : ''}
      </Link>
      <Link href="/demo/banque-virements" className="text-amber-900 underline">
        Virements banque
      </Link>
      <Link href="/demo" className="text-amber-900 underline">
        Outils démo
      </Link>
    </div>
  );
}

import Link from 'next/link';
import { prisma } from '@solink/db';
import { fcfa } from '@solink/core';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Stat, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { nextActionFor } from '@/lib/next-action';
import { NextActionBanner } from '@/components/next-action';
import { OrderStatusBadge, Timeline } from '@/components/status';

export const metadata = { title: 'Espace Client' };

export default async function Page() {
  const actor = await requireActor('client');
  const orders = await prisma.order.findMany({ where: { organisationId: actor.orgId, status: { notIn: ['ANNULE'] } }, orderBy: { updatedAt: 'desc' }, include: { transitions: { orderBy: { at: 'asc' } } } });
  const priority = orders.find((o) => !['ACTIF', 'CLOS', 'EXPIRE', 'REFUSE', 'PANIER'].includes(o.status)) ?? orders.find((o) => o.status === 'ACTIF') ?? orders[0];
  const next = priority ? await nextActionFor(priority.id, actor) : null;
  const [devices, unpaid] = await Promise.all([
    prisma.device.count({ where: { order: { organisationId: actor.orgId }, status: { in: ['ACTIF', 'VERROUILLE', 'EN_SAV'] } } }),
    prisma.invoice.aggregate({ where: { contract: { order: { organisationId: actor.orgId } }, status: { in: ['IMPAYEE', 'PARTIELLE'] } }, _sum: { totalTtc: true, paidAmount: true } }),
  ]);
  const monthly = orders.filter((o) => o.status === 'ACTIF').reduce((a, o) => a + o.monthlyTtc, 0);
  const canSeePrices = !actor.roles.every((r) => ['CLIENT_RECEPTION', 'CLIENT_EMPLOYE'].includes(r));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Bonjour ${actor.name.split(' ')[0]}`} description="Votre tableau de bord" actions={<Link href="/client/catalogue" className={buttonVariants()}>Nouvelle commande</Link>} />
      {next ? <NextActionBanner a={next} /> : <EmptyState title="Aucune commande en cours" description="Parcourez le catalogue pour configurer vos postes." action={<Link href="/client/catalogue" className={buttonVariants()}>Voir le catalogue</Link>} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Postes actifs" value={devices} />
        {canSeePrices ? <Stat label="Mensualité en cours" value={fcfa(monthly)} hint="TTC / mois" /> : null}
        {canSeePrices ? <Stat label="Impayés" value={fcfa((unpaid._sum.totalTtc ?? 0) - (unpaid._sum.paidAmount ?? 0))} tone={(unpaid._sum.totalTtc ?? 0) > 0 ? 'danger' : undefined} /> : null}
        <Stat label="Commandes" value={orders.length} />
      </div>
      <Card>
        <CardHeader className="flex-row items-baseline justify-between">
          <CardTitle>Mes commandes</CardTitle>
          <Link href="/client/commandes" className="text-[13px] font-medium text-neutral-500 no-underline hover:text-neutral-900">Tout voir →</Link>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {orders.length === 0 ? <EmptyState title="Aucune commande" /> : null}
          {orders.map((o) => (
            <div key={o.id} className="flex flex-col gap-4 py-5 first:pt-2 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/client/commandes/${o.id}`} className="text-[15px] font-semibold tracking-tight text-neutral-900 no-underline hover:underline">{o.ref}</Link>
                <div className="flex items-center gap-3"><OrderStatusBadge status={o.status} />{canSeePrices ? <span className="text-sm font-medium tabular-nums">{fcfa(o.monthlyTtc)} <span className="font-normal text-neutral-500">/ mois</span></span> : null}</div>
              </div>
              <Timeline status={o.status} transitions={o.transitions} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

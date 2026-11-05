import Link from 'next/link';
import { prisma } from '@solink/db';
import { date, fcfa, now, remainingPct } from '@solink/core';
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader, Stat } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { EnvelopeChart } from '@/components/charts';
import { OrderStatusBadge } from '@/components/status';
import { Sla } from '@/components/sla';

export const metadata = { title: 'Portail Financeur' };

/** F01 — dossiers par statut et SLA, enveloppe, décaissements en attente, impayés. */
export default async function Page() {
  const actor = await requireActor('banque');
  const [orders, env, disb, unpaid, locks, at] = await Promise.all([
    prisma.order.findMany({ where: { financerId: actor.orgId, status: { in: ['TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'PIECES_COMPLEMENTAIRES', 'CONTRESIGNATURE', 'CONDITIONS_SUSPENSIVES'] } }, include: { organisation: true, creditFile: true }, orderBy: { statusChangedAt: 'asc' } }),
    prisma.envelope.findFirst({ where: { financerId: actor.orgId, active: true } }),
    prisma.disbursement.count({ where: { status: { in: ['DEMANDEE', 'VALIDEE'] }, contract: { financerId: actor.orgId } } }),
    prisma.invoice.aggregate({ where: { status: { in: ['IMPAYEE', 'PARTIELLE'] }, contract: { financerId: actor.orgId } }, _sum: { totalTtc: true, paidAmount: true }, _count: true }),
    prisma.lockOrder.count({ where: { status: 'PROPOSE', contract: { financerId: actor.orgId } } }),
    now(prisma),
  ]);
  const available = env ? env.total - env.reserved - env.consumed : 0;
  const rem = env ? remainingPct(env) : 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Tableau de bord financeur" description="Banque Pilote (démo) — bailleur et propriétaire. Seul décideur du crédit." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Dossiers à traiter" value={orders.filter((o) => ['TRANSMIS_FINANCEUR', 'EN_ANALYSE'].includes(o.status)).length} />
        <Stat label="Contre-signatures" value={orders.filter((o) => o.status === 'CONTRESIGNATURE').length} />
        <Stat label="Décaissements en attente" value={disb} tone={disb ? 'warning' : undefined} />
        <Stat label="Impayés" value={fcfa((unpaid._sum.totalTtc ?? 0) - (unpaid._sum.paidAmount ?? 0))} hint={`${unpaid._count} facture(s) · ${locks} verrouillage(s) proposé(s)`} tone={unpaid._count ? 'danger' : undefined} />
      </div>
      {env ? (
        <Card data-testid="enveloppe">
          <CardHeader><CardTitle>{env.name} — échéance {date(env.endDate)}</CardTitle></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[280px_1fr] md:gap-10">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[13px] text-neutral-500">Disponible</p>
                <p className={`mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums ${rem <= 10 ? 'text-red-600' : rem <= 20 ? 'text-amber-600' : 'text-neutral-900'}`}>{fcfa(available)}</p>
                <p className="mt-1 text-xs text-neutral-500">{rem.toFixed(1).replace('.', ',')} % de {fcfa(env.total)}</p>
              </div>
              {rem <= 20 ? <Alert tone="warning">Seuil bas atteint ({env.alertPcts.join(' % / ')} %).</Alert> : null}
              <p className="text-xs text-neutral-500">Plafond par client : {fcfa(env.perClientCap)} · liste blanche : {env.whitelist.length} client(s)</p>
            </div>
            <EnvelopeChart consumed={env.consumed} reserved={env.reserved} available={available} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Dossiers en cours</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {orders.map((o) => (
            <Link key={o.id} href={`/banque/dossiers/${o.id}`} className="-mx-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm text-neutral-900 no-underline transition-colors hover:bg-neutral-50 hover:no-underline">
              <span>
                <span className="font-medium">{o.ref}</span>
                <span className="text-neutral-500"> — {o.organisation.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <OrderStatusBadge status={o.status} internal /> <Sla status={o.status} since={o.statusChangedAt} now={at} /> <span className="w-32 text-right font-medium tabular-nums">{fcfa(o.financedAmount)}</span>
              </span>
            </Link>
          ))}
          {orders.length === 0 ? <p className="py-2 text-sm text-neutral-500">Aucun dossier en attente.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

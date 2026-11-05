import { prisma } from '@solink/db';
import { date, dateTime, fcfa } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { orderLockAction, refuseLockAction } from '../actions';

export const metadata = { title: 'Impayés et verrouillages' };

/** Verrouillage décidé par la banque (J+15), exécuté par SOLINK. */
export default async function Page() {
  const actor = await requireActor('banque');
  const [locks, unpaid] = await Promise.all([
    prisma.lockOrder.findMany({ where: { contract: { financerId: actor.orgId } }, include: { contract: { include: { order: { include: { organisation: true } } } } }, orderBy: { proposedAt: 'desc' } }),
    prisma.invoice.findMany({ where: { contract: { financerId: actor.orgId }, status: { in: ['IMPAYEE', 'PARTIELLE'] } }, include: { contract: { include: { order: { include: { organisation: true } } } }, dunnings: true } }),
  ]);
  const canLock = actor.roles.some((r) => ['BANQUE_RISK', 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE', 'BANQUE_TRESORERIE'].includes(r));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Impayés et verrouillages" />
      <Card>
        <CardHeader><CardTitle>Factures impayées</CardTitle></CardHeader>
        <CardContent>{unpaid.length === 0 ? <EmptyState title="Aucun impayé" /> : <ul className="text-sm">{unpaid.map((i) => <li key={i.id} className="border-b py-1">{i.contract.order.organisation.name} — {i.ref} — {fcfa(i.totalTtc - i.paidAmount)} — échue le {date(i.dueDate)} — relances : {i.dunnings.map((d) => d.level.split('_')[0]).join(', ') || '—'}</li>)}</ul>}</CardContent>
      </Card>
      <Card data-testid="propositions-verrouillage">
        <CardHeader><CardTitle>Propositions et ordres de verrouillage</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {locks.length === 0 ? <EmptyState title="Aucune proposition" /> : null}
          {locks.map((l) => (
            <div key={l.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200/80 bg-white p-4 text-sm md:flex-row md:items-center md:justify-between">
              <span>{l.contract.order.organisation.name} — {l.contract.ref} — {l.reason} — proposé {dateTime(l.proposedAt)} <Badge tone={l.status === 'LEVE' ? 'success' : l.status === 'EXECUTE' ? 'danger' : 'warning'}>{l.status}</Badge></span>
              {canLock && l.status === 'PROPOSE' ? (
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={orderLockAction} hidden={{ lockOrderId: l.id }} submit="Ordonner le verrouillage" variant="destructive" size="sm" confirm="Ordonner à SOLINK le verrouillage MDM des équipements de ce contrat ?" reason="Motif de l’ordre" inline testId="ordonner-verrouillage" />
                  <ActionForm action={refuseLockAction} hidden={{ lockOrderId: l.id }} submit="Refuser" variant="outline" size="sm" reason="Motif" confirm="Refuser la proposition ?" inline />
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

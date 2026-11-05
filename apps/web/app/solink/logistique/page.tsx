import { prisma } from '@solink/db';
import { date } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { deliveredAction, shipAction } from '../actions';

export const metadata = { title: 'Livraisons & PV' };

/** B07 — planning des livraisons, expédition, livraison par site, suivi des PV. */
export default async function Page() {
  await requireActor('solink');
  const orders = await prisma.order.findMany({ where: { status: { in: ['EN_PREPARATION', 'EXPEDIE', 'PV_A_SIGNER', 'ACHETE'] } }, include: { organisation: true, deliveries: { include: { site: true, pv: true } } } });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Livraisons et PV" />
      {orders.length === 0 ? <EmptyState title="Aucune livraison en cours" /> : null}
      {orders.map((o) => (
        <Card key={o.id} data-testid={`logistique-${o.ref}`}>
          <CardHeader><CardTitle>{o.ref} — {o.organisation.name} ({o.status.replace(/_/g, ' ').toLowerCase()})</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {o.status === 'EN_PREPARATION' ? <ActionForm action={shipAction} hidden={{ orderId: o.id }} submit="Expédier tous les sites" size="sm" testId={`expedier-${o.ref}`} /> : null}
            {o.deliveries.map((d) => (
              <div key={d.id} className="flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>{d.site.name} · créneau {date(d.slot)} · <Badge>{d.status}</Badge> {d.pv ? <Badge tone={d.pv.status === 'SIGNE' ? 'success' : 'warning'}>PV {d.pv.status === 'SIGNE' ? 'signé' : 'à signer'}</Badge> : null}</span>
                {d.status === 'EXPEDIEE' ? <ActionForm action={deliveredAction} hidden={{ deliveryId: d.id }} submit="Marquer livré" size="sm" variant="secondary" testId={`livrer-${d.site.name}`} /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

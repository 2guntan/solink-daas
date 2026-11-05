import Link from 'next/link';
import { prisma } from '@solink/db';
import { date, fcfa } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { OrderStatusBadge } from '@/components/status';
import { createPoAction, receivePoAction } from '../actions';

export const metadata = { title: 'Achats & réception' };

/** B05 — BC depuis PRÊT POUR ACHAT (refusé avant levée des conditions) · B06 — réception & séries. */
export default async function Page() {
  await requireActor('solink');
  const [orders, pos] = await Promise.all([
    prisma.order.findMany({ where: { status: { in: ['PRET_POUR_ACHAT', 'CONDITIONS_SUSPENSIVES', 'CONTRESIGNATURE'] } }, include: { organisation: true, lines: { include: { product: true } } } }),
    prisma.purchaseOrder.findMany({ include: { order: { include: { organisation: true } } }, orderBy: { issuedAt: 'desc' } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Achats et réception" />
      <Card>
        <CardHeader><CardTitle>Commandes à acheter</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {orders.length === 0 ? <EmptyState title="Aucune commande prête pour achat" /> : null}
          {orders.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between" data-testid={`achat-${o.ref}`}>
              <div className="text-sm"><Link href={`/solink/commandes/${o.id}`}>{o.ref}</Link> — {o.organisation.name} <OrderStatusBadge status={o.status} internal /><br /><span className="text-xs text-slate-500">{o.lines.map((l) => `${l.quantity} × ${l.product.sku}`).join(', ')}</span></div>
              <ActionForm action={createPoAction} hidden={{ orderId: o.id }} submit="Émettre le bon de commande distributeur" size="sm" testId={`bc-${o.ref}`} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Bons de commande</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pos.length === 0 ? <EmptyState title="Aucun bon de commande" /> : null}
          {pos.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
              <span className="text-sm">{p.ref} — {p.order.organisation.name} — {fcfa(p.amount)} HT — émis le {date(p.issuedAt)} {p.fileId ? <a href={`/api/files/${p.fileId}`} target="_blank">PDF</a> : null} <Badge tone={p.status === 'RECU' ? 'success' : 'warning'}>{p.status === 'RECU' ? `reçu le ${date(p.receivedAt)}` : 'en attente'}</Badge></span>
              {p.status === 'EMIS' ? <ActionForm action={receivePoAction} hidden={{ poId: p.id }} submit="Simuler la réception" size="sm" variant="secondary" testId={`reception-${p.order.ref}`} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

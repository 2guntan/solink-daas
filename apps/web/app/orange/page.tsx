import { prisma } from '@solink/db';
import { STATUS_INFO, date } from '@solink/core';
import { Alert, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';
import { OrderStatusBadge } from '@/components/status';

export const metadata = { title: 'Mes apports' };

/** O02 — statut seulement (pas de pièces, pas de détails financiers du dossier). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('orange');
  const rows = await prisma.order.findMany({ where: { apporteurId: actor.orgId }, select: { id: true, ref: true, status: true, statusChangedAt: true, organisation: { select: { name: true } } }, orderBy: { statusChangedAt: 'desc' } });
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Mes apports" />
      <Alert tone="info">Conformément au cloisonnement apporteur, vous voyez le statut de vos apports, jamais les pièces du dossier.</Alert>
      <ListView rows={rows} rowKey={(r) => r.id} basePath="/orange" searchParams={await searchParams} search={(r) => `${r.ref} ${r.organisation.name}`}
        filters={[{ key: 'statut', label: 'Statut', options: [...new Set(rows.map((r) => r.status))].map((s) => ({ value: s, label: STATUS_INFO[s].label })), match: (r, v) => r.status === v }]}
        columns={[
          { key: 'ref', label: 'Commande', render: (r) => r.ref, sort: (r) => r.ref },
          { key: 'client', label: 'Client', render: (r) => r.organisation.name, sort: (r) => r.organisation.name },
          { key: 'statut', label: 'Statut', render: (r) => <OrderStatusBadge status={r.status} /> },
          { key: 'maj', label: 'Mise à jour', render: (r) => date(r.statusChangedAt), sort: (r) => r.statusChangedAt.getTime() },
        ]} empty={{ title: 'Aucun apport', description: 'Créez un lead pour inviter un client.' }} testId="apports" />
    </div>
  );
}

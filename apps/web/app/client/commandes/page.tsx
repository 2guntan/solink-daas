import Link from 'next/link';
import { prisma } from '@solink/db';
import { STATUS_INFO, date, fcfa } from '@solink/core';
import { PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';
import { OrderStatusBadge } from '@/components/status';

export const metadata = { title: 'Commandes' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('client');
  const rows = await prisma.order.findMany({ where: { organisationId: actor.orgId }, orderBy: { createdAt: 'desc' } });
  return (
    <div>
      <PageHeader title="Commandes" />
      <ListView
        rows={rows}
        rowKey={(r) => r.id}
        basePath="/client/commandes"
        searchParams={await searchParams}
        search={(r) => `${r.ref} ${STATUS_INFO[r.status].label}`}
        filters={[{ key: 'statut', label: 'Statut', options: [...new Set(rows.map((r) => r.status))].map((s) => ({ value: s, label: STATUS_INFO[s].label })), match: (r, v) => r.status === v }]}
        columns={[
          { key: 'ref', label: 'Référence', render: (r) => <Link href={`/client/commandes/${r.id}`}>{r.ref}</Link>, sort: (r) => r.ref },
          { key: 'statut', label: 'Statut', render: (r) => <OrderStatusBadge status={r.status} />, sort: (r) => r.status },
          { key: 'mensualite', label: 'Mensualité TTC', render: (r) => fcfa(r.monthlyTtc), sort: (r) => r.monthlyTtc },
          { key: 'duree', label: 'Durée', render: (r) => `${r.durationMonths} mois` },
          { key: 'date', label: 'Créée le', render: (r) => date(r.createdAt), sort: (r) => r.createdAt.getTime() },
        ]}
        empty={{ title: 'Aucune commande', description: 'Configurez vos postes dans le catalogue.' }}
      />
    </div>
  );
}

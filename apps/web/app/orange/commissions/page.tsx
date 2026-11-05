import { fcfa, svc, STATUS_INFO } from '@solink/core';
import { PageHeader, Stat, DemoBadge } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Commissions' };

/** O03 — commissions apporteur (3 % du montant financé, mensualisées via la ventilation). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('orange');
  const rows = await svc.run(actor, (ctx) => svc.commissions(ctx, actor.orgId));
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Commissions" description={<>3 % du montant financé, perçue mensuellement via la ventilation du cantonnement <DemoBadge /></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Commissions contractées" value={fcfa(rows.reduce((a, r) => a + r.total, 0))} />
        <Stat label="Perçues (ventilées)" value={fcfa(rows.reduce((a, r) => a + r.collected, 0))} tone="success" />
        <Stat label="Contrats apportés" value={rows.length} />
      </div>
      <ListView rows={rows} rowKey={(r) => r.orderRef} basePath="/orange/commissions" searchParams={await searchParams}
        columns={[
          { key: 'ref', label: 'Contrat', render: (r) => r.contractRef ?? r.orderRef },
          { key: 'client', label: 'Client', render: (r) => r.org },
          { key: 'statut', label: 'Statut', render: (r) => STATUS_INFO[r.status].label },
          { key: 'finance', label: 'Montant financé', render: (r) => fcfa(r.financed), sort: (r) => r.financed },
          { key: 'total', label: 'Commission totale', render: (r) => fcfa(r.total), sort: (r) => r.total },
          { key: 'percu', label: 'Perçue', render: (r) => fcfa(r.collected) },
        ]} empty={{ title: 'Aucune commission' }} />
    </div>
  );
}

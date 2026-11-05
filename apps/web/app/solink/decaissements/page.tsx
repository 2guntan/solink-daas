import { prisma } from '@solink/db';
import { date, fcfa } from '@solink/core';
import { Badge, PageHeader, Alert } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Décaissements' };

/** B08 — demandes de décaissement générées au dernier PV (aucun ordre de paiement émis). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor('solink');
  const rows = await prisma.disbursement.findMany({ include: { contract: { include: { order: { include: { organisation: true } } } } }, orderBy: { requestedAt: 'desc' } });
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Demandes de décaissement" />
      <Alert tone="info">La plateforme transmet la demande (facture SOLINK, PV, séries, photos, annexe 1) ; seule la banque valide et vire. Aucun ordre de paiement n’est émis.</Alert>
      <ListView rows={rows} rowKey={(r) => r.id} basePath="/solink/decaissements" searchParams={await searchParams} search={(r) => `${r.ref} ${r.contract.ref} ${r.contract.order.organisation.name}`}
        filters={[{ key: 'statut', label: 'Statut', options: ['DEMANDEE', 'VALIDEE', 'PAYEE', 'REJETEE'].map((v) => ({ value: v, label: v.toLowerCase() })), match: (r, v) => r.status === v }]}
        columns={[
          { key: 'ref', label: 'Demande', render: (r) => r.ref, sort: (r) => r.ref },
          { key: 'client', label: 'Client', render: (r) => r.contract.order.organisation.name },
          { key: 'contrat', label: 'Contrat', render: (r) => r.contract.ref },
          { key: 'montant', label: 'Montant', render: (r) => fcfa(r.amount), sort: (r) => r.amount },
          { key: 'date', label: 'Demandée le', render: (r) => date(r.requestedAt), sort: (r) => r.requestedAt.getTime() },
          { key: 'statut', label: 'Statut', render: (r) => <Badge tone={r.status === 'PAYEE' ? 'success' : r.status === 'REJETEE' ? 'danger' : 'warning'}>{r.status}</Badge> },
          { key: 'facture', label: 'Facture', render: (r) => (r.invoiceFileId ? <a href={`/api/files/${r.invoiceFileId}`} target="_blank">PDF</a> : '—') },
        ]} empty={{ title: 'Aucune demande de décaissement' }} />
    </div>
  );
}

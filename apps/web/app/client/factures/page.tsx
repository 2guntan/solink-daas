import { prisma } from '@solink/db';
import { INVOICE_STATUS_LABEL, date, fcfa } from '@solink/core';
import { Alert, Badge, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Factures' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('client');
  const invoices = await prisma.invoice.findMany({ where: { contract: { order: { organisationId: actor.orgId } } }, include: { contract: { include: { lockOrders: true } } }, orderBy: { issueDate: 'desc' } });
  const locked = invoices.some((i) => i.contract.lockOrders.some((l) => l.status === 'EXECUTE'));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Factures Orange Business" description="Facture unique à 2 lignes : loyer (pour compte de la banque) et services." />
      {locked ? <Alert tone="danger" title="Équipements verrouillés">Suite à un impayé, la banque a ordonné le verrouillage de vos équipements. Ils seront déverrouillés dès régularisation.</Alert> : null}
      <ListView
        rows={invoices}
        rowKey={(i) => i.id}
        basePath="/client/factures"
        searchParams={await searchParams}
        search={(i) => `${i.ref} ${i.period}`}
        filters={[{ key: 'statut', label: 'Statut', options: Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => ({ value, label })), match: (i, v) => i.status === v }]}
        columns={[
          { key: 'ref', label: 'Facture', render: (i) => (i.fileId ? <a href={`/api/files/${i.fileId}`} target="_blank">{i.ref}</a> : i.ref), sort: (i) => i.ref },
          { key: 'periode', label: 'Période', render: (i) => i.period, sort: (i) => i.period },
          { key: 'l1', label: 'Ligne 1 — loyer TTC', render: (i) => fcfa(i.line1Ttc) },
          { key: 'l2', label: 'Ligne 2 — services TTC', render: (i) => fcfa(i.line2Ttc) },
          { key: 'total', label: 'Total TTC', render: (i) => <strong>{fcfa(i.totalTtc)}</strong>, sort: (i) => i.totalTtc },
          { key: 'echeance', label: 'Échéance', render: (i) => date(i.dueDate), sort: (i) => i.dueDate.getTime() },
          { key: 'statut', label: 'Statut', render: (i) => <Badge tone={i.status === 'PAYEE' ? 'success' : i.status === 'IMPAYEE' ? 'danger' : 'warning'} data-invoice-status={i.status}>{INVOICE_STATUS_LABEL[i.status]}</Badge> },
        ]}
        empty={{ title: 'Aucune facture' }}
        testId="factures"
      />
    </div>
  );
}

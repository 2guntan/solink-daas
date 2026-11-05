import Link from 'next/link';
import { prisma } from '@solink/db';
import { INVOICE_STATUS_LABEL, date, fcfa, svc } from '@solink/core';
import { Badge, Card, CardContent, PageHeader, Stat, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { runBillingAction } from '../actions';

export const metadata = { title: 'Facturation' };

/** B11 — facturation Orange 2 lignes, export, rapprochement facturé / encaissé / ventilé. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('solink');
  const [invoices, rec] = await Promise.all([
    prisma.invoice.findMany({ include: { contract: { include: { order: { include: { organisation: true } } } }, dunnings: true }, orderBy: { issueDate: 'desc' } }),
    svc.run(actor, (ctx) => svc.reconciliation(ctx)),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Facturation et rapprochement" actions={<><Link href="/api/export/orange" className={buttonVariants({ variant: 'outline' })}>Export CSV Orange</Link><Link href="/api/export/cantonnement" className={buttonVariants({ variant: 'outline' })}>Relevé de cantonnement</Link><ActionForm action={runBillingAction} submit="Générer les factures dues" inline /></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6" data-testid="rapprochement">
        <Stat label="Facturé" value={fcfa(rec.invoiced)} />
        <Stat label="Encaissé" value={fcfa(rec.collected)} />
        <Stat label="Ventilé" value={fcfa(rec.allocated)} />
        <Stat label="Écart encaissé / ventilé" value={<span data-testid="ecart">{fcfa(rec.gapCollectedAllocated)}</span>} tone={rec.gapCollectedAllocated === 0 ? 'success' : 'danger'} />
        <Stat label="Restant dû" value={fcfa(rec.outstanding)} tone={rec.outstanding ? 'warning' : undefined} />
        <Stat label="Part SOLINK" value={fcfa(rec.solink)} hint={`Banque ${fcfa(rec.banque)} · Orange ${fcfa(rec.orange)}`} />
      </div>
      <Card><CardContent className="pt-4">
        <ListView rows={invoices} rowKey={(i) => i.id} basePath="/solink/facturation" searchParams={await searchParams} search={(i) => `${i.ref} ${i.contract.order.organisation.name}`}
          filters={[{ key: 'statut', label: 'Statut', options: Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => ({ value, label })), match: (i, v) => i.status === v }]}
          columns={[
            { key: 'ref', label: 'Facture', render: (i) => (i.fileId ? <a href={`/api/files/${i.fileId}`} target="_blank">{i.ref}</a> : i.ref), sort: (i) => i.ref },
            { key: 'client', label: 'Client', render: (i) => i.contract.order.organisation.name },
            { key: 'l1', label: 'L1 loyer TTC', render: (i) => fcfa(i.line1Ttc) },
            { key: 'l2', label: 'L2 services TTC', render: (i) => fcfa(i.line2Ttc) },
            { key: 'paye', label: 'Encaissé', render: (i) => fcfa(i.paidAmount) },
            { key: 'ech', label: 'Échéance', render: (i) => date(i.dueDate), sort: (i) => i.dueDate.getTime() },
            { key: 'rel', label: 'Relances', render: (i) => i.dunnings.map((d) => d.level.split('_')[0]).join(', ') || '—' },
            { key: 'statut', label: 'Statut', render: (i) => <Badge tone={i.status === 'PAYEE' ? 'success' : i.status === 'IMPAYEE' ? 'danger' : 'warning'}>{INVOICE_STATUS_LABEL[i.status]}</Badge> },
          ]} empty={{ title: 'Aucune facture' }} />
      </CardContent></Card>
    </div>
  );
}

import Link from 'next/link';
import { prisma } from '@solink/db';
import { INVOICE_STATUS_LABEL, date, fcfa } from '@solink/core';
import { Badge, PageHeader, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Facturation 2 lignes' };

/** O04 — export facturation 2 lignes (format docs/format_orange.md). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor('orange');
  const invoices = await prisma.invoice.findMany({ include: { contract: { include: { order: { include: { organisation: true } } } } }, orderBy: { issueDate: 'desc' } });
  const periods = [...new Set(invoices.map((i) => i.period))];
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Facturation pour compte (2 lignes)" actions={<><Link href="/api/export/orange" className={buttonVariants()} data-testid="export-orange">Exporter tout (CSV)</Link>{periods.slice(0, 3).map((p) => <Link key={p} href={`/api/export/orange?periode=${p}`} className={buttonVariants({ variant: 'outline' })}>{p}</Link>)}</>} />
      <ListView rows={invoices} rowKey={(i) => i.id} basePath="/orange/facturation" searchParams={await searchParams} search={(i) => `${i.ref} ${i.contract.order.organisation.name}`}
        filters={[{ key: 'periode', label: 'Période', options: periods.map((p) => ({ value: p, label: p })), match: (i, v) => i.period === v }]}
        columns={[
          { key: 'ref', label: 'Facture', render: (i) => (i.fileId ? <a href={`/api/files/${i.fileId}`} target="_blank">{i.ref}</a> : i.ref) },
          { key: 'client', label: 'Client', render: (i) => i.contract.order.organisation.name },
          { key: 'l1', label: 'L1 loyer (pour compte banque)', render: (i) => `${fcfa(i.line1Ht)} HT · ${fcfa(i.line1Ttc)} TTC` },
          { key: 'l2', label: 'L2 services', render: (i) => `${fcfa(i.line2Ht)} HT · ${fcfa(i.line2Ttc)} TTC` },
          { key: 'total', label: 'Total TTC', render: (i) => fcfa(i.totalTtc) },
          { key: 'ech', label: 'Échéance', render: (i) => date(i.dueDate), sort: (i) => i.dueDate.getTime() },
          { key: 'statut', label: 'Statut', render: (i) => <Badge>{INVOICE_STATUS_LABEL[i.status]}</Badge> },
        ]} empty={{ title: 'Aucune facture' }} />
    </div>
  );
}

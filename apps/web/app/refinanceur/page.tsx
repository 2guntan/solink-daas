import Link from 'next/link';
import { prisma } from '@solink/db';
import { SEGMENT_LABEL, date, fcfa, now } from '@solink/core';
import { Alert, Card, CardContent, CardHeader, CardTitle, KV, PageHeader, Progress, Stat, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Portail Refinanceur' };

/** Lecture seule : portefeuille éligible à la ligne de refinancement, reporting agrégé, export CSV. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('refinanceur');
  const [line, contracts, at] = await Promise.all([
    prisma.refiLine.findFirst({ where: { refinancerId: actor.orgId }, include: { financer: true } }),
    prisma.contract.findMany({ where: { refiEligible: true, status: { in: ['ACTIF', 'SIGNE', 'FIN_DE_CONTRAT', 'EN_SIGNATURE'] } }, include: { order: { include: { organisation: true } }, invoices: true } }),
    now(prisma),
  ]);
  const crit = (line?.criteria ?? {}) as { label?: string };
  const total = contracts.reduce((a, c) => a + c.financedAmount, 0);
  const late = contracts.reduce((a, c) => a + c.invoices.filter((i) => i.status !== 'PAYEE' && i.dueDate < at).reduce((s, i) => s + i.totalTtc - i.paidAmount, 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portefeuille refinancé (lecture)" actions={<Link href="/api/export/refinanceur" className={buttonVariants()} data-testid="export-refi">Export CSV</Link>} />
      <Alert tone="info">Données transmises sur mandat de {line?.financer.name}. La plateforme ne gère pas la relation financière (cession / garantie).</Alert>
      {line ? (
        <Card>
          <CardHeader><CardTitle>Ligne de refinancement</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <KV rows={[['Bénéficiaire', line.financer.name], ['Montant', fcfa(line.amount)], ['Quotité', `${line.quotityPct} %`], ['Éligibilité', crit.label ?? '—'], ['Période', `${date(line.startDate)} → ${date(line.endDate)}`]]} />
            <div className="flex flex-col gap-2 text-sm"><p>Utilisation : {fcfa(total)} / {fcfa(line.amount)}</p><Progress value={(total / line.amount) * 100} /></div>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Contrats éligibles" value={contracts.length} />
        <Stat label="Encours éligible" value={fcfa(total)} />
        <Stat label="Retards" value={fcfa(late)} tone={late ? 'danger' : undefined} />
      </div>
      <ListView rows={contracts} rowKey={(c) => c.id} basePath="/refinanceur" searchParams={await searchParams} search={(c) => `${c.ref} ${c.order.organisation.sector ?? ''}`}
        columns={[
          { key: 'ref', label: 'Contrat', render: (c) => c.ref, sort: (c) => c.ref },
          { key: 'seg', label: 'Segment', render: (c) => SEGMENT_LABEL[c.order.organisation.segment ?? ''] },
          { key: 'sect', label: 'Secteur', render: (c) => c.order.organisation.sector },
          { key: 'fin', label: 'Financé', render: (c) => fcfa(c.financedAmount), sort: (c) => c.financedAmount },
          { key: 'duree', label: 'Durée', render: (c) => `${c.durationMonths} mois` },
          { key: 'statut', label: 'Statut', render: (c) => c.status.toLowerCase().replace(/_/g, ' ') },
        ]} empty={{ title: 'Aucun contrat éligible' }} testId="refi" />
    </div>
  );
}

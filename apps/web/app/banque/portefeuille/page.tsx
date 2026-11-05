import Link from 'next/link';
import { prisma } from '@solink/db';
import { daysBetween, date, fcfa, now, svc } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Stat, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Portefeuille' };

/** F10 — encours, échéances, retards, verrouillages, retours, exports (réglementaire et refinanceur). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('banque');
  const [contracts, at, rec, returns] = await Promise.all([
    prisma.contract.findMany({ where: { financerId: actor.orgId }, include: { order: { include: { organisation: true } }, invoices: true, devices: true, installments: true } }),
    now(prisma),
    svc.run(actor, (ctx) => svc.reconciliation(ctx, { financerId: actor.orgId })),
    prisma.deviceReturn.count(),
  ]);
  const rows = contracts.map((c) => {
    const overdue = c.invoices.filter((i) => i.status !== 'PAYEE' && i.dueDate < at);
    const maxDays = overdue.reduce((m, i) => Math.max(m, daysBetween(i.dueDate, at)), 0);
    const remaining = c.installments.filter((i) => !i.invoiceId).reduce((a, i) => a + i.rentHt, 0);
    return { c, overdueAmt: overdue.reduce((a, i) => a + i.totalTtc - i.paidAmount, 0), maxDays, remaining, locked: c.devices.filter((d) => d.status === 'VERROUILLE').length };
  });
  const bucket = (d: number) => (d === 0 ? 'À jour' : d <= 15 ? '1–15 j' : d <= 30 ? '16–30 j' : d <= 60 ? '31–60 j' : '> 60 j');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portefeuille (F10)" actions={<><Link href="/api/export/portefeuille" className={buttonVariants({ variant: 'outline' })}>Export réglementaire CSV</Link><Link href="/api/export/refinanceur" className={buttonVariants({ variant: 'outline' })}>Export refinanceur</Link><Link href="/api/export/cantonnement" className={buttonVariants({ variant: 'outline' })}>Relevé cantonnement</Link></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Contrats" value={contracts.length} />
        <Stat label="Encours financé" value={fcfa(contracts.filter((c) => c.status === 'ACTIF').reduce((a, c) => a + c.financedAmount, 0))} />
        <Stat label="Retards" value={fcfa(rows.reduce((a, r) => a + r.overdueAmt, 0))} tone="danger" />
        <Stat label="Loyers encaissés (part banque)" value={fcfa(rec.banque)} />
        <Stat label="Équipements verrouillés / retours" value={`${rows.reduce((a, r) => a + r.locked, 0)} / ${returns}`} />
      </div>
      <Card><CardHeader><CardTitle>Positions et balance âgée</CardTitle></CardHeader><CardContent>
        <ListView rows={rows} rowKey={(r) => r.c.id} basePath="/banque/portefeuille" searchParams={await searchParams} search={(r) => `${r.c.ref} ${r.c.order.organisation.name}`}
          filters={[{ key: 'age', label: 'Retard', options: ['À jour', '1–15 j', '16–30 j', '31–60 j', '> 60 j'].map((v) => ({ value: v, label: v })), match: (r, v) => bucket(r.maxDays) === v }]}
          columns={[
            { key: 'ref', label: 'Contrat', render: (r) => r.c.ref, sort: (r) => r.c.ref },
            { key: 'client', label: 'Client', render: (r) => r.c.order.organisation.name },
            { key: 'statut', label: 'Statut', render: (r) => <Badge>{r.c.status}</Badge> },
            { key: 'finance', label: 'Financé', render: (r) => fcfa(r.c.financedAmount), sort: (r) => r.c.financedAmount },
            { key: 'debut', label: 'Début / fin', render: (r) => `${date(r.c.startDate)} → ${date(r.c.endDate)}` },
            { key: 'retard', label: 'Retard', render: (r) => (r.maxDays ? <Badge tone="danger">{bucket(r.maxDays)} · {fcfa(r.overdueAmt)}</Badge> : <Badge tone="success">À jour</Badge>), sort: (r) => r.maxDays },
            { key: 'refi', label: 'Refi', render: (r) => (r.c.refiEligible ? 'éligible' : '—') },
          ]} empty={{ title: 'Aucun contrat' }} />
      </CardContent></Card>
    </div>
  );
}

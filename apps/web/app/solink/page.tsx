import Link from 'next/link';
import { prisma, type OrderStatus } from '@solink/db';
import { STATUS_INFO, fcfa, now } from '@solink/core';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Stat } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';
import { OrderStatusBadge } from '@/components/status';
import { Sla } from '@/components/sla';
import { PipelineChart } from '@/components/charts';

export const metadata = { title: 'Pipeline commandes' };

/** B01 — pipeline par état (§10) avec SLA. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor('solink');
  const [orders, at, env] = await Promise.all([
    prisma.order.findMany({ include: { organisation: true, apporteur: true }, orderBy: { statusChangedAt: 'desc' } }),
    now(prisma),
    prisma.envelope.findFirst({ where: { active: true } }),
  ]);
  const by = (ss: OrderStatus[]) => orders.filter((o) => ss.includes(o.status)).length;
  const counts = Object.entries(orders.reduce<Record<string, number>>((a, o) => ((a[o.status] = (a[o.status] ?? 0) + 1), a), {})).map(([status, n]) => ({ status: STATUS_INFO[status as OrderStatus].label, n }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Pipeline des commandes" description="Vue par état, propriétaire et SLA. SOLINK prépare, transmet, trace et exécute — il ne décide jamais du crédit." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="À pré-contrôler" value={by(['PRE_CONTROLE'])} tone={by(['PRE_CONTROLE']) ? 'warning' : undefined} />
        <Stat label="Chez la banque" value={by(['TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'PIECES_COMPLEMENTAIRES'])} />
        <Stat label="En signature" value={by(['OFFRE_EMISE', 'SIGNATURE_CLIENT', 'CONTRESIGNATURE', 'CONDITIONS_SUSPENSIVES'])} />
        <Stat label="À acheter / livrer" value={by(['PRET_POUR_ACHAT', 'ACHETE', 'EN_PREPARATION', 'EXPEDIE', 'PV_A_SIGNER'])} />
        <Stat label="Enveloppe disponible" value={env ? fcfa(env.total - env.reserved - env.consumed) : '—'} />
      </div>
      <Card>
        <CardHeader><CardTitle>Commandes par état</CardTitle></CardHeader>
        <CardContent><PipelineChart data={counts} /></CardContent>
      </Card>
      <ListView
        rows={orders}
        rowKey={(o) => o.id}
        basePath="/solink"
        searchParams={await searchParams}
        search={(o) => `${o.ref} ${o.organisation.name}`}
        filters={[
          { key: 'statut', label: 'État', options: (Object.keys(STATUS_INFO) as OrderStatus[]).map((s) => ({ value: s, label: STATUS_INFO[s].label })), match: (o, v) => o.status === v },
          { key: 'proprio', label: 'Propriétaire', options: ['Client', 'SOLINK', 'Financeur'].map((v) => ({ value: v, label: v })), match: (o, v) => STATUS_INFO[o.status].owner.includes(v) },
        ]}
        columns={[
          { key: 'ref', label: 'Commande', render: (o) => <Link href={`/solink/commandes/${o.id}`}>{o.ref}</Link>, sort: (o) => o.ref },
          { key: 'client', label: 'Client', render: (o) => o.organisation.name, sort: (o) => o.organisation.name },
          { key: 'etat', label: 'État', render: (o) => <OrderStatusBadge status={o.status} internal />, sort: (o) => o.status },
          { key: 'proprio', label: 'Propriétaire', render: (o) => STATUS_INFO[o.status].owner },
          { key: 'sla', label: 'SLA', render: (o) => <Sla status={o.status} since={o.statusChangedAt} now={at} /> },
          { key: 'montant', label: 'Financé', render: (o) => fcfa(o.financedAmount), sort: (o) => o.financedAmount },
          { key: 'apporteur', label: 'Apporteur', render: (o) => o.apporteur?.name ?? '—' },
        ]}
        testId="pipeline"
      />
    </div>
  );
}

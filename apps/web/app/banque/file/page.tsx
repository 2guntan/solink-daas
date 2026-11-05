import Link from 'next/link';
import { prisma } from '@solink/db';
import { SEGMENT_LABEL, date, fcfa, now } from '@solink/core';
import { Badge, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';
import { ActionForm } from '@/components/action-form';
import { OrderStatusBadge } from '@/components/status';
import { Sla } from '@/components/sla';
import { assignAction } from '../actions';

export const metadata = { title: 'File d’instruction' };

/** F02 — liste filtrable (segment, montant, apporteur, ancienneté, voie) ; affectation à un analyste. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('banque');
  const [rows, at, users] = await Promise.all([
    prisma.order.findMany({ where: { financerId: actor.orgId, creditFile: { isNot: null }, status: { notIn: ['DOSSIER_EN_COURS', 'PRE_CONTROLE', 'DOSSIER_A_REPRENDRE', 'PANIER', 'DEVIS_EMIS', 'DEVIS_ACCEPTE'] } }, include: { organisation: true, apporteur: true, creditFile: true }, orderBy: { statusChangedAt: 'desc' } }),
    now(prisma),
    prisma.user.findMany(),
  ]);
  return (
    <div>
      <PageHeader title="File d’instruction" />
      <ListView rows={rows} rowKey={(r) => r.id} basePath="/banque/file" searchParams={await searchParams} search={(r) => `${r.ref} ${r.organisation.name}`}
        filters={[
          { key: 'segment', label: 'Segment', options: Object.entries(SEGMENT_LABEL).map(([value, label]) => ({ value, label })), match: (r, v) => r.organisation.segment === v },
          { key: 'voie', label: 'Voie', options: [{ value: 'AUTO', label: 'Accord auto' }, { value: 'ANALYSTE', label: 'Analyste' }, { value: 'REFUS_PROPOSE', label: 'Refus proposé' }], match: (r, v) => r.creditFile?.route === v },
          { key: 'montant', label: 'Montant', options: [{ value: 'lt10', label: '< 10 M' }, { value: '10-50', label: '10–50 M' }, { value: 'gt50', label: '> 50 M' }], match: (r, v) => (v === 'lt10' ? r.financedAmount < 1e7 : v === 'gt50' ? r.financedAmount > 5e7 : r.financedAmount >= 1e7 && r.financedAmount <= 5e7) },
          { key: 'apporteur', label: 'Apporteur', options: [{ value: 'orange', label: 'Orange' }, { value: 'direct', label: 'Direct' }], match: (r, v) => (v === 'orange' ? !!r.apporteurId : !r.apporteurId) },
        ]}
        columns={[
          { key: 'ref', label: 'Dossier', render: (r) => <Link href={`/banque/dossiers/${r.id}`}>{r.ref.replace('CMD', 'FR')}</Link>, sort: (r) => r.ref },
          { key: 'client', label: 'Client', render: (r) => <>{r.organisation.name}<br /><span className="text-xs text-slate-500">{SEGMENT_LABEL[r.organisation.segment ?? '']}</span></>, sort: (r) => r.organisation.name },
          { key: 'montant', label: 'Montant', render: (r) => fcfa(r.financedAmount), sort: (r) => r.financedAmount },
          { key: 'score', label: 'Score', render: (r) => r.creditFile?.score ?? '—', sort: (r) => r.creditFile?.score ?? 0 },
          { key: 'voie', label: 'Voie', render: (r) => <Badge tone={r.creditFile?.route === 'AUTO' ? 'success' : r.creditFile?.route === 'REFUS_PROPOSE' ? 'danger' : 'info'}>{r.creditFile?.route ?? '—'}</Badge> },
          { key: 'statut', label: 'Statut', render: (r) => <OrderStatusBadge status={r.status} internal /> },
          { key: 'anc', label: 'Ancienneté', render: (r) => <>{date(r.creditFile?.submittedAt)}<br /><Sla status={r.status} since={r.statusChangedAt} now={at} /></>, sort: (r) => r.creditFile?.submittedAt?.getTime() ?? 0 },
          { key: 'analyste', label: 'Analyste', render: (r) => (r.creditFile?.analystId ? users.find((u) => u.id === r.creditFile?.analystId)?.email : <ActionForm action={assignAction} hidden={{ orderId: r.id }} submit="M’affecter" size="sm" variant="secondary" inline />) },
        ]} empty={{ title: 'Aucun dossier dans la file' }} testId="file" />
    </div>
  );
}

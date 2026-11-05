import { prisma } from '@solink/db';
import { date } from '@solink/core';
import { Badge, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { ticketStatusAction } from '../actions';

export const metadata = { title: 'Tickets' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor('solink');
  const tickets = await prisma.ticket.findMany({ include: { organisation: true, device: true }, orderBy: { createdAt: 'desc' } });
  return (
    <div>
      <PageHeader title="Tickets support (B10)" />
      <ListView rows={tickets} rowKey={(t) => t.id} basePath="/solink/tickets" searchParams={await searchParams} search={(t) => `${t.ref} ${t.subject} ${t.organisation.name}`}
        filters={[{ key: 'statut', label: 'Statut', options: ['OUVERT', 'EN_COURS', 'RESOLU'].map((v) => ({ value: v, label: v.replace('_', ' ').toLowerCase() })), match: (t, v) => t.status === v }]}
        columns={[
          { key: 'ref', label: 'Ticket', render: (t) => t.ref, sort: (t) => t.ref },
          { key: 'client', label: 'Client', render: (t) => t.organisation.name },
          { key: 'sujet', label: 'Sujet', render: (t) => <>{t.subject}<p className="text-xs text-slate-500">{t.description}</p></> },
          { key: 'prio', label: 'Priorité', render: (t) => <Badge tone={t.priority === 'HAUTE' ? 'danger' : 'neutral'}>{t.priority.toLowerCase()}</Badge> },
          { key: 'date', label: 'Ouvert le', render: (t) => date(t.createdAt), sort: (t) => t.createdAt.getTime() },
          { key: 'statut', label: 'Statut', render: (t) => <ActionForm action={ticketStatusAction} hidden={{ ticketId: t.id }} submit="OK" size="sm" variant="secondary" inline><Select name="status" defaultValue={t.status} className="h-8 text-xs" aria-label="Statut"><option value="OUVERT">Ouvert</option><option value="EN_COURS">En cours</option><option value="RESOLU">Résolu</option></Select></ActionForm> },
        ]} empty={{ title: 'Aucun ticket' }} />
    </div>
  );
}

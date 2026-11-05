import { prisma } from '@solink/db';
import { date } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, Select, Textarea } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { createTicketAction } from '../actions';

export const metadata = { title: 'Support' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('client');
  const [tickets, devices] = await Promise.all([
    prisma.ticket.findMany({ where: { organisationId: actor.orgId }, include: { device: true }, orderBy: { createdAt: 'desc' } }),
    prisma.device.findMany({ where: { order: { organisationId: actor.orgId } }, include: { product: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Support" />
      <Card>
        <CardHeader><CardTitle>Ouvrir un ticket</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createTicketAction} submit="Créer le ticket">
            <Field label="Sujet"><Input name="subject" required /></Field>
            <Field label="Équipement concerné"><Select name="deviceId"><option value="">— aucun —</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.serial} — {d.product.name}</option>)}</Select></Field>
            <Field label="Description"><Textarea name="description" required /></Field>
          </ActionForm>
        </CardContent>
      </Card>
      <ListView rows={tickets} rowKey={(t) => t.id} basePath="/client/tickets" searchParams={await searchParams} search={(t) => `${t.ref} ${t.subject}`}
        filters={[{ key: 'statut', label: 'Statut', options: ['OUVERT', 'EN_COURS', 'RESOLU'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase() })), match: (t, v) => t.status === v }]}
        columns={[
          { key: 'ref', label: 'Ticket', render: (t) => t.ref, sort: (t) => t.ref },
          { key: 'sujet', label: 'Sujet', render: (t) => t.subject },
          { key: 'eq', label: 'Équipement', render: (t) => t.device?.serial ?? '—' },
          { key: 'statut', label: 'Statut', render: (t) => <Badge tone={t.status === 'RESOLU' ? 'success' : 'info'}>{t.status.replace('_', ' ').toLowerCase()}</Badge> },
          { key: 'date', label: 'Ouvert le', render: (t) => date(t.createdAt), sort: (t) => t.createdAt.getTime() },
        ]} empty={{ title: 'Aucun ticket' }} />
    </div>
  );
}

import { prisma } from '@solink/db';
import { SEGMENT_LABEL, date } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, Select, Textarea } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { createLeadAction, inviteLeadAction } from '../actions';

export const metadata = { title: 'Leads' };

/** O01 — créer un lead / inviter un client (invitation pré-remplie, attribution apporteur automatique). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('orange');
  const leads = await prisma.lead.findMany({ where: { apporteurId: actor.orgId }, orderBy: { createdAt: 'desc' } });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Leads et invitations" />
      <Card>
        <CardHeader><CardTitle>Nouveau lead</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createLeadAction} submit="Créer le lead">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Entreprise"><Input name="companyName" required /></Field>
              <Field label="NINEA (si connu)"><Input name="ninea" /></Field>
              <Field label="Segment"><Select name="segment">{Object.entries(SEGMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Contact"><Input name="contactName" required /></Field>
              <Field label="Email du contact"><Input name="contactEmail" type="email" required /></Field>
              <Field label="Téléphone"><Input name="contactPhone" /></Field>
            </div>
            <Field label="Besoin"><Textarea name="need" required /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="invite" defaultChecked /> Envoyer immédiatement l’invitation pré-remplie</label>
          </ActionForm>
        </CardContent>
      </Card>
      <ListView rows={leads} rowKey={(l) => l.id} basePath="/orange/leads" searchParams={await searchParams} search={(l) => `${l.companyName} ${l.contactName}`}
        filters={[{ key: 'statut', label: 'Statut', options: ['NOUVEAU', 'INVITE', 'CONVERTI', 'PERDU'].map((v) => ({ value: v, label: v.toLowerCase() })), match: (l, v) => l.status === v }]}
        columns={[
          { key: 'ent', label: 'Entreprise', render: (l) => l.companyName, sort: (l) => l.companyName },
          { key: 'contact', label: 'Contact', render: (l) => `${l.contactName} · ${l.contactEmail}` },
          { key: 'besoin', label: 'Besoin', render: (l) => l.need },
          { key: 'date', label: 'Créé le', render: (l) => date(l.createdAt), sort: (l) => l.createdAt.getTime() },
          { key: 'statut', label: 'Statut', render: (l) => (l.status === 'NOUVEAU' ? <ActionForm action={inviteLeadAction} hidden={{ leadId: l.id }} submit="Inviter" size="sm" inline /> : <Badge>{l.status.toLowerCase()}</Badge>) },
        ]} empty={{ title: 'Aucun lead' }} />
    </div>
  );
}

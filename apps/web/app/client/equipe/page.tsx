import { prisma, type Role } from '@solink/db';
import { ROLE_LABEL } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { inviteMemberAction, updateMemberAction } from '../actions';

export const metadata = { title: 'Équipe et rôles' };
const ROLES: Role[] = ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'CLIENT_APPROBATEUR', 'CLIENT_RECEPTION', 'CLIENT_EMPLOYE'];

/** E04 — invitation de membres, rôles, désignation des signataires (seul / conjoint). */
export default async function Page() {
  const actor = await requireActor('client');
  const members = await prisma.membership.findMany({ where: { organisationId: actor.orgId }, include: { user: true }, orderBy: { createdAt: 'asc' } });
  const admin = actor.roles.includes('CLIENT_ADMIN');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Équipe et rôles" />
      {!members.some((m) => m.isSignatory) ? <Alert tone="warning">Désignez au moins un signataire : le dossier ne peut pas être soumis sans signataire.</Alert> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {members.map((m) => (
          <Card key={m.id} className="p-4">
            <p className="font-medium">{m.user.firstName} {m.user.lastName}</p>
            <p className="text-xs text-slate-500">{m.user.email} · {m.user.title}</p>
            <div className="mt-1 flex flex-wrap gap-1">{m.roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)}{m.isSignatory ? <Badge tone="primary">Signataire ({m.signatureMode === 'CONJOINT' ? 'conjoint' : 'seul'})</Badge> : null}</div>
            {admin ? (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-primary">Modifier</summary>
                <ActionForm action={updateMemberAction} hidden={{ membershipId: m.id }} submit="Enregistrer" size="sm" className="mt-2">
                  <div className="grid grid-cols-2 gap-1">{ROLES.map((r) => <label key={r} className="flex items-center gap-1 text-xs"><input type="checkbox" name="roles" value={r} defaultChecked={m.roles.includes(r)} /> {ROLE_LABEL[r]}</label>)}</div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isSignatory" defaultChecked={m.isSignatory} /> Signataire habilité</label>
                  <Select name="signatureMode" defaultValue={m.signatureMode}><option value="SEUL">Signature seule</option><option value="CONJOINT">Signature conjointe</option></Select>
                </ActionForm>
              </details>
            ) : null}
          </Card>
        ))}
      </div>
      {admin ? (
        <Card>
          <CardHeader><CardTitle>Inviter un membre</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={inviteMemberAction} submit="Envoyer l’invitation">
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Email"><Input name="email" type="email" required /></Field>
                <Field label="Prénom"><Input name="firstName" required /></Field>
                <Field label="Nom"><Input name="lastName" required /></Field>
                <Field label="Fonction"><Input name="title" /></Field>
                <Field label="Mobile (+221)"><Input name="mobile" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{ROLES.map((r) => <label key={r} className="flex items-center gap-1 text-sm"><input type="checkbox" name="roles" value={r} /> {ROLE_LABEL[r]}</label>)}</div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSignatory" /> Signataire habilité (pouvoirs justifiés par une pièce validée)</label>
              <Select name="signatureMode" aria-label="Mode de signature"><option value="SEUL">Signature seule</option><option value="CONJOINT">Signature conjointe</option></Select>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

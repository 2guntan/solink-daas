import { prisma } from '@solink/db';
import { SEGMENT_LABEL, fcfa } from '@solink/core';
import { Card, CardContent, DemoBadge, Field, Input, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { updateCompanyAction } from '../actions';

export const metadata = { title: 'Entreprise' };

/** E03 — identification de l'entreprise (NINEA) ; segment ; seuil d'approbation interne. */
export default async function Page() {
  const actor = await requireActor('client');
  const o = await prisma.organisation.findUniqueOrThrow({ where: { id: actor.orgId } });
  return (
    <div>
      <PageHeader title="Entreprise" description="Saisie une fois, réutilisée partout (devis, dossier, contrat, facture)." />
      <Card>
        <CardContent className="pt-4">
          <ActionForm action={updateCompanyAction} submit="Enregistrer" disabled={!actor.roles.includes('CLIENT_ADMIN')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Raison sociale"><Input name="name" defaultValue={o.name} required /></Field>
              <Field label="NINEA" hint="Si le NINEA existe déjà, une demande d’accès est envoyée à son administrateur."><Input name="ninea" defaultValue={o.ninea ?? ''} required /></Field>
              <Field label="RCCM"><Input name="rccm" defaultValue={o.rccm ?? ''} /></Field>
              <Field label="Segment"><Select name="segment" defaultValue={o.segment ?? ''}>{Object.entries(SEGMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Secteur"><Input name="sector" defaultValue={o.sector ?? ''} /></Field>
              <Field label="Forme juridique"><Input name="legalForm" defaultValue={o.legalForm ?? ''} /></Field>
              <Field label="Date de création"><Input type="date" name="createdOn" defaultValue={o.createdOn?.toISOString().slice(0, 10)} /></Field>
              <Field label="Siège"><Input name="address" defaultValue={o.address ?? ''} /></Field>
              <Field label="Seuil d’approbation interne (FCFA/mois)" hint={`Actuel : ${fcfa(o.approvalThreshold ?? 2000000)}`}><Input name="approvalThreshold" inputMode="numeric" defaultValue={o.approvalThreshold ?? 2000000} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="jointSignature" defaultChecked={o.jointSignature} /> Les statuts exigent deux signatures (signature conjointe)</label>
            <DemoBadge />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

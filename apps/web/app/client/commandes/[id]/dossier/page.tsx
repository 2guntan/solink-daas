import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { BLOCKS, assertOrderAccess, blockCompletion, date, requiredYears, type DossierBlocks } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, Progress, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { DocStatusBadge } from '@/components/status';
import {
  confirmExtractionAction,
  inviteColleagueAction,
  notApplicableAction,
  provideComplementsAction,
  saveDeclarationsAction,
  saveEntrepriseAction,
  saveFinancesAction,
  savePersonsAction,
  submitDossierAction,
  uploadAllDemoAction,
  uploadDocAction,
} from '../../../actions';

export const metadata = { title: 'Dossier de financement' };

const EDITABLE = ['DOSSIER_EN_COURS', 'DOSSIER_A_REPRENDRE', 'PIECES_COMPLEMENTAIRES'];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor('client');
  const o = await prisma.order.findUnique({ where: { id }, include: { organisation: true, creditFile: { include: { documents: { orderBy: [{ origin: 'asc' }, { label: 'asc' }] } } } } });
  if (!o || !o.creditFile) notFound();
  assertOrderAccess(actor, o);
  const cf = o.creditFile;
  const blocks = (cf.blocks ?? {}) as DossierBlocks;
  const seg = o.organisation.segment!;
  const comp = blockCompletion(seg, blocks, cf.documents);
  const editable = EDITABLE.includes(o.status);
  const financeOnly = actor.roles.length === 1 && actor.roles[0] === 'CLIENT_FINANCE';
  const checklistDocs = cf.documents.filter((d) => d.origin === 'CHECKLIST');
  const bankDocs = cf.documents.filter((d) => d.origin === 'DEMANDE_BANQUE');
  const submittable = checklistDocs.filter((d) => d.required).every((d) => ['EN_VERIFICATION', 'VALIDEE', 'NON_APPLICABLE'].includes(d.status));
  const e = blocks.entreprise ?? {};
  const persons = [...(blocks.dirigeants?.persons ?? [])];
  while (persons.length < 4) persons.push({ type: 'BENEFICIAIRE_EFFECTIF', firstName: '', lastName: '' });
  const ny = Math.max(requiredYears(seg), 1);
  const years = [...(blocks.finances?.years ?? [])];
  const thisYear = new Date().getUTCFullYear();
  while (years.length < ny) years.push({ year: thisYear - 1 - years.length, ca: 0, rex: 0, rn: 0, cp: 0, dettes: 0, tresorerie: 0 });
  const decl = blocks.declarations ?? {};
  const docCard = (d: (typeof cf.documents)[number]) => {
    const ex = (d.extraction ?? null) as { fields?: { key: string; label: string; value: string; confidence: number }[]; confirmed?: boolean } | null;
    const canUpload = editable && d.status !== 'VALIDEE' && (o.status !== 'PIECES_COMPLEMENTAIRES' || d.origin === 'DEMANDE_BANQUE' || d.status === 'A_REPRENDRE');
    return (
      <li key={d.id} id={`piece-${d.id}`} className="rounded-lg border p-3" data-testid={`piece-${d.type}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{d.label}{d.origin === 'DEMANDE_BANQUE' ? <Badge tone="warning" className="ml-2">Demandée par la banque</Badge> : null}</p>
          <DocStatusBadge status={d.status} />
        </div>
        {d.requestMessage ? <p className="text-sm text-amber-800">« {d.requestMessage} » — avant le {date(d.dueDate)}</p> : null}
        {d.status === 'A_REPRENDRE' && d.rejectReason ? <p className="text-sm text-red-700" data-testid="motif">Motif : {d.rejectReason}</p> : null}
        {d.status === 'NON_APPLICABLE' ? <p className="text-sm text-slate-500">Non applicable : {d.naJustification}</p> : null}
        {d.fileId ? <a href={`/api/files/${d.fileId}`} target="_blank" className="text-sm">Voir la pièce (v{d.version})</a> : null}
        {ex?.fields?.length ? (
          <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
            <p className="font-medium">Champs extraits (OCR) {ex.confirmed ? <Badge tone="success">confirmés</Badge> : <Badge tone="info">à confirmer</Badge>}</p>
            <ul>{ex.fields.map((f) => <li key={f.key}>{f.label} : <strong>{f.value}</strong> <span className="text-slate-400">({Math.round(f.confidence * 100)} %)</span></li>)}</ul>
            {!ex.confirmed && editable ? <ActionForm action={confirmExtractionAction} hidden={{ documentId: d.id }} submit="Confirmer ces champs" size="sm" variant="secondary" /> : null}
          </div>
        ) : null}
        {canUpload ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <ActionForm action={uploadDocAction} hidden={{ documentId: d.id, mode: 'file' }} submit="Téléverser" size="sm" className="sm:flex-row sm:items-end">
              <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" capture="environment" aria-label={`Fichier ${d.label}`} className="text-xs" />
            </ActionForm>
            <ActionForm action={uploadDocAction} hidden={{ documentId: d.id, mode: 'demo' }} submit="Pièce de démo" size="sm" variant="outline" testId={`demo-${d.type}`} />
            {['RCCM', 'RELEVES_BANCAIRES', 'BENEFICIAIRES'].includes(d.type) ? <ActionForm action={uploadDocAction} hidden={{ documentId: d.id, mode: 'demo-perime' }} submit="Pièce de démo périmée" size="sm" variant="ghost" testId={`demo-perime-${d.type}`} /> : null}
            {d.origin === 'CHECKLIST' && d.status === 'A_FOURNIR' ? <ActionForm action={notApplicableAction} hidden={{ documentId: d.id }} submit="Non applicable" size="sm" variant="ghost" reason="Justification" confirm="Déclarer cette pièce non applicable ?" /> : null}
          </div>
        ) : null}
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/client/commandes/${o.id}`} className="text-sm">← Commande {o.ref}</Link>
      <PageHeader title="Dossier de financement" description={`Checklist ${cf.checklistVersion} · version scellée v${cf.version}`} />
      {!editable ? <Alert tone="info" title="Dossier scellé">Le dossier est en cours de traitement ; il n’est plus modifiable à ce stade.</Alert> : null}
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-5" data-testid="progression">
          {BLOCKS.map((b) => (
            <a key={b.key} href={`#bloc-${b.key}`} className="no-underline">
              <p className="text-xs text-slate-600">{b.label}</p>
              <Progress value={comp[b.key]} tone={comp[b.key] === 100 ? 'success' : 'primary'} />
              <p className="text-xs text-slate-500">{comp[b.key]} %</p>
            </a>
          ))}
        </CardContent>
      </Card>

      {bankDocs.length ? (
        <Card id="bloc-complements" className="border-amber-300">
          <CardHeader><CardTitle>Pièces complémentaires demandées par la banque</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">{bankDocs.map(docCard)}</ul>
            {o.status === 'PIECES_COMPLEMENTAIRES' ? <ActionForm action={provideComplementsAction} hidden={{ orderId: o.id }} submit="Transmettre les compléments à la banque" disabled={bankDocs.some((d) => d.status === 'A_FOURNIR')} testId="transmettre-complements" /> : null}
          </CardContent>
        </Card>
      ) : null}

      {!financeOnly ? (
        <Card id="bloc-entreprise">
          <CardHeader><CardTitle>1. Entreprise</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={saveEntrepriseAction} hidden={{ orderId: o.id }} submit="Enregistrer" disabled={!editable}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Raison sociale"><Input name="name" defaultValue={e.name} /></Field>
                <Field label="NINEA"><Input name="ninea" defaultValue={e.ninea} /></Field>
                <Field label="RCCM"><Input name="rccm" defaultValue={e.rccm} /></Field>
                <Field label="Forme juridique"><Input name="legalForm" defaultValue={e.legalForm} /></Field>
                <Field label="Date de création"><Input name="createdOn" type="date" defaultValue={e.createdOn} /></Field>
                <Field label="Capital (FCFA)"><Input name="capital" inputMode="numeric" defaultValue={e.capital} /></Field>
                <Field label="Siège"><Input name="address" defaultValue={e.address} /></Field>
                <Field label="Activité (NAEMA)"><Input name="activity" defaultValue={e.activity} /></Field>
                <Field label="Effectif"><Input name="employees" inputMode="numeric" defaultValue={e.employees} /></Field>
                <Field label="Banques actuelles"><Input name="banks" defaultValue={e.banks} /></Field>
                <Field label="Groupe d’appartenance"><Input name="group" defaultValue={e.group} /></Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {!financeOnly ? (
        <Card id="bloc-dirigeants">
          <CardHeader><CardTitle>2. Dirigeants, signataires et bénéficiaires effectifs</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={savePersonsAction} hidden={{ orderId: o.id }} submit="Enregistrer" disabled={!editable}>
              {persons.map((p, i) => (
                <div key={i} className="grid gap-2 border-b pb-2 sm:grid-cols-6">
                  <Select name="type" defaultValue={p.type} aria-label="Type"><option value="DIRIGEANT">Dirigeant</option><option value="SIGNATAIRE">Signataire</option><option value="BENEFICIAIRE_EFFECTIF">Bénéficiaire effectif</option></Select>
                  <Input name="firstName" defaultValue={p.firstName} placeholder="Prénom" aria-label="Prénom" />
                  <Input name="lastName" defaultValue={p.lastName} placeholder="Nom" aria-label="Nom" />
                  <Input name="role" defaultValue={p.role} placeholder="Fonction" aria-label="Fonction" />
                  <Input name="ownershipPct" defaultValue={p.ownershipPct} placeholder="% détention" aria-label="% détention" inputMode="numeric" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="ppe" value={i} defaultChecked={p.ppe} /> PPE</label>
                </div>
              ))}
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      <Card id="bloc-finances">
        <CardHeader><CardTitle>3. Finances ({ny} derniers exercices)</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={saveFinancesAction} hidden={{ orderId: o.id }} submit="Enregistrer" disabled={!editable}>
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th className="p-1">Exercice</th><th className="p-1">CA</th><th className="p-1">Résultat d’exploitation</th><th className="p-1">Résultat net</th><th className="p-1">Capitaux propres</th><th className="p-1">Dettes financières</th><th className="p-1">Trésorerie</th></tr></thead>
                <tbody>
                  {years.map((y, i) => (
                    <tr key={i}>
                      <td className="p-1"><Input name="year" defaultValue={y.year} className="w-20" aria-label="Exercice" /></td>
                      {(['ca', 'rex', 'rn', 'cp', 'dettes', 'tresorerie'] as const).map((k) => <td key={k} className="p-1"><Input name={k} defaultValue={y[k] || ''} inputMode="numeric" className="w-36" aria-label={`${k} ${y.year}`} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Field label="Engagements en cours (crédits, leasings)"><Input name="commitments" defaultValue={blocks.finances?.commitments} /></Field>
          </ActionForm>
          {editable && !financeOnly ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-primary">Inviter un collègue à compléter ce bloc (ex. le DAF)</summary>
              <ActionForm action={inviteColleagueAction} submit="Inviter" size="sm" className="mt-2 sm:flex-row">
                <Input name="email" type="email" required placeholder="daf@entreprise.sn" aria-label="Email du collègue" />
                <Input name="firstName" placeholder="Prénom" aria-label="Prénom du collègue" />
              </ActionForm>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card id="bloc-pieces">
        <CardHeader>
          <CardTitle>4. Pièces justificatives</CardTitle>
          {editable ? <ActionForm action={uploadAllDemoAction} hidden={{ orderId: o.id }} submit="Joindre toutes les pièces de démo" variant="secondary" size="sm" testId="toutes-pieces-demo" /> : null}
        </CardHeader>
        <CardContent><ul className="flex flex-col gap-2">{checklistDocs.map(docCard)}</ul></CardContent>
      </Card>

      {!financeOnly ? (
        <Card id="bloc-declarations">
          <CardHeader><CardTitle>5. Consentements et déclarations</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={saveDeclarationsAction} hidden={{ orderId: o.id }} submit="Enregistrer les déclarations" disabled={!editable} testId="declarations">
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="exactitude" defaultChecked={decl.exactitude} className="mt-1 h-5 w-5" /> Je certifie l’exactitude des informations et des pièces fournies.</label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ppe" defaultChecked={decl.ppe} className="mt-1 h-5 w-5" /> J’ai déclaré le statut PPE des dirigeants et bénéficiaires effectifs.</label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="orange" defaultChecked={decl.orange} className="mt-1 h-5 w-5" /> J’accepte l’échange de mon historique de paiement Orange avec le financeur.</label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {['DOSSIER_EN_COURS', 'DOSSIER_A_REPRENDRE'].includes(o.status) ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-2 pt-4">
            {!submittable ? <p className="text-sm text-slate-600" data-testid="soumission-bloquee">Le bouton s’active quand toutes les pièces obligatoires sont « En vérification » ou « Validées ».</p> : null}
            <ActionForm action={submitDossierAction} hidden={{ orderId: o.id }} submit={o.status === 'DOSSIER_A_REPRENDRE' ? 'Re-soumettre le dossier' : 'Soumettre le dossier'} disabled={!submittable} testId="soumettre-dossier" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

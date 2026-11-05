import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { CONDITION_LABEL, DOC_TYPES, SEGMENT_LABEL, assertOrderAccess, fcfa, run, svc } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, KV, PageHeader, Select, Textarea, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { DossierView } from '@/components/dossier-view';
import { OrderStatusBadge } from '@/components/status';
import { acknowledgeAction, activateMandateAction, confirmDepositAction, decideAction, liftConditionAction, requestDocsAction } from '../../actions';

/** F03 dossier · F04 décision · F05 demande de pièces · F06 contre-signature · F07 conditions suspensives. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor('banque');
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      organisation: true,
      apporteur: true,
      creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } },
      contract: { include: { ceremonies: { include: { signers: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 1 }, mandate: true, documents: true } },
    },
  });
  if (!o) notFound();
  assertOrderAccess(actor, o);
  const synth = o.creditFile ? await run(actor, (ctx) => svc.synthesisData(ctx, o.id)) : null;
  const delegation = svc.delegationOf(actor);
  const analyse = ['TRANSMIS_FINANCEUR', 'EN_ANALYSE'].includes(o.status);
  const canDecide = actor.roles.some((r) => ['BANQUE_ANALYSTE', 'BANQUE_VALIDEUR'].includes(r));
  const cer = o.contract?.ceremonies[0];
  const bankSigner = cer?.signers.find((s) => s.role === 'BANQUE');
  const conds = o.contract ? await run(actor, (ctx) => svc.suspensiveStatus(ctx, o.id)) : [];
  const decision = o.creditFile?.decisions[0];
  return (
    <div className="flex flex-col gap-4">
      <Link href="/banque/file" className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-neutral-500 no-underline hover:text-neutral-900 hover:no-underline">← File d’instruction</Link>
      <PageHeader title={`Dossier ${o.ref.replace('CMD', 'FR')} — ${o.organisation.name}`} description={<span className="flex flex-wrap items-center gap-2"><OrderStatusBadge status={o.status} internal /> {SEGMENT_LABEL[o.organisation.segment ?? '']} · {o.apporteur ? `apporté par ${o.apporteur.name}` : 'direct'} {o.sampled ? <Badge tone="warning">échantillon contrôle a posteriori</Badge> : null}</span>} />
      <Card>
        <CardHeader><CardTitle>Financement demandé</CardTitle></CardHeader>
        <CardContent><KV rows={[['Montant financé', fcfa(o.financedAmount)], ['Mensualité TTC (toutes composantes)', fcfa(o.monthlyTtc)], ['Durée', `${o.durationMonths} mois`], ['Dépôt', fcfa(o.depositTtc)]]} /></CardContent>
      </Card>
      {synth ? (
        <Card data-testid="synthese">
          <CardHeader><CardTitle>Fiche de synthèse <Badge tone="info">assistant IA</Badge></CardTitle></CardHeader>
          <CardContent className="text-sm">
            {synth.synthesis.text.map((t, i) => <p key={i}>{t}</p>)}
            <p className="mt-2 text-xs text-slate-500">{synth.synthesis.disclaimer}</p>
          </CardContent>
        </Card>
      ) : null}
      {analyse && canDecide ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-primary" data-testid="decision-form">
            <CardHeader><CardTitle>Décision (F04)</CardTitle><p className="text-xs text-slate-500">Votre délégation : {svc.DELEGATION[delegation].label} — jusqu’à {delegation === 'N2' ? 'illimité' : fcfa(svc.DELEGATION.N1.max)}</p></CardHeader>
            <CardContent>
              {o.status === 'TRANSMIS_FINANCEUR' ? <ActionForm action={acknowledgeAction} hidden={{ orderId: o.id }} submit="Accuser réception (passer en analyse)" variant="secondary" size="sm" className="mb-3" testId="accuser-reception" /> : null}
              <ActionForm action={decideAction} hidden={{ orderId: o.id }} submit="Enregistrer la décision" confirm="Cette décision est irréversible et sera notifiée au client. Confirmer ?" reason="Motif interne (reste chez le financeur)" testId="decider">
                <Field label="Résultat"><Select name="result" defaultValue="ACCORDE" aria-label="Résultat"><option value="ACCORDE">Accordé</option><option value="ACCORDE_SOUS_CONDITIONS">Accordé sous conditions</option><option value="REFUSE">Refusé</option><option value="SANS_SUITE">Sans suite</option></Select></Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Montant accordé"><Input name="amount" defaultValue={o.financedAmount} inputMode="numeric" /></Field>
                  <Field label="Durée (mois)"><Input name="duration" defaultValue={o.durationMonths} inputMode="numeric" /></Field>
                  <Field label="Validité (jours)"><Input name="validityDays" defaultValue={60} inputMode="numeric" /></Field>
                </div>
                <p className="text-xs font-medium">Conditions (accord sous conditions)</p>
                {[0, 1].map((i) => (
                  <div key={i} className="grid gap-1 sm:grid-cols-4">
                    <Select name="condType" aria-label={`Type condition ${i + 1}`}><option value="">— type —</option>{Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                    <Select name="condNature" aria-label={`Nature condition ${i + 1}`}><option value="SUSPENSIVE">Suspensive (avant achat)</option><option value="PREALABLE">Préalable (avant signature)</option></Select>
                    <Input name="condLabel" placeholder="Libellé" aria-label={`Libellé condition ${i + 1}`} />
                    <Input name="condValue" placeholder="Valeur (ex. 2 mensualités)" aria-label={`Valeur condition ${i + 1}`} />
                  </div>
                ))}
              </ActionForm>
            </CardContent>
          </Card>
          <Card data-testid="demande-pieces">
            <CardHeader><CardTitle>Demande de pièces complémentaires (F05)</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={requestDocsAction} hidden={{ orderId: o.id }} submit="Envoyer la demande au client" testId="demander-pieces">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{['RELEVES_BANCAIRES', 'ATTESTATION_SOCIALE', 'ATTESTATION_FISCALE', 'ETATS_FIN_N3', 'CAUTION', 'AUTRE'].map((t) => <label key={t} className="flex items-center gap-2 text-sm"><input type="checkbox" name="types" value={t} /> {DOC_TYPES[t].label}</label>)}</div>
                <Field label="Message au client"><Textarea name="message" defaultValue="Merci de nous transmettre les pièces ci-dessous." /></Field>
                <Field label="Échéance (jours)"><Input name="dueDays" defaultValue={3} inputMode="numeric" className="w-24" /></Field>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {o.status === 'PIECES_COMPLEMENTAIRES' ? <Alert tone="warning">En attente des pièces complémentaires du client.</Alert> : null}
      {o.contract ? (
        <Card data-testid="contresignature">
          <CardHeader><CardTitle>Contrat {o.contract.ref} — signatures (F06)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {cer ? <ol>{cer.signers.map((s) => <li key={s.id}>{s.order}. {s.name} — {s.status === 'SIGNE' ? <Badge tone="success">signé</Badge> : s.status === 'A_SIGNER' ? <Badge tone="primary">à signer</Badge> : <Badge>en attente</Badge>}</li>)}</ol> : <p>Cérémonie non ouverte (le client doit lancer la signature).</p>}
            {o.status === 'CONTRESIGNATURE' && bankSigner?.status === 'A_SIGNER' ? (bankSigner.userId === actor.userId ? <Link href={`/signer/${bankSigner.token}`} className={buttonVariants() + ' w-fit'} data-testid="contresigner">Contre-signer le contrat</Link> : <p>Contre-signature attendue de {bankSigner.name}.</p>) : null}
            <ul className="text-xs">{Object.values(Object.fromEntries(o.contract.documents.map((d) => [d.kind, d]))).map((d) => <li key={d.id}>· <a href={`/api/files/${d.signedFileId ?? d.fileId}`} target="_blank">{d.title}</a></li>)}</ul>
          </CardContent>
        </Card>
      ) : null}
      {(o.contract && ['CONDITIONS_SUSPENSIVES', 'PRET_POUR_ACHAT'].includes(o.status)) || (decision?.conditions.some((c) => c.status !== 'LEVEE') && ['ACCORDE_SOUS_CONDITIONS', 'OFFRE_EMISE', 'SIGNATURE_CLIENT', 'CONTRESIGNATURE'].includes(o.status)) ? (
        <Card data-testid="f07">
          <CardHeader><CardTitle>Conditions suspensives (F07)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {conds.map((c) => <p key={c.key}>{c.ok ? <Badge tone="success">Levée</Badge> : <Badge tone="warning">À lever</Badge>} {c.label}</p>)}
            {o.contract && o.contract.signedAt && !o.contract.depositReceivedAt ? <ActionForm action={confirmDepositAction} hidden={{ contractId: o.contract.id }} submit="Confirmer le dépôt reçu" size="sm" confirm={`Confirmer la réception de ${fcfa(o.contract.depositTtc)} (réf. ${o.contract.depositReference}) sur le compte désigné ?`} testId="confirmer-depot" /> : null}
            {o.contract && o.contract.mandate?.status === 'SIGNE' ? <ActionForm action={activateMandateAction} hidden={{ contractId: o.contract.id }} submit="Activer le mandat de prélèvement" size="sm" testId="activer-mandat" /> : null}
            {decision?.conditions.filter((c) => c.status !== 'LEVEE').map((c) => <ActionForm key={c.id} action={liftConditionAction} hidden={{ conditionId: c.id }} submit={`Lever : ${c.label}`} size="sm" variant="secondary" confirm="Lever cette condition ?" />)}
          </CardContent>
        </Card>
      ) : null}
      <DossierView orderId={o.id} />
    </div>
  );
}

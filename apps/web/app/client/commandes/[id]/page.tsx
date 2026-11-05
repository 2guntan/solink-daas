import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { CONDITION_LABEL, assertOrderAccess, date, dateTime, fcfa, svc } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, KV, PageHeader, Textarea, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { nextActionFor } from '@/lib/next-action';
import { NextActionBanner } from '@/components/next-action';
import { ActionForm } from '@/components/action-form';
import { OrderStatusBadge, Timeline } from '@/components/status';
import { acceptConditionsAction, acceptQuoteAction, approvalAction, cancelOrderAction, messageAction, refreshQuoteAction, requestFinancingAction, reviseQuoteAction } from '../../actions';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor('client');
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      financer: true,
      apporteur: true,
      transitions: { orderBy: { at: 'asc' } },
      quotes: { orderBy: { version: 'desc' }, include: { lines: true } },
      creditFile: { include: { documents: true, decisions: { orderBy: { at: 'desc' }, include: { conditions: true } } } },
      messages: { orderBy: { at: 'asc' } },
      contract: true,
    },
  });
  if (!o) notFound();
  assertOrderAccess(actor, o);
  const next = await nextActionFor(o.id, actor);
  const q = o.quotes[0];
  const today = await (await import('@solink/core')).now(prisma);
  const expired = q ? q.validUntil < today : false;
  const decision = o.creditFile?.decisions[0];
  const requests = o.creditFile?.documents.filter((d) => d.origin === 'DEMANDE_BANQUE') ?? [];
  const authors = await prisma.user.findMany({ where: { id: { in: o.messages.map((m) => m.authorId) } } });
  const cancellable = ['DEVIS_EMIS', 'DEVIS_ACCEPTE', 'DOSSIER_EN_COURS', 'DOSSIER_A_REPRENDRE', 'APPROBATION_INTERNE'].includes(o.status);
  void svc;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Commande ${o.ref}`} description={<span className="flex flex-wrap items-center gap-2"><OrderStatusBadge status={o.status} /> Bailleur : {o.financer.name}{o.apporteur ? ` · apportée par ${o.apporteur.name}` : ''}</span>} />
      <NextActionBanner a={next} />
      <Card><CardContent className="pt-4"><Timeline status={o.status} transitions={o.transitions} /></CardContent></Card>

      {q ? (
        <Card data-testid="devis">
          <CardHeader>
            <CardTitle>Devis {q.ref}-v{q.version}</CardTitle>
            <p className="text-sm text-slate-500">Émis le {date(q.issuedAt)} · valable jusqu’au {date(q.validUntil)} {expired ? <Badge tone="danger">Expiré</Badge> : <Badge tone="success">Prix garantis</Badge>} · statut {q.status.toLowerCase().replace('_', ' ')}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th className="p-2">Désignation</th><th className="p-2">Site</th><th className="p-2">Qté</th><th className="p-2 text-right">TTC / mois</th></tr></thead>
                <tbody>{q.lines.map((l) => <tr key={l.id} className="border-t"><td className="p-2">{l.label}</td><td className="p-2">{l.siteName}</td><td className="p-2">{l.quantity}</td><td className="p-2 text-right">{fcfa(l.lineMonthlyTtc)}</td></tr>)}</tbody>
              </table>
            </div>
            <KV rows={[['Mensualité TTC', <strong key="m">{fcfa(q.monthlyTtc)}</strong>], ['Durée', `${q.durationMonths} mois`], ['Dépôt de garantie', fcfa(o.depositTtc)], ['Total du contrat', fcfa(q.totalContractTtc)]]} />
            <div className="flex flex-wrap gap-2">
              {q.pdfFileId ? <a href={`/api/files/${q.pdfFileId}`} target="_blank" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Télécharger le PDF</a> : null}
              <a href={`https://wa.me/?text=${encodeURIComponent(`Devis SOLINK ${q.ref}-v${q.version} : ${fcfa(q.monthlyTtc)} TTC/mois`)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Partager (WhatsApp)</a>
              {o.status === 'DEVIS_EMIS' && !expired ? <ActionForm action={acceptQuoteAction} hidden={{ orderId: o.id }} submit="Accepter le devis" testId="accepter-devis" inline /> : null}
              {o.status === 'DEVIS_EMIS' && expired ? <ActionForm action={refreshQuoteAction} hidden={{ orderId: o.id }} submit="Réactualiser le devis" inline /> : null}
              {o.status === 'DEVIS_EMIS' ? <ActionForm action={reviseQuoteAction} hidden={{ orderId: o.id }} submit="Modifier (nouvelle version)" variant="outline" inline /> : null}
            </div>
            {o.status === 'APPROBATION_INTERNE' && actor.roles.includes('CLIENT_APPROBATEUR') ? (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={approvalAction} hidden={{ orderId: o.id, decision: 'oui' }} submit="Approuver" confirm="Approuver ce devis ?" reason="Commentaire" variant="success" inline />
                <ActionForm action={approvalAction} hidden={{ orderId: o.id, decision: 'non' }} submit="Refuser" confirm="Refuser ce devis ?" reason="Motif du refus" variant="destructive" inline />
              </div>
            ) : null}
            {q.approvalComment ? <p className="text-sm text-slate-600">Commentaire de l’approbateur : {q.approvalComment}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {o.status === 'DEVIS_ACCEPTE' ? (
        <Card data-testid="recap-commande">
          <CardHeader><CardTitle>Récapitulatif et demande de financement</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Documents qui seront à signer : contrat de location financière et conditions générales, annexes 1 à 6 (équipements, échéancier, services, MDM, restitution, assurance), mandat de facturation Orange, mandat de prélèvement.</p>
            <ol className="list-decimal pl-5 text-slate-600"><li>Dossier de financement en ligne</li><li>Décision de {o.financer.name}</li><li>Signature électronique</li><li>Livraison et PV</li><li>Contrat actif — facture Orange unique</li></ol>
            <ActionForm action={requestFinancingAction} hidden={{ orderId: o.id }} submit="Demander le financement" testId="demander-financement">
              <label className="flex items-start gap-2"><input type="checkbox" name="cgu" required className="mt-1 h-5 w-5" /> J’accepte les conditions générales d’utilisation de la plateforme.</label>
              <label className="flex items-start gap-2"><input type="checkbox" name="donnees" required className="mt-1 h-5 w-5" /> J’autorise le traitement de mes données pour l’étude de financement et leur transmission à {o.financer.name} et, s’il y a lieu, au refinanceur Fonds Refi Démo.</label>
              <label className="flex items-start gap-2"><input type="checkbox" name="bic" required className="mt-1 h-5 w-5" /> J’autorise {o.financer.name} à consulter le Bureau d’Information sur le Crédit (BIC).</label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {o.creditFile ? (
        <Card>
          <CardHeader><CardTitle>Dossier de financement</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>Version scellée : v{o.creditFile.version} {o.creditFile.submittedAt ? `· soumise le ${dateTime(o.creditFile.submittedAt)}` : ''}</p>
            <Link href={`/client/commandes/${o.id}/dossier`} className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' w-fit'}>Ouvrir le dossier</Link>
            {requests.length ? (
              <div className="mt-2">
                <p className="font-medium">Demandes de la banque</p>
                <ul>{requests.map((r) => <li key={r.id}>· La banque demande : {r.label} — avant le {date(r.dueDate)} — {r.status === 'A_FOURNIR' ? <Link href={`/client/commandes/${o.id}/dossier#piece-${r.id}`}>répondre</Link> : <Badge tone="success">fourni</Badge>}</li>)}</ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {decision ? (
        <Card data-testid="decision">
          <CardHeader><CardTitle>Décision de financement</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p><Badge tone={decision.result === 'REFUSE' ? 'danger' : decision.result === 'ACCORDE' ? 'success' : 'warning'}>{decision.result === 'ACCORDE' ? 'Accordé' : decision.result === 'ACCORDE_SOUS_CONDITIONS' ? 'Accordé sous conditions' : decision.result === 'REFUSE' ? 'Non accordé' : decision.result}</Badge> le {date(decision.at)}{decision.validUntil ? ` · valable jusqu’au ${date(decision.validUntil)}` : ''}</p>
            {decision.result === 'REFUSE' ? <p>Le financement n’a pas pu être accordé. Votre chargé de dossier SOLINK reste à votre disposition.</p> : null}
            {decision.conditions.length ? <ul>{decision.conditions.map((c) => <li key={c.id}>· {CONDITION_LABEL[c.type]} — {c.label} ({c.nature === 'PREALABLE' ? 'avant signature' : 'avant achat'}) {c.status === 'LEVEE' ? <Badge tone="success">levée</Badge> : null}</li>)}</ul> : null}
            {o.status === 'ACCORDE_SOUS_CONDITIONS' ? <ActionForm action={acceptConditionsAction} hidden={{ orderId: o.id }} submit="Accepter la nouvelle offre" confirm="Accepter l’offre avec ces conditions ?" testId="accepter-conditions" /> : null}
            {o.contract ? <Link href={`/client/commandes/${o.id}/signature`} className={buttonVariants({ size: 'sm' }) + ' w-fit'}>Contrat et signature</Link> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Messagerie avec votre chargé de dossier SOLINK</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {o.messages.length === 0 ? <p className="text-sm text-slate-500">Aucun message.</p> : null}
          {o.messages.map((m) => <div key={m.id} className={`rounded p-2 text-sm ${m.authorOrg === 'CLIENT' ? 'bg-primary/5' : 'bg-slate-100'}`}><span className="text-xs text-slate-500">{authors.find((a) => a.id === m.authorId)?.firstName} · {dateTime(m.at)}</span><p>{m.body}</p></div>)}
          <ActionForm action={messageAction} hidden={{ orderId: o.id }} submit="Envoyer" size="sm"><Textarea name="body" required aria-label="Message" placeholder="Votre message…" /></ActionForm>
        </CardContent>
      </Card>
      {cancellable ? <ActionForm action={cancelOrderAction} hidden={{ orderId: o.id }} submit="Annuler la commande" variant="outline" confirm="Annuler définitivement cette commande ?" reason="Motif d’annulation" /> : null}
      {o.status === 'REFUSE' ? <Alert tone="danger">Financement non accordé.</Alert> : null}
    </div>
  );
}

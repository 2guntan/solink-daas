import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { fcfa } from '@solink/core';
import { Alert, Card, CardContent, CardHeader, CardTitle, KV, PageHeader, Textarea } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { DossierView } from '@/components/dossier-view';
import { OrderStatusBadge, Timeline } from '@/components/status';
import { completePrecontrolAction, messageAction, reviewDocAction, validateAllAction } from '../../actions';

/** B02 — pré-contrôle : validation pièce par pièce, demandes de reprise. Aucun avis de crédit. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor('solink');
  const o = await prisma.order.findUnique({ where: { id }, include: { organisation: true, apporteur: true, transitions: { orderBy: { at: 'asc' } }, messages: { orderBy: { at: 'asc' } }, lines: { include: { product: true, site: true } } } });
  if (!o) notFound();
  const pre = o.status === 'PRE_CONTROLE';
  const canReview = actor.roles.some((r) => ['SOLINK_CHARGE_DOSSIER', 'SOLINK_ADMIN'].includes(r));
  return (
    <div className="flex flex-col gap-4">
      <Link href="/solink" className="text-sm">← Pipeline</Link>
      <PageHeader title={`${o.ref} — ${o.organisation.name}`} description={<span className="flex flex-wrap items-center gap-2"><OrderStatusBadge status={o.status} internal /> {o.apporteur ? `apporteur ${o.apporteur.name}` : 'self-service'}</span>} />
      <Card><CardContent className="pt-4"><Timeline status={o.status} transitions={o.transitions} /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Commande</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <KV rows={[['Mensualité TTC', fcfa(o.monthlyTtc)], ['Montant financé', fcfa(o.financedAmount)], ['Durée', `${o.durationMonths} mois`], ['Dépôt', fcfa(o.depositTtc)]]} />
          <ul className="text-sm">{o.lines.map((l) => <li key={l.id}>· {l.quantity} × {l.product.name} — {l.site?.name}</li>)}</ul>
        </CardContent>
      </Card>
      {pre && canReview ? (
        <Card className="border-primary" data-testid="precontrole">
          <CardHeader><CardTitle>Pré-contrôle SOLINK (complétude uniquement)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ActionForm action={validateAllAction} hidden={{ orderId: o.id }} submit="Valider toutes les pièces en vérification" variant="secondary" testId="valider-tout" />
            <ActionForm action={completePrecontrolAction} hidden={{ orderId: o.id }} submit="Terminer le pré-contrôle" testId="terminer-precontrole" />
          </CardContent>
        </Card>
      ) : null}
      {!o.organisation.segment ? <Alert tone="warning">Segment non renseigné.</Alert> : null}
      <DossierView
        orderId={o.id}
        renderDocActions={(d) =>
          canReview && ['EN_VERIFICATION', 'NON_APPLICABLE'].includes(d.status) && ['PRE_CONTROLE', 'EN_ANALYSE', 'PIECES_COMPLEMENTAIRES'].includes(o.status) ? (
            <div className="flex flex-col gap-1 sm:flex-row">
              <ActionForm action={reviewDocAction} hidden={{ documentId: d.id, decision: 'VALIDEE' }} submit="Valider" size="sm" variant="success" inline />
              <ActionForm action={reviewDocAction} hidden={{ documentId: d.id, decision: 'A_REPRENDRE' }} submit="À reprendre" size="sm" variant="outline" confirm="Demander la reprise de cette pièce ?" reason="Motif (envoyé au client)" inline testId="a-reprendre" />
            </div>
          ) : null
        }
      />
      <Card>
        <CardHeader><CardTitle>Messagerie client</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {o.messages.map((m) => <p key={m.id} className="rounded bg-slate-50 p-2 text-sm">{m.authorOrg === 'CLIENT' ? 'Client' : 'SOLINK'} : {m.body}</p>)}
          <ActionForm action={messageAction} hidden={{ orderId: o.id }} submit="Envoyer" size="sm"><Textarea name="body" required aria-label="Message" /></ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

import { prisma } from '@solink/db';
import { date, fcfa } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { paidDisbAction, rejectDisbAction, validateDisbAction } from '../actions';

export const metadata = { title: 'Décaissements' };

/** F08 — demandes avec pièces ; validation / rejet / confirmation de paiement (virement émis par la banque). */
export default async function Page() {
  const actor = await requireActor('banque');
  const rows = await prisma.disbursement.findMany({ where: { contract: { financerId: actor.orgId } }, include: { contract: { include: { order: { include: { organisation: true } } } } }, orderBy: { requestedAt: 'desc' } });
  const treasury = actor.roles.includes('BANQUE_TRESORERIE');
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Décaissements (F08)" />
      {rows.length === 0 ? <EmptyState title="Aucune demande" /> : null}
      {rows.map((d) => {
        const p = d.pieces as { facture?: string; pv?: { site: string; fileId?: string; photos?: string[] }[]; series?: string[]; contrat?: string; dfs?: string };
        return (
          <Card key={d.id} data-testid={`decaissement-${d.ref}`}>
            <CardHeader><CardTitle>{d.ref} — {d.contract.order.organisation.name} — {fcfa(d.amount)} <Badge tone={d.status === 'PAYEE' ? 'success' : d.status === 'REJETEE' ? 'danger' : 'warning'}>{d.status}</Badge></CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>Demandée le {date(d.requestedAt)} · contrat {p.contrat} · DFS {p.dfs}</p>
              <p>Pièces : {d.invoiceFileId ? <a href={`/api/files/${d.invoiceFileId}`} target="_blank">facture SOLINK</a> : null} · PV : {p.pv?.map((x) => (x.fileId ? <a key={x.site} href={`/api/files/${x.fileId}`} target="_blank" className="mr-1">{x.site}</a> : x.site))} · {p.series?.length} séries · {p.pv?.reduce((a, x) => a + (x.photos?.length ?? 0), 0)} photos · annexe 1 mise à jour</p>
              {d.rejectReason ? <p className="text-red-700">Motif de rejet : {d.rejectReason}</p> : null}
              {treasury && d.status === 'DEMANDEE' ? <div className="flex flex-wrap gap-2"><ActionForm action={validateDisbAction} hidden={{ id: d.id }} submit="Valider" size="sm" inline testId="valider-decaissement" /><ActionForm action={rejectDisbAction} hidden={{ id: d.id }} submit="Rejeter" size="sm" variant="destructive" confirm="Rejeter cette demande ?" reason="Motif du rejet" inline /></div> : null}
              {treasury && d.status === 'VALIDEE' ? (
                <ActionForm action={paidDisbAction} hidden={{ id: d.id }} submit="Confirmer le paiement (virement effectué)" size="sm" confirm="Confirmer que le virement à SOLINK a été émis par la banque ?" testId="confirmer-paiement">
                  <Input name="ref" placeholder="Référence du virement" defaultValue={`VIR-${d.ref}`} aria-label="Référence du virement" className="max-w-xs" />
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

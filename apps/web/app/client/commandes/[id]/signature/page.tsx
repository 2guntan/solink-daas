import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { CONDITION_LABEL, assertOrderAccess, dateTime, fcfa, svc, run } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, KV, PageHeader, Select, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { startCeremonyAction } from '../../../actions';

export const metadata = { title: 'Signature' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor('client');
  const o = await prisma.order.findUnique({ where: { id }, include: { financer: true, contract: { include: { documents: { orderBy: { createdAt: 'asc' } }, ceremonies: { include: { signers: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 1 }, mandate: true, installments: { orderBy: { number: 'asc' }, take: 3 } } }, creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } } } });
  if (!o) notFound();
  assertOrderAccess(actor, o);
  const c = o.contract;
  if (!c) return <div><PageHeader title="Signature" /><Alert>Le contrat sera disponible après l’accord de la banque.</Alert></div>;
  const cer = c.ceremonies[0];
  const docs = Object.values(Object.fromEntries(c.documents.map((d) => [d.kind, d])));
  const conds = await run(actor, (ctx) => svc.suspensiveStatus(ctx, o.id));
  const mySigner = cer?.signers.find((s) => s.userId === actor.userId && s.status === 'A_SIGNER');
  const prealables = o.creditFile?.decisions[0]?.conditions.filter((x) => x.nature === 'PREALABLE') ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/client/commandes/${o.id}`} className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-neutral-500 no-underline hover:text-neutral-900 hover:no-underline">← Commande {o.ref}</Link>
      <PageHeader title={`Offre de financement et signature — ${c.ref}`} />
      <Card>
        <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
        <CardContent><KV rows={[['Bailleur', o.financer.name], ['Durée', `${c.durationMonths} mois`], ['Mensualité TTC', fcfa(c.monthlyTtc)], ['Échéancier', 'Émission le 1er, échéance le 15 ; départ au 1er du mois suivant le dernier PV'], ['Dépôt de garantie', `${fcfa(c.depositTtc)} — compte désigné par la banque, réf. ${c.depositReference}`], ['Assurance', 'Incluse (adhésion annexe 6)'], ['Conditions', o.creditFile?.decisions[0]?.conditions.map((x) => `${CONDITION_LABEL[x.type]} (${x.label})`).join(', ') || 'Aucune']]} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Documents ({docs.length})</CardTitle></CardHeader>
        <CardContent><ul className="text-sm">{docs.map((d) => <li key={d.id}>· <a href={`/api/files/${d.signedFileId ?? d.fileId}`} target="_blank">{d.title}</a> {d.signedFileId ? <Badge tone="success">signé</Badge> : null}</li>)}</ul></CardContent>
      </Card>
      {cer ? (
        <Card>
          <CardHeader><CardTitle>Ordre de signature</CardTitle></CardHeader>
          <CardContent>
            <ol className="text-sm">{cer.signers.map((s) => <li key={s.id}>{s.order}. {s.userId === actor.userId ? 'Vous' : s.name} — {s.status === 'SIGNE' ? <Badge tone="success">signé {dateTime(s.signedAt)}</Badge> : s.status === 'A_SIGNER' ? <Badge tone="primary">à signer</Badge> : <Badge>en attente</Badge>}</li>)}</ol>
            {mySigner ? <Link href={`/signer/${mySigner.token}`} className={buttonVariants() + ' mt-3'} data-testid="aller-signer">Signer maintenant</Link> : null}
          </CardContent>
        </Card>
      ) : null}
      {o.status === 'OFFRE_EMISE' && actor.roles.includes('CLIENT_SIGNATAIRE') ? (
        <Card className="border-primary">
          <CardHeader><CardTitle>Lancer la signature</CardTitle></CardHeader>
          <CardContent>
            {prealables.some((x) => x.status !== 'LEVEE') ? <Alert tone="warning">Conditions préalables à lever avant signature : {prealables.filter((x) => x.status !== 'LEVEE').map((x) => x.label).join(', ')}</Alert> : null}
            <ActionForm action={startCeremonyAction} hidden={{ orderId: o.id }} submit="Commencer la signature" testId="commencer-signature">
              <label className="text-sm">Moyen de prélèvement (mandat)
                <Select name="method" defaultValue="PRELEVEMENT_BANCAIRE"><option value="PRELEVEMENT_BANCAIRE">Prélèvement bancaire</option><option value="WAVE" disabled>Wave (phase 2)</option><option value="ORANGE_MONEY" disabled>Orange Money (phase 2)</option></Select>
              </label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
      <Card data-testid="conditions-suspensives">
        <CardHeader><CardTitle>Conditions avant achat</CardTitle></CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm">{conds.map((x) => <li key={x.key} className="flex flex-wrap items-center gap-2">{x.ok ? <Badge tone="success">Levée</Badge> : <Badge tone="warning">En attente</Badge>} {x.label} <span className="text-xs text-slate-500">· {x.owner}</span></li>)}</ul>
          {c.signedAt && !c.depositReceivedAt ? <Alert tone="info" title="Dépôt de garantie">Virez {fcfa(c.depositTtc)} sur le compte désigné par {o.financer.name} avec la référence <strong>{c.depositReference}</strong>. Jamais vers SOLINK.</Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}

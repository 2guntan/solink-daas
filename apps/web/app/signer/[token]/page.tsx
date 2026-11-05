import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@solink/db';
import { dateTime, fcfa } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, KV } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { sendSignOtpAction, signAction } from '../actions';

export const metadata = { title: 'Signature électronique' };

/** Page de signature du prestataire e-sign simulé : PDF, OTP, bouton « Signer ». */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await requireActor();
  const signer = await prisma.signer.findUnique({ where: { token }, include: { ceremony: { include: { signers: { orderBy: { order: 'asc' } }, contract: { include: { documents: { orderBy: { createdAt: 'asc' } }, order: { include: { organisation: true, financer: true } } } } } } } });
  if (!signer) notFound();
  const c = signer.ceremony.contract;
  const docs = Object.values(Object.fromEntries(c.documents.map((d) => [d.kind, d])));
  const mine = signer.userId === actor.userId;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-xs text-slate-500">Prestataire de signature (simulation) · enveloppe {signer.ceremony.providerRef}</p>
      <h1 className="mt-1 text-2xl font-bold">Signature du contrat {c.ref}</h1>
      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader><CardTitle>Offre de financement</CardTitle></CardHeader>
          <CardContent><KV rows={[['Locataire', c.order.organisation.name], ['Bailleur', c.order.financer.name], ['Durée', `${c.durationMonths} mois`], ['Mensualité TTC', fcfa(c.monthlyTtc)], ['Dépôt de garantie', fcfa(c.depositTtc)]]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ordre de signature</CardTitle></CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-1 text-sm" data-testid="ordre-signature">
              {signer.ceremony.signers.map((s) => <li key={s.id}>{s.order}. {s.name} {s.status === 'SIGNE' ? <Badge tone="success">Signé {s.signedAt ? dateTime(s.signedAt) : ''}</Badge> : s.status === 'A_SIGNER' ? <Badge tone="primary">À signer</Badge> : <Badge>En attente</Badge>}</li>)}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Documents à signer ({docs.length})</CardTitle></CardHeader>
          <CardContent><ul className="text-sm">{docs.map((d) => <li key={d.id}>· <a href={`/api/files/${d.signedFileId ?? d.fileId}`} target="_blank">{d.title}</a> <span className="font-mono text-xs text-slate-400">sha256 {d.sha256.slice(0, 12)}…</span></li>)}</ul></CardContent>
        </Card>
        {!mine ? <Alert tone="warning">Ce lien est nominatif ({signer.name}). Connectez-vous avec le compte du signataire.</Alert> : null}
        {mine && signer.status === 'SIGNE' ? <Alert tone="success">Vous avez signé le {dateTime(signer.signedAt)}.</Alert> : null}
        {mine && signer.status === 'EN_ATTENTE' ? <Alert tone="info">Ce n’est pas encore votre tour : les signataires précédents doivent signer.</Alert> : null}
        {mine && signer.status === 'A_SIGNER' ? (
          <Card className="border-primary">
            <CardHeader><CardTitle>Signer par code OTP</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ActionForm action={sendSignOtpAction} hidden={{ token }} submit="Recevoir mon code par SMS" variant="outline" size="sm" />
              <ActionForm action={signAction} hidden={{ token }} submit="Signer" testId="signer">
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="lu" className="mt-1 h-5 w-5" required /> J’ai pris connaissance de l’ensemble des documents et je les signe électroniquement.</label>
                <Field label="Code OTP (démo : 000000)"><Input name="otp" inputMode="numeric" maxLength={6} required aria-label="Code OTP" /></Field>
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
        <Link href={actor.orgType === 'FINANCEUR' ? `/banque/dossiers/${c.orderId}` : `/client/commandes/${c.orderId}/signature`} className="text-sm">← Retour</Link>
      </div>
    </main>
  );
}

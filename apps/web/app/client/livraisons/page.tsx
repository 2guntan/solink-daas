import { prisma } from '@solink/db';
import { date, dateTime } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Input, PageHeader, Textarea } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { scheduleDeliveryAction, sendPvOtpAction, signPvAction } from '../actions';

export const metadata = { title: 'Livraisons' };
const LABEL: Record<string, string> = { A_PLANIFIER: 'À planifier', PLANIFIEE: 'Planifiée', PREPAREE: 'Préparée', EXPEDIEE: 'En route', LIVREE: 'Livrée' };

/** E23 — créneaux par site, suivi, PV numérique signé par OTP. */
export default async function Page() {
  const actor = await requireActor('client');
  const deliveries = await prisma.delivery.findMany({ where: { order: { organisationId: actor.orgId } }, include: { site: true, pv: true, order: true }, orderBy: [{ order: { ref: 'desc' } }, { site: { name: 'asc' } }] });
  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Livraisons et PV" description="Choisissez vos créneaux par site puis signez le PV de livraison par code OTP." />
      {deliveries.length === 0 ? <EmptyState title="Aucune livraison" description="Les livraisons apparaissent dès la commande distributeur." /> : null}
      {deliveries.map((d) => (
        <Card key={d.id} data-testid={`livraison-${d.site.name}`}>
          <CardHeader>
            <CardTitle>{d.site.name} — {d.order.ref}</CardTitle>
            <p className="text-sm text-slate-500"><Badge>{LABEL[d.status]}</Badge> {d.slot ? `Créneau : ${date(d.slot)}` : ''} · {d.site.address}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {['A_PLANIFIER', 'PLANIFIEE'].includes(d.status) ? (
              <ActionForm action={scheduleDeliveryAction} hidden={{ deliveryId: d.id }} submit="Choisir ce créneau" size="sm" className="sm:flex-row sm:items-end">
                <Field label="Date de livraison"><Input type="date" name="slot" min={tomorrow} defaultValue={d.slot?.toISOString().slice(0, 10) ?? tomorrow} /></Field>
              </ActionForm>
            ) : null}
            {d.pv ? (
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">PV de livraison — {(d.pv.serials as unknown[]).length} équipement(s), {(d.pv.photos as unknown[]).length} photo(s)</p>
                <ul className="mt-1 max-h-32 overflow-auto font-mono text-xs">{(d.pv.serials as { serial: string; label: string }[]).map((s) => <li key={s.serial}>{s.serial} — {s.label}</li>)}</ul>
                {d.pv.status === 'SIGNE' ? (
                  <p className="mt-2"><Badge tone="success">PV signé</Badge> par {d.pv.signedName} le {dateTime(d.pv.signedAt)} {d.pv.fileId ? <a href={`/api/files/${d.pv.fileId}`} target="_blank">PDF</a> : null}</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <ActionForm action={sendPvOtpAction} hidden={{ deliveryId: d.id }} submit="Recevoir mon code" variant="outline" size="sm" />
                    <ActionForm action={signPvAction} hidden={{ deliveryId: d.id }} submit="Signer le PV" testId={`signer-pv-${d.site.name}`}>
                      <Field label="Réserves éventuelles"><Textarea name="reserves" placeholder="Casse, manquant… (laisser vide si aucune)" /></Field>
                      <label className="flex items-center gap-2"><input type="checkbox" name="blocking" /> Réserve bloquante (ouvre un ticket)</label>
                      <Field label="Code OTP (démo : 000000)"><Input name="otp" required inputMode="numeric" maxLength={6} aria-label="Code OTP PV" /></Field>
                    </ActionForm>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

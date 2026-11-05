import Link from 'next/link';
import { prisma } from '@solink/db';
import { fcfa, getParams, svc, RANGE_LABEL } from '@solink/core';
import { Alert, Card, CardContent, CardHeader, CardTitle, DemoBadge, EmptyState, Input, KV, PageHeader, Select, buttonVariants } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { callbackAction, issueQuoteAction, removeLineAction, setDurationAction, updateLineAction } from '../actions';

export const metadata = { title: 'Panier' };

export default async function Page() {
  const actor = await requireActor('client');
  const cart = await prisma.order.findFirst({ where: { organisationId: actor.orgId, status: 'PANIER' }, orderBy: { createdAt: 'desc' }, include: { apporteur: true } });
  const sites = await prisma.site.findMany({ where: { organisationId: actor.orgId } });
  if (!cart) return <div><PageHeader title="Panier" /><EmptyState title="Votre panier est vide" action={<Link href="/client/catalogue" className={buttonVariants()}>Voir le catalogue</Link>} /></div>;
  const params = await getParams(prisma);
  const { lines, totals, order } = await svc.priceOrderLines(prisma, cart.id, params);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Panier ${order.ref}`} description="Sauvegarde automatique. Un panier peut couvrir plusieurs sites." />
      {cart.apporteur ? <Alert tone="info">Panier apporté par {cart.apporteur.name} — code apporteur <strong>{cart.apporteur.code}</strong></Alert> : null}
      {lines.length === 0 ? <EmptyState title="Votre panier est vide" action={<Link href="/client/catalogue" className={buttonVariants()}>Voir le catalogue</Link>} /> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {lines.map((l) => (
            <Card key={l.input.line.id} className="p-4" data-testid="ligne-panier">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{l.input.line.product.name}</p>
                  <p className="text-xs text-slate-500">{RANGE_LABEL[l.input.range]}{l.input.line.packName ? ` · pack ${l.input.line.packName}` : ''}</p>
                </div>
                <p className="text-right text-sm"><strong>{fcfa(l.lineMonthlyTtc)}</strong> / mois<br /><span className="text-xs text-slate-500">{fcfa(l.unit.monthlyTtc)} / poste</span></p>
              </div>
              <ActionForm action={updateLineAction} hidden={{ lineId: l.input.line.id }} submit="Mettre à jour" variant="secondary" size="sm" className="mt-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="text-xs">Quantité<Input name="quantity" type="number" min={0} defaultValue={l.input.quantity} className="w-24" /></label>
                <label className="text-xs">Site<Select name="siteId" defaultValue={l.input.line.siteId ?? ''} className="w-48"><option value="">— choisir —</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
                {l.input.category === 'THIN_CLIENT' ? <label className="text-xs">VDI<Select name="vdiTier" defaultValue={l.input.vdiTier} className="w-36"><option value="STANDARD">Standard</option><option value="PERFORMANCE">Performance</option></Select></label> : null}
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="insurance" defaultChecked={l.input.insurance} /> Assurance</label>
              </ActionForm>
              <ActionForm action={removeLineAction} hidden={{ lineId: l.input.line.id }} submit="Retirer" variant="link" size="sm" />
            </Card>
          ))}
        </div>
        <Card className="h-fit lg:sticky lg:top-12">
          <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ActionForm action={setDurationAction} hidden={{ orderId: cart.id }} submit="Changer la durée" variant="outline" size="sm" className="sm:flex-row sm:items-end">
              <Select name="duration" defaultValue={String(order.durationMonths)} aria-label="Durée">{params.durees_autorisees.map((d) => <option key={d} value={d}>{d} mois</option>)}</Select>
            </ActionForm>
            <KV rows={[['Postes', totals.seats], ['Mensualité TTC totale', <strong key="m" data-testid="panier-mensualite">{fcfa(totals.monthlyTtc)}</strong>], ['Dépôt de garantie estimé', fcfa(totals.depositTtc)], ['Premier loyer estimé', fcfa(totals.firstRentTtc)], ['Total du contrat', fcfa(totals.totalContractTtc)]]} />
            <DemoBadge />
            <ActionForm action={issueQuoteAction} hidden={{ orderId: cart.id }} submit="Émettre le devis" disabled={!lines.length} testId="emettre-devis" />
            <ActionForm action={callbackAction} hidden={{ ref: cart.ref }} submit="Demander un rappel" variant="outline" size="sm" />
            <p className="text-xs text-slate-500">Partager le panier : <code className="break-all">/client/panier</code> (accessible aux membres de votre organisation)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

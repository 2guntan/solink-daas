import Link from 'next/link';
import { prisma } from '@solink/db';
import { fcfa } from '@solink/core';
import { Alert, Card, CardContent, CardHeader, CardTitle, Field, Input, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { coNavAddAction } from '../actions';

export const metadata = { title: 'Co-navigation' };

/** B03 — parcours assisté : le commercial construit le panier POUR le client ; le client valide, remplit et signe lui-même. */
export default async function Page({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireActor('solink');
  const sp = await searchParams;
  const clients = await prisma.organisation.findMany({ where: { type: 'CLIENT' }, orderBy: { name: 'asc' } });
  const client = clients.find((c) => c.id === sp.client) ?? clients[0];
  const [sites, products, cart] = await Promise.all([
    prisma.site.findMany({ where: { organisationId: client.id } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.order.findFirst({ where: { organisationId: client.id, status: 'PANIER' }, include: { lines: { include: { product: true, site: true } } } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Co-navigation (parcours assisté)" />
      <Alert tone="info">Le client reprend la main pour valider le devis, remplir le dossier et signer : il ne peut jamais être signé « pour » lui.</Alert>
      <form className="flex gap-2" action="/solink/conavigation"><Select name="client" defaultValue={client.id} aria-label="Client">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select><button className="rounded bg-slate-100 px-3 text-sm">Choisir</button></form>
      <Card>
        <CardHeader><CardTitle>Ajouter au panier de {client.name}</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={coNavAddAction} hidden={{ clientId: client.id }} submit="Ajouter au panier du client">
            <div className="grid gap-2 sm:grid-cols-4">
              <Field label="Produit"><Select name="productId">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Quantité"><Input name="quantity" type="number" min={1} defaultValue={1} /></Field>
              <Field label="Site"><Select name="siteId">{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="VDI (thin client)"><Select name="vdiTier"><option value="STANDARD">Standard</option><option value="PERFORMANCE">Performance</option></Select></Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Panier actuel du client</CardTitle></CardHeader>
        <CardContent>{cart ? <><ul className="text-sm">{cart.lines.map((l) => <li key={l.id}>· {l.quantity} × {l.product.name} — {l.site?.name}</li>)}</ul><p className="mt-2 text-sm">Mensualité : {fcfa(cart.monthlyTtc)} — <Link href={`/solink/commandes/${cart.id}`}>{cart.ref}</Link></p></> : <p className="text-sm text-slate-500">Aucun panier en cours.</p>}</CardContent>
      </Card>
    </div>
  );
}

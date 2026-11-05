import { prisma } from '@solink/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Input, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { addPackAction, createPackAction, deletePackAction } from '../actions';

export const metadata = { title: 'Packs' };

export default async function Page() {
  const actor = await requireActor('client');
  const [packs, products, sites] = await Promise.all([
    prisma.pack.findMany({ where: { organisationId: actor.orgId }, orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.site.findMany({ where: { organisationId: actor.orgId } }),
  ]);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Packs par profil" description="Catalogue interne : composez des packs (ex. « Guichetier ») et commandez-les par quantité." />
      {packs.length === 0 ? <EmptyState title="Aucun pack" description="Créez votre premier pack ci-dessous." /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {packs.map((p) => (
          <Card key={p.id}>
            <CardHeader><CardTitle>{p.name}</CardTitle><p className="text-sm text-slate-500">{p.description}</p></CardHeader>
            <CardContent>
              <ul className="mb-3 text-sm">{(p.items as { productId: string; quantity: number }[]).map((i) => <li key={i.productId}>· {i.quantity} × {name(i.productId)}</li>)}{p.vdiTier !== 'AUCUN' ? <li>· VDI {p.vdiTier.toLowerCase()}</li> : null}</ul>
              <ActionForm action={addPackAction} hidden={{ packId: p.id }} submit="Ajouter au panier" className="sm:flex-row sm:items-end">
                <Field label="Quantité"><Input name="quantity" type="number" min={1} defaultValue={1} className="w-24" /></Field>
                <Field label="Site"><Select name="siteId">{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              </ActionForm>
              <ActionForm action={deletePackAction} hidden={{ packId: p.id }} submit="Supprimer le pack" variant="link" size="sm" className="mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Créer un pack</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createPackAction} submit="Créer le pack">
            <Field label="Nom du profil"><Input name="name" required placeholder="Ex. Guichetier" /></Field>
            <Field label="Description"><Input name="description" /></Field>
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Select key={i} name="productId" aria-label={`Produit ${i + 1}`}>
                  <option value="">— produit {i + 1} —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              ))}
            </div>
            <Field label="VDI Orange (thin clients)"><Select name="vdiTier"><option value="AUCUN">Aucune</option><option value="STANDARD">Standard</option><option value="PERFORMANCE">Performance</option></Select></Field>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

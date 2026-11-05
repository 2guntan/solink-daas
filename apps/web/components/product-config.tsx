import { notFound } from 'next/navigation';
import { prisma } from '@solink/db';
import { getParams } from '@solink/core';
import { Field, Select } from '@solink/ui';
import { Configurator } from './live-price';
import { ProductHeader } from './catalogue';
import { ActionForm } from './action-form';
import { addToCartAction } from '@/app/cart-actions';

/** E08 — fiche produit / configurateur. */
export async function ProductConfig({ sku, orgId }: { sku: string; orgId?: string }) {
  const p = await prisma.product.findUnique({ where: { sku } });
  if (!p) notFound();
  const params = await getParams(prisma);
  const accessories = await prisma.product.findMany({ where: { category: { in: ['ECRAN', 'DOCK', 'CASQUE', 'SACOCHE'] }, offers: { hasSome: p.offers } }, orderBy: { purchasePrice: 'asc' }, take: 6 });
  const sites = orgId ? await prisma.site.findMany({ where: { organisationId: orgId } }) : [];
  const financer = await prisma.organisation.findFirst({ where: { type: 'FINANCEUR' } });
  return (
    <div>
      <ProductHeader sku={sku} />
      <ActionForm action={addToCartAction} submit={orgId ? 'Ajouter au panier' : 'Enregistrer mon panier (connexion)'} hidden={{ sku }} testId="ajouter-panier">
        <Configurator sku={sku} isThin={p.category === 'THIN_CLIENT'} durations={params.durees_autorisees} accessories={['THIN_CLIENT', 'LAPTOP', 'MAC'].includes(p.category) ? accessories.map((a) => ({ sku: a.sku, name: a.name })) : []} financer={financer?.name ?? 'la banque'}>
          {sites.length ? (
            <Field label="Site de livraison">
              <Select name="siteId" defaultValue={sites[0].id} aria-label="Site de livraison">
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          ) : null}
        </Configurator>
      </ActionForm>
    </div>
  );
}

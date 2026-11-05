import { prisma } from '@solink/db';
import { CATEGORY_LABEL, RANGE_LABEL, fcfa, getParams, svc } from '@solink/core';
import { Badge, Input, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';
import { ActionForm } from '@/components/action-form';
import { updateProductAction } from '../actions';

export const metadata = { title: 'Catalogue & prix' };

/** B04 — prix d'achat et marges visibles côté SOLINK uniquement. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor('solink');
  const [products, params] = await Promise.all([prisma.product.findMany({ orderBy: [{ category: 'asc' }, { purchasePrice: 'asc' }] }), getParams(prisma)]);
  return (
    <div>
      <PageHeader title="Catalogue & prix" description={`${products.length} références · prix d’achat fictifs · paramètres ${params.__version}`} />
      <ListView rows={products} rowKey={(p) => p.id} basePath="/solink/catalogue" searchParams={await searchParams} search={(p) => `${p.sku} ${p.name} ${p.brand}`} pageSize={40}
        filters={[{ key: 'cat', label: 'Catégorie', options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })), match: (p, v) => p.category === v }, { key: 'gamme', label: 'Gamme', options: Object.entries(RANGE_LABEL).map(([value, label]) => ({ value, label })), match: (p, v) => p.range === v }]}
        columns={[
          { key: 'sku', label: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span>, sort: (p) => p.sku },
          { key: 'nom', label: 'Désignation', render: (p) => <>{p.name} {!p.active ? <Badge tone="danger">inactif</Badge> : null}</>, sort: (p) => p.name },
          { key: 'gamme', label: 'Gamme', render: (p) => RANGE_LABEL[p.range] },
          { key: 'achat', label: 'Prix d’achat HT', render: (p) => fcfa(p.purchasePrice), sort: (p) => p.purchasePrice },
          { key: 'base', label: 'Base financée', render: (p) => fcfa(svc.productMonthly(p, 36, params).base) },
          { key: 'mens', label: 'Mensualité TTC 36 m', render: (p) => fcfa(svc.productMonthly(p, 36, params, p.category === 'THIN_CLIENT' ? 'STANDARD' : 'AUCUN').monthlyTtc) },
          { key: 'edit', label: 'Modifier', render: (p) => <ActionForm action={updateProductAction} hidden={{ productId: p.id }} submit="OK" size="sm" variant="secondary" inline><div className="flex items-center gap-1"><Input name="purchasePrice" defaultValue={p.purchasePrice} className="h-8 w-28 text-xs" aria-label="Prix d’achat" /><label className="text-xs"><input type="checkbox" name="active" defaultChecked={p.active} /> actif</label></div></ActionForm> },
        ]} />
    </div>
  );
}

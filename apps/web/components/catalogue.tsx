import Link from 'next/link';
import { prisma } from '@solink/db';
import { getParams, fcfa, svc, RANGE_LABEL, CATEGORY_LABEL, OFFER_LABEL } from '@solink/core';
import { Badge, Card, Select, Button, EmptyState } from '@solink/ui';
import { ProductArt } from './product-art';
import type { Offer } from '@solink/db';

type SP = Record<string, string | undefined>;

/** E07 — catalogue filtrable ; seule la mensualité est affichée (jamais le prix d'achat ni la marge). */
export async function Catalogue({ basePath, sp }: { basePath: string; sp: SP }) {
  const params = await getParams(prisma);
  const duration = params.durees_autorisees.includes(Number(sp.duree)) ? Number(sp.duree) : Math.max(...params.durees_autorisees);
  const products = await svc.listProducts(prisma, {
    offer: (sp.offre as Offer) || undefined,
    range: sp.gamme || undefined,
    brand: sp.marque || undefined,
    category: sp.categorie || undefined,
    availability: sp.dispo || undefined,
    aiReady: sp.ai === '1',
    q: sp.q || undefined,
  });
  const brands = await prisma.product.findMany({ distinct: ['brand'], select: { brand: true }, orderBy: { brand: 'asc' } });
  return (
    <div className="flex flex-col gap-4">
      <form className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end" action={basePath}>
        <input name="q" defaultValue={sp.q} placeholder="Rechercher…" aria-label="Rechercher" className="col-span-2 h-10 rounded border border-slate-300 px-3 text-sm sm:w-48" />
        <Select name="offre" defaultValue={sp.offre} aria-label="Offre" className="sm:w-40"><option value="">Toutes offres</option>{Object.entries(OFFER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="gamme" defaultValue={sp.gamme} aria-label="Gamme" className="sm:w-36"><option value="">Toutes gammes</option>{Object.entries(RANGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="categorie" defaultValue={sp.categorie} aria-label="Catégorie" className="sm:w-44"><option value="">Toutes catégories</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="marque" defaultValue={sp.marque} aria-label="Marque" className="sm:w-36"><option value="">Toutes marques</option>{brands.map((b) => <option key={b.brand} value={b.brand}>{b.brand}</option>)}</Select>
        <Select name="dispo" defaultValue={sp.dispo} aria-label="Disponibilité" className="sm:w-44"><option value="">Toute disponibilité</option><option value="EN_STOCK">En stock Dakar</option><option value="SUR_COMMANDE">Sur commande</option></Select>
        <Select name="duree" defaultValue={String(duration)} aria-label="Durée" className="sm:w-28">{params.durees_autorisees.map((d) => <option key={d} value={d}>{d} mois</option>)}</Select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ai" value="1" defaultChecked={sp.ai === '1'} /> AI-ready</label>
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>
      {products.length === 0 ? <EmptyState title="Aucun produit ne correspond" description="Modifiez vos filtres." /> : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="catalogue">
        {products.map((p) => {
          const c = svc.productMonthly(p, duration, params, p.category === 'THIN_CLIENT' ? 'STANDARD' : 'AUCUN', ['THIN_CLIENT', 'LAPTOP', 'MAC'].includes(p.category));
          return (
            <li key={p.id}>
              <Card className="flex h-full flex-col p-4">
                <ProductArt category={p.category} />
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge tone="primary">{RANGE_LABEL[p.range]}</Badge>
                  <Badge>{CATEGORY_LABEL[p.category]}</Badge>
                  {p.aiReady ? <Badge tone="info">AI-ready</Badge> : null}
                  <Badge tone={p.availability === 'EN_STOCK' ? 'success' : 'warning'}>{p.availability === 'EN_STOCK' ? 'En stock Dakar' : `Sur commande · ${p.leadTimeDays} j`}</Badge>
                </div>
                <h3 className="mt-2 font-semibold">{p.name}</h3>
                <ul className="mt-1 text-xs text-slate-600">{(p.specs as string[]).slice(0, 4).map((s) => <li key={s}>· {s}</li>)}</ul>
                <div className="mt-auto pt-3">
                  <p className="text-lg font-bold text-primary">{fcfa(c.monthlyTtc)}<span className="text-xs font-normal text-slate-500"> TTC/mois · {duration} mois</span></p>
                  <p className="text-xs text-slate-500">Livraison : {p.availability === 'EN_STOCK' ? '5 jours' : `${p.leadTimeDays} jours`}</p>
                  <Link href={`${basePath}/${p.sku}`} className="mt-2 inline-block text-sm font-medium" data-testid={`produit-${p.sku}`}>Configurer →</Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function ProductHeader({ sku }: { sku: string }) {
  const p = await prisma.product.findUnique({ where: { sku } });
  if (!p) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <ProductArt category={p.category} className="h-24 w-32" />
      <div>
        <h1 className="text-xl font-bold">{p.name}</h1>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone="primary">{RANGE_LABEL[p.range]}</Badge>
          {p.offers.map((o) => <Badge key={o}>{OFFER_LABEL[o]}</Badge>)}
          <Badge>Clavier {p.keyboard}</Badge>
        </div>
        <ul className="mt-2 text-sm text-slate-600">{(p.specs as string[]).map((s) => <li key={s}>· {s}</li>)}</ul>
      </div>
    </div>
  );
}

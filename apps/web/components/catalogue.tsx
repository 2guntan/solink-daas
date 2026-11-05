import Link from 'next/link';
import { prisma } from '@solink/db';
import { getParams, fcfa, svc, RANGE_LABEL, CATEGORY_LABEL, OFFER_LABEL } from '@solink/core';
import { Badge, Select, Button, EmptyState, Input, cn } from '@solink/ui';
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
    <div className="flex flex-col gap-6">
      <form className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" action={basePath}>
        <Input name="q" defaultValue={sp.q} placeholder="Rechercher…" aria-label="Rechercher" className="col-span-2 sm:w-48" />
        <Select name="offre" defaultValue={sp.offre} aria-label="Offre" className="sm:w-40"><option value="">Toutes offres</option>{Object.entries(OFFER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="gamme" defaultValue={sp.gamme} aria-label="Gamme" className="sm:w-36"><option value="">Toutes gammes</option>{Object.entries(RANGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="categorie" defaultValue={sp.categorie} aria-label="Catégorie" className="sm:w-44"><option value="">Toutes catégories</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="marque" defaultValue={sp.marque} aria-label="Marque" className="sm:w-36"><option value="">Toutes marques</option>{brands.map((b) => <option key={b.brand} value={b.brand}>{b.brand}</option>)}</Select>
        <Select name="dispo" defaultValue={sp.dispo} aria-label="Disponibilité" className="sm:w-44"><option value="">Toute disponibilité</option><option value="EN_STOCK">En stock Dakar</option><option value="SUR_COMMANDE">Sur commande</option></Select>
        <Select name="duree" defaultValue={String(duration)} aria-label="Durée" className="sm:w-28">{params.durees_autorisees.map((d) => <option key={d} value={d}>{d} mois</option>)}</Select>
        <label className="flex h-10 items-center gap-2 px-1 text-sm text-neutral-700"><input type="checkbox" name="ai" value="1" defaultChecked={sp.ai === '1'} /> AI-ready</label>
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>
      {products.length === 0 ? <EmptyState title="Aucun produit ne correspond" description="Modifiez vos filtres." /> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="catalogue">
        {products.map((p) => {
          const c = svc.productMonthly(p, duration, params, p.category === 'THIN_CLIENT' ? 'STANDARD' : 'AUCUN', ['THIN_CLIENT', 'LAPTOP', 'MAC'].includes(p.category));
          const inStock = p.availability === 'EN_STOCK';
          return (
            <li key={p.id} className="group">
              <Link
                href={`${basePath}/${p.sku}`}
                data-testid={`produit-${p.sku}`}
                className={cn(
                  'flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white p-4 text-neutral-900 no-underline shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 ease-apple',
                  'hover:-translate-y-0.5 hover:border-neutral-300 hover:no-underline hover:shadow-pop',
                )}
              >
                <ProductArt category={p.category} tile className="h-36 w-full" />
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <Badge tone="primary">{RANGE_LABEL[p.range]}</Badge>
                  <Badge>{CATEGORY_LABEL[p.category]}</Badge>
                  {p.aiReady ? <Badge tone="info">AI-ready</Badge> : null}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight">{p.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{(p.specs as string[]).slice(0, 4).join(' · ')}</p>
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-neutral-100 pt-4">
                  <div>
                    <p className="text-xl font-semibold tabular-nums tracking-tight">{fcfa(c.monthlyTtc)}</p>
                    <p className="text-[11px] text-neutral-500">TTC / mois · {duration} mois</p>
                  </div>
                  <div className="text-right text-[11px] text-neutral-500">
                    <span className={cn('inline-flex items-center gap-1.5', inStock ? 'text-emerald-700' : 'text-amber-700')}>
                      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', inStock ? 'bg-emerald-500' : 'bg-amber-500')} />
                      {inStock ? 'En stock Dakar' : `Sur commande · ${p.leadTimeDays} j`}
                    </span>
                    <p className="mt-0.5">Livraison {inStock ? '5 jours' : `${p.leadTimeDays} jours`}</p>
                  </div>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 transition-transform duration-200 group-hover:translate-x-0.5">
                  Configurer <span aria-hidden>→</span>
                </span>
              </Link>
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
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
      <ProductArt category={p.category} tile className="h-36 w-full shrink-0 sm:w-48" />
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="primary">{RANGE_LABEL[p.range]}</Badge>
          {p.offers.map((o) => <Badge key={o}>{OFFER_LABEL[o]}</Badge>)}
          <Badge>Clavier {p.keyboard}</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
          {(p.specs as string[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-300" />
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

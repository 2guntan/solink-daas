import type { Offer, Product, Tx, VdiTier } from '@solink/db';
import { priceCart, unitComponents, type Category, type PricingParams } from '../pricing';

export interface CatalogFilters {
  offer?: Offer;
  range?: string;
  brand?: string;
  category?: string;
  availability?: string;
  aiReady?: boolean;
  q?: string;
}

export async function listProducts(db: Tx, f: CatalogFilters = {}) {
  return db.product.findMany({
    where: {
      active: true,
      ...(f.offer ? { offers: { has: f.offer } } : {}),
      ...(f.range ? { range: f.range as Product['range'] } : {}),
      ...(f.brand ? { brand: f.brand } : {}),
      ...(f.category ? { category: f.category as Product['category'] } : {}),
      ...(f.availability ? { availability: f.availability as Product['availability'] } : {}),
      ...(f.aiReady ? { aiReady: true } : {}),
      ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { brand: { contains: f.q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ category: 'asc' }, { purchasePrice: 'asc' }],
  });
}

export function productMonthly(p: Pick<Product, 'purchasePrice' | 'category' | 'range'>, duration: number, params: PricingParams, vdiTier: VdiTier = 'AUCUN', insurance = true) {
  return unitComponents({ purchasePrice: p.purchasePrice, category: p.category as Category, range: p.range, vdiTier, insurance }, duration, params);
}

/** « À partir de » par offre : poste le moins cher de l'offre (36 mois, VDI Standard pour Bureau cloud). */
export async function fromPrices(db: Tx, params: PricingParams) {
  const duration = Math.max(...params.durees_autorisees);
  const out: Record<string, number> = {};
  for (const offer of ['BUREAU_CLOUD', 'POSTE_MOBILE', 'HYBRIDE'] as Offer[]) {
    const products = await db.product.findMany({
      where: { active: true, offers: { has: offer }, category: { in: ['THIN_CLIENT', 'LAPTOP', 'MAC'] } },
      orderBy: { purchasePrice: 'asc' },
      take: 1,
    });
    const p = products[0];
    if (!p) continue;
    const vdi: VdiTier = p.category === 'THIN_CLIENT' ? 'STANDARD' : 'AUCUN';
    out[offer] = productMonthly(p, duration, params, vdi).monthlyTtc;
  }
  return out;
}

export async function priceOrderLines(db: Tx, orderId: string, params: PricingParams) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { include: { product: true, site: true }, orderBy: { id: 'asc' } } },
  });
  const inputs = order.lines.map((l) => ({
    purchasePrice: l.product.purchasePrice,
    category: l.product.category as Category,
    range: l.product.range,
    quantity: l.quantity,
    vdiTier: l.vdiTier,
    insurance: l.insurance,
    line: l,
  }));
  return { order, ...priceCart(inputs, order.durationMonths, params) };
}

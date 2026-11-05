import { prisma } from '@solink/db';
import { getParams, isDevice, unitComponents, type Category } from '@solink/core';

/** Calcul serveur de la mensualité (configurateur E08, < 300 ms). Ne renvoie jamais le prix d'achat ni la marge. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sku = u.searchParams.get('sku') ?? '';
  const duration = Number(u.searchParams.get('duree') ?? 36);
  const vdi = (u.searchParams.get('vdi') ?? 'AUCUN') as 'AUCUN' | 'STANDARD' | 'PERFORMANCE';
  const insurance = u.searchParams.get('assurance') !== '0';
  const qty = Math.max(1, Number(u.searchParams.get('qte') ?? 1));
  const acc = (u.searchParams.get('acc') ?? '').split(',').filter(Boolean);
  const p = await prisma.product.findUnique({ where: { sku } });
  if (!p) return Response.json({ error: { code: 'PRODUIT_INCONNU', message: 'Produit inconnu' } }, { status: 404 });
  const params = await getParams(prisma);
  try {
    const c = unitComponents({ purchasePrice: p.purchasePrice, category: p.category as Category, range: p.range, vdiTier: p.category === 'THIN_CLIENT' ? vdi : 'AUCUN', insurance }, duration, params);
    const accessories = await prisma.product.findMany({ where: { sku: { in: acc } } });
    const accC = accessories.map((a) => unitComponents({ purchasePrice: a.purchasePrice, category: a.category as Category, range: a.range, insurance: isDevice(a.category as Category) }, duration, params));
    const accTtc = accC.reduce((s, x) => s + x.monthlyTtc, 0);
    const perSeat = c.monthlyTtc + accTtc;
    return Response.json({
      perSeatTtc: perSeat,
      totalTtc: perSeat * qty,
      contractTtc: perSeat * qty * duration,
      detail: {
        loyerMaterielHt: c.rentHt + accC.reduce((s, x) => s + x.rentHt, 0),
        servicesSolinkHt: c.servicesSolinkHt,
        servicesOrangeHt: c.vdiHt,
        assuranceHt: c.insuranceHt + accC.reduce((s, x) => s + x.insuranceHt, 0),
        tva: c.monthlyTva + accC.reduce((s, x) => s + x.monthlyTva, 0),
      },
    });
  } catch (e) {
    return Response.json({ error: { code: 'CALCUL_IMPOSSIBLE', message: (e as Error).message } }, { status: 400 });
  }
}

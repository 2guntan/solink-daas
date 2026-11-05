'use server';

import { prisma } from '@solink/db';
import { svc } from '@solink/core';
import { act, int, str, type ActionResult } from '@/lib/action';
import { currentActor } from '@/lib/session';

/** Ajout au panier depuis le configurateur (le compte n'est demandé qu'à l'enregistrement du panier — E01). */
export async function addToCartAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const actor = await currentActor();
  const sku = str(f, 'sku');
  if (!actor || actor.orgType !== 'CLIENT') return { ok: true, redirect: `/connexion?next=${encodeURIComponent(`/client/catalogue/${sku}`)}` };
  return act('client', async (ctx) => {
    const p = await prisma.product.findUniqueOrThrow({ where: { sku } });
    const quantity = Math.max(1, int(f, 'quantity'));
    const siteId = str(f, 'siteId') || null;
    const duration = int(f, 'duration') || undefined;
    await svc.addToCart(ctx, { productId: p.id, quantity, siteId, vdiTier: (str(f, 'vdiTier') || 'AUCUN') as 'AUCUN', insurance: f.get('insurance') === 'on', duration });
    for (const accSku of f.getAll('acc').map(String)) {
      const a = await prisma.product.findUnique({ where: { sku: accSku } });
      if (a) await svc.addToCart(ctx, { productId: a.id, quantity, siteId, insurance: false });
    }
    return { ok: true, message: 'Ajouté au panier.', redirect: '/client/panier' };
  });
}

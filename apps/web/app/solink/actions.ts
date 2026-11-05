'use server';

import type { Grade, VdiTier } from '@solink/db';
import { svc, type ParamKey } from '@solink/core';
import { act, int, str, type ActionResult } from '@/lib/action';

type A = ActionResult | null;
const S = 'solink' as const;

export async function reviewDocAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const d = str(f, 'decision') as 'VALIDEE' | 'A_REPRENDRE';
    await svc.reviewDocument(ctx, str(f, 'documentId'), d, str(f, 'reason'));
    return { ok: true, message: d === 'VALIDEE' ? 'Pièce validée.' : 'Pièce à reprendre — client notifié.' };
  });
}
export async function validateAllAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    await svc.validateAllPending(ctx, str(f, 'orderId'));
    return { ok: true, message: 'Pièces en vérification validées.' };
  });
}
export async function completePrecontrolAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const r = await svc.completePrecontrol(ctx, str(f, 'orderId'));
    const msg: Record<string, string> = { A_REPRENDRE: 'Dossier renvoyé au client (pièces à reprendre).', ACCORD_AUTO: 'DFS transmis — accord automatique (règle du financeur) exécuté.', ANALYSTE: 'DFS transmis — instruction analyste.', REFUS_PROPOSE: 'DFS transmis — refus proposé (knock-out), à confirmer par la banque.' };
    return { ok: true, message: msg[r.result] ?? 'Pré-contrôle terminé.' };
  });
}
export async function messageAction(_: A, f: FormData) {
  return act(S, async (ctx) => svc.postMessage(ctx, str(f, 'orderId'), str(f, 'body')));
}
export async function coNavAddAction(_: A, f: FormData) {
  return act(S, async (ctx, actor) => {
    const clientId = str(f, 'clientId');
    const cctx = { ...ctx, actor: { ...actor, orgId: clientId, orgType: 'CLIENT' as const } };
    await svc.addToCart(cctx, { productId: str(f, 'productId'), quantity: Math.max(1, int(f, 'quantity')), siteId: str(f, 'siteId') || null, vdiTier: (str(f, 'vdiTier') || undefined) as VdiTier | undefined });
    return { ok: true, message: 'Ajouté au panier du client (co-navigation). Le client valide lui-même le devis et signe.' };
  });
}
export async function createPoAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    try {
      const po = await svc.createPurchaseOrder(ctx, str(f, 'orderId'));
      return { ok: true, message: `Bon de commande ${po.ref} émis.` };
    } catch (e) {
      if ((e as { code?: string }).code === 'CONDITIONS_SUSPENSIVES_NON_LEVEES') return { ok: false, error: 'Achat refusé : conditions suspensives non levées (CONDITIONS_SUSPENSIVES_NON_LEVEES).' };
      throw e;
    }
  });
}
export async function receivePoAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const n = await svc.receivePurchaseOrder(ctx, str(f, 'poId'));
    return { ok: true, message: `${n} équipements réceptionnés (séries + hash Autopilot), enrôlés et étiquetés.` };
  });
}
export async function shipAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    await svc.shipOrder(ctx, str(f, 'orderId'));
    return { ok: true, message: 'Expédition lancée.' };
  });
}
export async function deliveredAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    await svc.markDelivered(ctx, str(f, 'deliveryId'));
    return { ok: true, message: 'Livré — PV envoyé au réceptionnaire.' };
  });
}
export async function executeLockAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const n = await svc.executeLock(ctx, str(f, 'lockOrderId'));
    return { ok: true, message: `${n} équipement(s) verrouillé(s) via MDM, sur ordre de la banque.` };
  });
}
export async function gradeAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const p = await svc.gradeReturn(ctx, str(f, 'deviceId'), str(f, 'grade') as Grade);
    return { ok: true, message: `Grade enregistré — pénalité ${p.pct} % (${p.penalty} FCFA).` };
  });
}
export async function ticketStatusAction(_: A, f: FormData) {
  return act(S, async (ctx) => svc.updateTicket(ctx, str(f, 'ticketId'), str(f, 'status') as 'EN_COURS'));
}
export async function runBillingAction() {
  return act(S, async () => {
    const r = await svc.runScheduler();
    return { ok: true, message: `${r.invoicesCreated} facture(s) générée(s), ${r.dunningSent} relance(s).` };
  });
}
export async function updateParamAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    const key = str(f, 'key') as ParamKey;
    let value: unknown;
    try {
      value = JSON.parse(str(f, 'value'));
    } catch {
      return { ok: false, error: 'Valeur JSON invalide' };
    }
    await svc.updateParameter(ctx, key, value);
    return { ok: true, message: 'Paramètre versionné.' };
  });
}
export async function updateProductAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    if (!ctx.actor.roles.some((r) => ['SOLINK_ADMIN', 'SOLINK_ACHATS'].includes(r))) return { ok: false, error: 'Réservé aux achats / admin' };
    await ctx.db.product.update({ where: { id: str(f, 'productId') }, data: { purchasePrice: int(f, 'purchasePrice'), active: f.get('active') === 'on' } });
    return { ok: true, message: 'Produit mis à jour (les devis émis restent figés).' };
  });
}
export async function offerAction(_: A, f: FormData) {
  return act(S, async (ctx) => {
    await svc.issueOffer(ctx, str(f, 'orderId'));
    return { ok: true, message: 'Offre émise.' };
  });
}

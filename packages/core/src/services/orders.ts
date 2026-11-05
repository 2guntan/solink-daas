import type { VdiTier } from '@solink/db';
import { fileStore } from '@solink/adapters';
import { assertCan, assertOrderAccess } from '../authz';
import { BusinessError } from '../errors';
import { recordInitialTransition, transition } from '../order-machine';
import { nextRef } from '../refs';
import { addDays } from '../clock';
import { audit } from '../audit';
import { fcfa, date } from '../format';
import { renderPdf } from '../pdf/render';
import { quoteSpec } from '../pdf/documents';
import { isDevice } from '../pricing';
import { priceOrderLines } from './catalog';
import { notifyRoles, orgByType, type Ctx } from './context';

const EDITABLE = ['PANIER'];

export async function getOrCreateCart(ctx: Ctx) {
  assertCan(ctx.actor, 'cart.edit');
  const orgId = ctx.actor.orgId;
  const existing = await ctx.db.order.findFirst({ where: { organisationId: orgId, status: 'PANIER' }, orderBy: { createdAt: 'desc' } });
  if (existing) return existing;
  const org = await ctx.db.organisation.findUniqueOrThrow({ where: { id: orgId } });
  const financer = await orgByType(ctx.db, 'FINANCEUR');
  const ref = await nextRef(ctx.db, 'CMD', ctx.at.getUTCFullYear());
  const order = await ctx.db.order.create({
    data: {
      ref,
      organisationId: orgId,
      financerId: financer.id,
      apporteurId: org.apporteurId,
      durationMonths: Math.max(...ctx.params.durees_autorisees),
      createdById: ctx.actor.userId,
      statusChangedAt: ctx.at,
    },
  });
  await recordInitialTransition(ctx.db, order.id, 'PANIER', ctx.at, ctx.actor.userId, 'Création du panier');
  await audit(ctx.db, 'Order', order.id, 'PANIER_CREE', ctx.actor.userId, { ref });
  return order;
}

async function loadEditable(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertOrderAccess(ctx.actor, order);
  if (!EDITABLE.includes(order.status)) throw new BusinessError('PANIER_VERROUILLE', 'Le panier n’est plus modifiable (devis émis)');
  return order;
}

export async function refreshOrderTotals(ctx: Ctx, orderId: string) {
  const { totals } = await priceOrderLines(ctx.db, orderId, ctx.params);
  await ctx.db.order.update({
    where: { id: orderId },
    data: { monthlyTtc: totals.monthlyTtc, depositTtc: totals.depositTtc, financedAmount: totals.financedAmount },
  });
  return totals;
}

export async function addToCart(
  ctx: Ctx,
  input: { productId: string; quantity: number; siteId?: string | null; vdiTier?: VdiTier; insurance?: boolean; packName?: string; duration?: number },
) {
  const cart = await getOrCreateCart(ctx);
  const product = await ctx.db.product.findUniqueOrThrow({ where: { id: input.productId } });
  const vdi = product.category === 'THIN_CLIENT' ? (input.vdiTier ?? 'STANDARD') : 'AUCUN';
  if (input.siteId) {
    const site = await ctx.db.site.findUnique({ where: { id: input.siteId } });
    if (!site || site.organisationId !== ctx.actor.orgId) throw new BusinessError('SITE_INVALIDE', 'Site inconnu');
  }
  const same = await ctx.db.orderLine.findFirst({
    where: { orderId: cart.id, productId: product.id, siteId: input.siteId ?? null, vdiTier: vdi, insurance: input.insurance ?? true, packName: input.packName ?? null },
  });
  if (same) await ctx.db.orderLine.update({ where: { id: same.id }, data: { quantity: same.quantity + input.quantity } });
  else
    await ctx.db.orderLine.create({
      data: {
        orderId: cart.id,
        productId: product.id,
        quantity: input.quantity,
        siteId: input.siteId ?? null,
        vdiTier: vdi,
        insurance: isDevice(product.category) ? (input.insurance ?? true) : (input.insurance ?? false),
        packName: input.packName ?? null,
      },
    });
  if (input.duration && ctx.params.durees_autorisees.includes(input.duration)) await ctx.db.order.update({ where: { id: cart.id }, data: { durationMonths: input.duration } });
  await refreshOrderTotals(ctx, cart.id);
  return cart;
}

export async function addPackToCart(ctx: Ctx, packId: string, quantity: number, siteId: string | null) {
  const pack = await ctx.db.pack.findUniqueOrThrow({ where: { id: packId } });
  if (pack.organisationId !== ctx.actor.orgId) throw new BusinessError('ACCES_REFUSE', 'Pack hors périmètre', 403);
  const items = pack.items as { productId: string; quantity: number }[];
  let cart = null;
  for (const it of items) cart = await addToCart(ctx, { productId: it.productId, quantity: it.quantity * quantity, siteId, vdiTier: pack.vdiTier, packName: pack.name });
  return cart;
}

export async function updateLine(ctx: Ctx, lineId: string, patch: { quantity?: number; siteId?: string | null; vdiTier?: VdiTier; insurance?: boolean }) {
  const line = await ctx.db.orderLine.findUniqueOrThrow({ where: { id: lineId }, include: { product: true } });
  await loadEditable(ctx, line.orderId);
  if (patch.quantity !== undefined && patch.quantity < 1) {
    await ctx.db.orderLine.delete({ where: { id: lineId } });
  } else {
    const vdiTier = line.product.category === 'THIN_CLIENT' ? patch.vdiTier : undefined;
    await ctx.db.orderLine.update({ where: { id: lineId }, data: { quantity: patch.quantity, siteId: patch.siteId, vdiTier, insurance: patch.insurance } });
  }
  return refreshOrderTotals(ctx, line.orderId);
}

export async function removeLine(ctx: Ctx, lineId: string) {
  const line = await ctx.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
  await loadEditable(ctx, line.orderId);
  await ctx.db.orderLine.delete({ where: { id: lineId } });
  return refreshOrderTotals(ctx, line.orderId);
}

export async function setDuration(ctx: Ctx, orderId: string, duration: number) {
  await loadEditable(ctx, orderId);
  if (!ctx.params.durees_autorisees.includes(duration)) throw new BusinessError('DUREE_NON_AUTORISEE', 'Durée non autorisée');
  await ctx.db.order.update({ where: { id: orderId }, data: { durationMonths: duration } });
  return refreshOrderTotals(ctx, orderId);
}

/** E12 — émission du devis PDF numéroté et versionné ; prix garantis jusqu'à la date de validité. */
export async function issueQuote(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: true, financer: true, apporteur: true, quotes: true } });
  assertOrderAccess(ctx.actor, order);
  const { lines, totals } = await priceOrderLines(ctx.db, orderId, ctx.params);
  if (!lines.length) throw new BusinessError('PANIER_VIDE', 'Le panier est vide');
  if (lines.some((l) => !l.input.line.siteId)) throw new BusinessError('SITE_MANQUANT', 'Chaque ligne doit avoir un site de livraison');
  const version = order.quotes.length + 1;
  const baseRef = order.quotes[0]?.ref ?? (await nextRef(ctx.db, 'DV', ctx.at.getUTCFullYear()));
  const validUntil = addDays(ctx.at, ctx.params.validite_devis_jours);
  await ctx.db.quote.updateMany({ where: { orderId, status: { in: ['EMIS', 'EXPIRE'] } }, data: { status: 'REMPLACE' } });
  const quote = await ctx.db.quote.create({
    data: {
      orderId,
      ref: baseRef,
      version,
      issuedAt: ctx.at,
      validUntil,
      durationMonths: order.durationMonths,
      monthlyHt: totals.monthlyHt,
      monthlyTva: totals.monthlyTva,
      monthlyTtc: totals.monthlyTtc,
      depositTtc: totals.depositTtc,
      financedAmount: totals.financedAmount,
      totalContractTtc: totals.totalContractTtc,
      seats: totals.seats,
      parameterVersion: ctx.params.__version,
      lines: {
        create: lines.map((l) => ({
          productId: l.input.line.productId,
          label: l.input.line.product.name,
          quantity: l.input.quantity,
          siteId: l.input.line.siteId,
          siteName: l.input.line.site?.name ?? null,
          vdiTier: l.input.vdiTier ?? 'AUCUN',
          insurance: l.input.insurance ?? true,
          components: l.unit as object,
          unitMonthlyHt: l.unit.monthlyHt,
          unitMonthlyTtc: l.unit.monthlyTtc,
          lineMonthlyTtc: l.lineMonthlyTtc,
          unitBase: l.unit.base,
        })),
      },
    },
  });
  const pdf = await renderPdf(
    quoteSpec({
      ref: baseRef,
      version,
      issuedAt: ctx.at,
      validUntil,
      org: order.organisation,
      financer: order.financer.name,
      apporteur: order.apporteur?.name,
      duration: order.durationMonths,
      lines: lines.map((l) => ({ label: l.input.line.product.name, range: l.input.range, site: l.input.line.site?.name ?? '—', quantity: l.input.quantity, unit: l.unit, lineMonthlyTtc: l.lineMonthlyTtc, vdiTier: l.input.vdiTier ?? 'AUCUN', insurance: l.input.insurance ?? true })),
      totals,
      parameterVersion: ctx.params.__version,
    }),
  );
  const f = await fileStore.put(ctx.db, `${baseRef}-v${version}.pdf`, 'application/pdf', pdf, 'devis');
  await ctx.db.quote.update({ where: { id: quote.id }, data: { pdfFileId: f.id } });
  await ctx.db.order.update({
    where: { id: orderId },
    data: { monthlyTtc: totals.monthlyTtc, depositTtc: totals.depositTtc, financedAmount: totals.financedAmount, priceFrozenUntil: validUntil },
  });
  await transition(ctx.db, orderId, 'DEVIS_EMIS', ctx.actor, `Devis ${baseRef}-v${version} émis`);
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], 'DEVIS_EMIS', { ref: `${baseRef}-v${version}`, monthly: fcfa(totals.monthlyTtc), validUntil: date(validUntil) }, `/client/commandes/${orderId}`);
  return quote;
}

export async function currentQuote(ctx: Ctx, orderId: string) {
  return ctx.db.quote.findFirst({ where: { orderId }, orderBy: { version: 'desc' }, include: { lines: true } });
}

/** Modifier le devis → nouvelle version (retour au panier). */
export async function reviseQuote(ctx: Ctx, orderId: string) {
  const q = await currentQuote(ctx, orderId);
  if (q) await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'REMPLACE' } });
  await transition(ctx.db, orderId, 'PANIER', ctx.actor, 'Modification du devis (nouvelle version)');
}

/** Réactualiser un devis expiré : nouveau calcul aux conditions du jour (le client voit l'écart). */
export async function refreshExpiredQuote(ctx: Ctx, orderId: string) {
  const q = await currentQuote(ctx, orderId);
  if (!q || q.validUntil > ctx.at) throw new BusinessError('DEVIS_NON_EXPIRE', 'Le devis est encore valide');
  await reviseQuote(ctx, orderId);
  const nq = await issueQuote(ctx, orderId);
  return { previousMonthly: q.monthlyTtc, newMonthly: nq.monthlyTtc, delta: nq.monthlyTtc - q.monthlyTtc };
}

/** Acceptation du devis (E12) ; au-delà du seuil interne → approbation interne. */
export async function acceptQuote(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'quote.accept');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: true } });
  assertOrderAccess(ctx.actor, order);
  const q = await currentQuote(ctx, orderId);
  if (!q) throw new BusinessError('DEVIS_ABSENT', 'Aucun devis');
  if (q.validUntil <= ctx.at || q.status === 'EXPIRE') throw new BusinessError('DEVIS_EXPIRE', 'Ce devis est expiré : réactualisez-le');
  const threshold = order.organisation.approvalThreshold ?? ctx.params.seuil_approbation_interne;
  const approvers = await ctx.db.membership.count({ where: { organisationId: order.organisationId, roles: { has: 'CLIENT_APPROBATEUR' } } });
  if (q.monthlyTtc > threshold && approvers > 0) {
    await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'EN_APPROBATION', approvalRequired: true, acceptedById: ctx.actor.userId } });
    await transition(ctx.db, orderId, 'APPROBATION_INTERNE', ctx.actor, `Mensualité ${fcfa(q.monthlyTtc)} > seuil ${fcfa(threshold)}`);
    await notifyRoles(ctx, order.organisationId, ['CLIENT_APPROBATEUR'], 'APPROBATION_REQUISE', { ref: `${q.ref}-v${q.version}`, monthly: fcfa(q.monthlyTtc) }, `/client/commandes/${orderId}`);
    return { approvalRequired: true };
  }
  await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'ACCEPTE', acceptedById: ctx.actor.userId, acceptedAt: ctx.at } });
  await transition(ctx.db, orderId, 'DEVIS_ACCEPTE', ctx.actor, `Devis ${q.ref}-v${q.version} accepté`);
  return { approvalRequired: false };
}

export async function decideApproval(ctx: Ctx, orderId: string, approve: boolean, comment: string) {
  assertCan(ctx.actor, 'quote.approve');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertOrderAccess(ctx.actor, order);
  const q = await currentQuote(ctx, orderId);
  if (!q || q.status !== 'EN_APPROBATION') throw new BusinessError('PAS_D_APPROBATION', 'Aucune approbation en attente');
  if (approve) {
    await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'ACCEPTE', approvedById: ctx.actor.userId, approvedAt: ctx.at, approvalComment: comment, acceptedAt: ctx.at } });
    await transition(ctx.db, orderId, 'DEVIS_ACCEPTE', ctx.actor, `Approuvé : ${comment || 'sans commentaire'}`);
  } else {
    await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'EMIS', approvedById: ctx.actor.userId, approvalComment: comment } });
    await transition(ctx.db, orderId, 'DEVIS_EMIS', ctx.actor, `Refusé par l’approbateur : ${comment}`);
  }
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN'], 'APPROBATION_RESULTAT', { ref: `${q.ref}-v${q.version}`, result: approve ? 'approuvé' : 'refusé', comment }, `/client/commandes/${orderId}`);
}

export async function cancelOrder(ctx: Ctx, orderId: string, reason: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertOrderAccess(ctx.actor, order);
  await transition(ctx.db, orderId, 'ANNULE', ctx.actor, reason || 'Annulation');
  const { releaseForOrder } = await import('./envelope');
  await releaseForOrder(ctx, orderId);
}

export async function postMessage(ctx: Ctx, orderId: string, body: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertOrderAccess(ctx.actor, order);
  if (!body.trim()) throw new BusinessError('MESSAGE_VIDE', 'Message vide');
  await ctx.db.message.create({ data: { orderId, authorId: ctx.actor.userId, authorOrg: ctx.actor.orgType, body: body.trim(), at: ctx.at } });
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  const target = ctx.actor.orgType === 'CLIENT' ? solink.id : order.organisationId;
  await notifyRoles(ctx, target, ctx.actor.orgType === 'CLIENT' ? ['SOLINK_CHARGE_DOSSIER'] : ['CLIENT_ADMIN'], 'MESSAGE_DOSSIER', { author: ctx.actor.name, body: body.slice(0, 140) }, ctx.actor.orgType === 'CLIENT' ? `/solink/commandes/${orderId}` : `/client/commandes/${orderId}`, ['EMAIL']);
}

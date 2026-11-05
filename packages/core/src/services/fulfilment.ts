import { distributor, fileStore, mdm } from '@solink/adapters';
import { SYSTEM, assertCan, assertOrderAccess } from '../authz';
import { BusinessError } from '../errors';
import { transition } from '../order-machine';
import { audit } from '../audit';
import { addDays, addMonths } from '../clock';
import { fcfa, dateTime } from '../format';
import { renderPdf } from '../pdf/render';
import { disbursementInvoiceSpec, pvSpec, purchaseOrderSpec } from '../pdf/documents';
import { isDevice } from '../pricing';
import { nextRef } from '../refs';
import { buildSchedule, rentStartDate, type ContractAmounts } from '../billing';
import { commissionSchedule } from '../pricing';
import { notifyRoles, orgByType, type Ctx } from './context';
import { generatePack } from './contract';
import { emitWebhook } from './webhooks';

const PRE_PURCHASE = ['OFFRE_EMISE', 'SIGNATURE_CLIENT', 'CONTRESIGNATURE', 'CONDITIONS_SUSPENSIVES', 'ACCORDE', 'ACCORDE_SOUS_CONDITIONS'];

/** B05 — bon de commande distributeur, uniquement depuis PRÊT POUR ACHAT (v4 §11.1, Gherkin §20). */
export async function createPurchaseOrder(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'purchase.create');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { financer: true, lines: { include: { product: true } }, purchaseOrders: true } });
  if (PRE_PURCHASE.includes(order.status)) throw new BusinessError('CONDITIONS_SUSPENSIVES_NON_LEVEES', 'Achat impossible : conditions suspensives non levées');
  if (order.status !== 'PRET_POUR_ACHAT') throw new BusinessError('ETAPE_INVALIDE', `Achat impossible au statut ${order.status}`);
  const ref = await nextRef(ctx.db, 'BC', ctx.at.getUTCFullYear());
  const lines = order.lines.map((l) => ({ sku: l.product.sku, label: l.product.name, quantity: l.quantity, unit: l.product.purchasePrice }));
  const supplier = order.lines[0]?.product.supplier ?? 'Distributeur Démo Dakar';
  const pdf = await renderPdf(purchaseOrderSpec({ ref, orderRef: order.ref, supplier, issuedAt: ctx.at, lines, owner: order.financer.name }));
  const stored = await fileStore.put(ctx.db, `${ref}.pdf`, 'application/pdf', pdf, 'achats');
  const po = await ctx.db.purchaseOrder.create({ data: { ref, orderId, supplier, amount: lines.reduce((a, l) => a + l.unit * l.quantity, 0), fileId: stored.id, issuedAt: ctx.at } });
  const siteIds = [...new Set(order.lines.map((l) => l.siteId).filter(Boolean))] as string[];
  for (const siteId of siteIds) await ctx.db.delivery.create({ data: { orderId, siteId } });
  await transition(ctx.db, orderId, 'ACHETE', ctx.actor, `Bon de commande ${ref} émis`);
  return po;
}

/** B06 — « Simuler la réception » : séries + hash Autopilot, propriétaire = banque, enrôlement MDM. */
export async function receivePurchaseOrder(ctx: Ctx, poId: string) {
  assertCan(ctx.actor, 'logistics.manage');
  const po = await ctx.db.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { order: { include: { lines: { include: { product: true } }, contract: true } } } });
  if (po.status === 'RECU') throw new BusinessError('DEJA_RECU', 'Bon de commande déjà réceptionné');
  const order = po.order;
  const units = await distributor.simulateReception(po.ref, order.lines.map((l) => ({ sku: l.product.sku, quantity: l.quantity, autopilot: isDevice(l.product.category) })));
  let idx = 0;
  for (const l of order.lines) {
    for (let i = 0; i < l.quantity; i++) {
      const u = units[idx++];
      const device = await ctx.db.device.create({
        data: { serial: u.serial, autopilotHash: u.autopilotHash, productId: l.productId, orderId: order.id, contractId: order.contract?.id, ownerId: order.financerId, siteId: l.siteId, status: 'EN_STOCK', purchasePrice: l.product.purchasePrice },
      });
      if (isDevice(l.product.category)) {
        const r = await mdm.enroll(u.serial);
        await ctx.db.device.update({ where: { id: device.id }, data: { mdmId: r.mdmId, status: 'ENROLE' } });
        await ctx.db.mdmAction.create({ data: { deviceId: device.id, action: 'ENROLER', executedById: ctx.actor.userId, at: ctx.at } });
      }
    }
  }
  await ctx.db.purchaseOrder.update({ where: { id: poId }, data: { status: 'RECU', receivedAt: ctx.at } });
  await audit(ctx.db, 'PurchaseOrder', poId, 'RECEPTION_SERIES', ctx.actor.userId, { units: units.length });
  await transition(ctx.db, order.id, 'EN_PREPARATION', ctx.actor, `${units.length} équipements réceptionnés, enrôlés Autopilot/Intune, étiquetés`);
  return units.length;
}

/** E23 — choix du créneau de livraison par site. */
export async function scheduleDelivery(ctx: Ctx, deliveryId: string, slot: Date) {
  const d = await ctx.db.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: true, site: true } });
  assertOrderAccess(ctx.actor, d.order);
  if (['EXPEDIEE', 'LIVREE'].includes(d.status)) throw new BusinessError('LIVRAISON_EN_COURS', 'Créneau non modifiable');
  if (slot < ctx.at) throw new BusinessError('CRENEAU_PASSE', 'Choisissez un créneau futur');
  await ctx.db.delivery.update({ where: { id: deliveryId }, data: { slot, status: 'PLANIFIEE' } });
  if (d.site.contactEmail) {
    const { messaging } = await import('@solink/adapters');
    await messaging.send(ctx.db, { to: d.site.contactEmail, channels: ['WHATSAPP'], template: 'CREneau', vars: { site: d.site.name, slot: dateTime(slot) }, at: ctx.at });
  }
}

export async function shipOrder(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'logistics.manage');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { deliveries: { include: { site: true } } } });
  for (const d of order.deliveries) {
    await ctx.db.delivery.update({ where: { id: d.id }, data: { status: 'EXPEDIEE', shippedAt: ctx.at, slot: d.slot ?? addDays(ctx.at, 1) } });
    await ctx.db.device.updateMany({ where: { orderId, siteId: d.siteId }, data: { status: 'EN_TRANSIT' } });
    await notifyRoles(ctx, order.organisationId, ['CLIENT_RECEPTION'], 'EXPEDITION', { site: d.site.name, slot: dateTime(d.slot ?? addDays(ctx.at, 1)) }, '/client/livraisons', ['WHATSAPP']);
  }
  await transition(ctx.db, orderId, 'EXPEDIE', ctx.actor, 'Équipements expédiés');
}

/** Livraison d'un site : PV numérique à signer par le réceptionnaire (OTP). */
export async function markDelivered(ctx: Ctx, deliveryId: string) {
  assertCan(ctx.actor, 'logistics.manage');
  const d = await ctx.db.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: true, site: true } });
  if (d.status === 'LIVREE') return;
  if (!['EXPEDIE', 'PV_A_SIGNER'].includes(d.order.status)) throw new BusinessError('ETAPE_INVALIDE', 'La commande n’est pas expédiée');
  const devices = await ctx.db.device.findMany({ where: { orderId: d.orderId, siteId: d.siteId }, include: { product: true } });
  await ctx.db.delivery.update({ where: { id: deliveryId }, data: { status: 'LIVREE', deliveredAt: ctx.at } });
  await ctx.db.deliveryReceipt.create({
    data: {
      deliveryId,
      serials: devices.map((x) => ({ serial: x.serial, label: x.product.name })),
      photos: devices.slice(0, 3).map((x, i) => `photo_${d.site.name.replace(/\W+/g, '_')}_${i + 1}_${x.serial}.jpg`),
    },
  });
  await ctx.db.device.updateMany({ where: { orderId: d.orderId, siteId: d.siteId }, data: { status: 'LIVRE' } });
  if (d.order.status === 'EXPEDIE') await transition(ctx.db, d.orderId, 'PV_A_SIGNER', ctx.actor, `Livré sur le site ${d.site.name}`);
  await notifyRoles(ctx, d.order.organisationId, ['CLIENT_RECEPTION', 'CLIENT_ADMIN'], 'PV_A_SIGNER', { site: d.site.name, link: '/client/livraisons' }, '/client/livraisons', ['WHATSAPP', 'SMS']);
}

/** E23 — signature OTP du PV par le réceptionnaire ; dernier PV → demande de décaissement. */
export async function signPv(ctx: Ctx, deliveryId: string, otp: string, reserves?: string, blocking = false) {
  assertCan(ctx.actor, 'pv.sign');
  const d = await ctx.db.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: { include: { contract: true } }, site: true, pv: true } });
  assertOrderAccess(ctx.actor, d.order);
  if (!d.pv || d.status !== 'LIVREE') throw new BusinessError('PV_INDISPONIBLE', 'Aucun PV à signer pour ce site');
  if (d.pv.status === 'SIGNE') return { disbursement: null };
  const demoOk = (process.env.DEMO_MODE ?? 'true') === 'true' && otp === '000000';
  if (!demoOk) {
    const code = await ctx.db.otpCode.findFirst({ where: { identifier: `pv:${deliveryId}`, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!code || code.code !== otp || code.expiresAt < ctx.at) throw new BusinessError('OTP_INVALIDE', 'Code OTP invalide');
    await ctx.db.otpCode.update({ where: { id: code.id }, data: { usedAt: ctx.at } });
  }
  const serials = d.pv.serials as { serial: string; label: string }[];
  const pdf = await renderPdf(pvSpec({ orderRef: d.order.ref, contractRef: d.order.contract?.ref ?? '—', site: d.site.name, serials, reserves, signer: ctx.actor.name, signedAt: ctx.at, photos: (d.pv.photos as string[]).length }));
  const stored = await fileStore.put(ctx.db, `PV_${d.order.ref}_${d.site.name.replace(/\W+/g, '_')}.pdf`, 'application/pdf', pdf, 'pv');
  await ctx.db.deliveryReceipt.update({ where: { id: d.pv.id }, data: { status: 'SIGNE', signedById: ctx.actor.userId, signedName: ctx.actor.name, signedAt: ctx.at, reserves: reserves || null, blocking, fileId: stored.id, sha256: stored.sha256 } });
  await audit(ctx.db, 'DeliveryReceipt', d.pv.id, 'PV_SIGNE', ctx.actor.userId, { site: d.site.name, sha256: stored.sha256, reserves });
  if (blocking && reserves) {
    const ref = await nextRef(ctx.db, 'TK', ctx.at.getUTCFullYear());
    await ctx.db.ticket.create({ data: { ref, organisationId: d.order.organisationId, subject: `Réserve bloquante à la livraison — ${d.site.name}`, description: reserves, priority: 'HAUTE', createdById: ctx.actor.userId, createdAt: ctx.at } });
  }
  await emitWebhook(ctx, 'delivery.pv_signed', { order: d.order.ref, site: d.site.name, pv_sha256: stored.sha256 });
  const all = await ctx.db.delivery.findMany({ where: { orderId: d.orderId }, include: { pv: true } });
  const allSigned = all.every((x) => x.status === 'LIVREE' && x.pv?.status === 'SIGNE');
  if (allSigned) return { disbursement: await requestDisbursement(ctx, d.orderId) };
  return { disbursement: null };
}

export async function sendPvOtp(ctx: Ctx, deliveryId: string) {
  const code = String(100000 + Math.floor(Math.random() * 900000));
  await ctx.db.otpCode.create({ data: { identifier: `pv:${deliveryId}`, code, purpose: 'PV', expiresAt: addDays(ctx.at, 1 / 144) } });
  const { messaging } = await import('@solink/adapters');
  await messaging.send(ctx.db, { to: ctx.actor.email, channels: ['SMS'], template: 'OTP', vars: { code }, at: ctx.at });
}

/** v4 §11.2 — demande de décaissement générée automatiquement. Aucun ordre de paiement n'est émis. */
async function requestDisbursement(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { financer: true, contract: true, deliveries: { include: { pv: true, site: true } }, devices: true, creditFile: { include: { packages: { orderBy: { version: 'desc' }, take: 1 } } }, quotes: { where: { status: 'ACCEPTE' }, take: 1, orderBy: { version: 'desc' }, include: { lines: true } } },
  });
  const contract = order.contract!;
  const ref = await nextRef(ctx.db, 'DD', ctx.at.getUTCFullYear());
  const lines = order.quotes[0].lines.map((l) => ({ label: l.label, quantity: l.quantity, unitBase: l.unitBase }));
  const amount = lines.reduce((a, l) => a + l.unitBase * l.quantity, 0);
  const inv = await renderPdf(disbursementInvoiceSpec({ ref, contractRef: contract.ref, financer: order.financer.name, amount, at: ctx.at, lines }));
  const invFile = await fileStore.put(ctx.db, `Facture_SOLINK_${ref}.pdf`, 'application/pdf', inv, 'decaissements');
  await generatePack(ctx, orderId, true, ['ANNEXE_1']); // annexe 1 mise à jour avec les séries
  const pieces = {
    facture: invFile.id,
    pv: order.deliveries.map((d) => ({ site: d.site.name, fileId: d.pv?.fileId, sha256: d.pv?.sha256, photos: d.pv?.photos })),
    series: order.devices.map((x) => x.serial),
    annexe1: 'ANNEXE_1 (mise à jour au PV)',
    contrat: contract.ref,
    dfs: order.creditFile?.packages[0]?.packageId,
  };
  const dd = await ctx.db.disbursement.create({ data: { ref, contractId: contract.id, amount, pieces, invoiceFileId: invFile.id, requestedAt: ctx.at } });
  await transition(ctx.db, orderId, 'DECAISSEMENT_DEMANDE', SYSTEM, `Demande de décaissement ${ref} (${fcfa(amount)})`);
  await audit(ctx.db, 'Disbursement', dd.id, 'DECAISSEMENT_DEMANDE_SANS_ORDRE_DE_PAIEMENT', 'SYSTEME', { amount });
  await emitWebhook(ctx, 'disbursement.requested', { disbursement: ref, contract: contract.ref, amount_xof: amount });
  await notifyRoles(ctx, order.financerId, ['BANQUE_TRESORERIE'], 'DECAISSEMENT_DEMANDE', { ref, amount: fcfa(amount), contract: contract.ref }, '/banque/decaissements', ['EMAIL', 'PORTAIL']);
  return dd;
}

export async function validateDisbursement(ctx: Ctx, disbursementId: string) {
  assertCan(ctx.actor, 'bank.treasury');
  const dd = await ctx.db.disbursement.findUniqueOrThrow({ where: { id: disbursementId }, include: { contract: { include: { order: true } } } });
  assertOrderAccess(ctx.actor, dd.contract.order);
  if (dd.status !== 'DEMANDEE') throw new BusinessError('ETAPE_INVALIDE', 'Demande déjà traitée');
  await ctx.db.disbursement.update({ where: { id: disbursementId }, data: { status: 'VALIDEE', validatedAt: ctx.at, validatedById: ctx.actor.userId } });
  await audit(ctx.db, 'Disbursement', disbursementId, 'DECAISSEMENT_VALIDE', ctx.actor.userId, {});
}

export async function rejectDisbursement(ctx: Ctx, disbursementId: string, reason: string) {
  assertCan(ctx.actor, 'bank.treasury');
  if (!reason.trim()) throw new BusinessError('MOTIF_REQUIS', 'Motif requis');
  const dd = await ctx.db.disbursement.findUniqueOrThrow({ where: { id: disbursementId }, include: { contract: { include: { order: true } } } });
  assertOrderAccess(ctx.actor, dd.contract.order);
  await ctx.db.disbursement.update({ where: { id: disbursementId }, data: { status: 'REJETEE', rejectReason: reason } });
  await audit(ctx.db, 'Disbursement', disbursementId, 'DECAISSEMENT_REJETE', ctx.actor.userId, { reason });
}

export async function contractAmounts(ctx: Ctx, orderId: string): Promise<ContractAmounts> {
  const q = await ctx.db.quote.findFirstOrThrow({ where: { orderId, status: 'ACCEPTE' }, orderBy: { version: 'desc' }, include: { lines: true } });
  const sum = (k: string) => q.lines.reduce((a, l) => a + ((l.components as Record<string, number>)[k] ?? 0) * l.quantity, 0);
  return {
    rentHt: sum('rentHt'),
    rentTva: sum('rentTva'),
    servicesSolinkHt: sum('servicesSolinkHt'),
    servicesSolinkTva: sum('servicesSolinkTva'),
    vdiHt: sum('vdiHt'),
    vdiTva: sum('vdiTva'),
    insuranceHt: sum('insuranceHt'),
    insuranceTva: sum('insuranceTva'),
  };
}

/** Confirmation de paiement de SOLINK par la banque (rapprochement) → contrat ACTIF + échéancier. */
export async function confirmDisbursementPaid(ctx: Ctx, disbursementId: string, paymentRef: string) {
  assertCan(ctx.actor, 'bank.treasury');
  const dd = await ctx.db.disbursement.findUniqueOrThrow({ where: { id: disbursementId }, include: { contract: { include: { order: { include: { deliveries: { include: { pv: true } } } } } } } });
  assertOrderAccess(ctx.actor, dd.contract.order);
  if (dd.status === 'PAYEE') return;
  if (dd.status === 'REJETEE') throw new BusinessError('DECAISSEMENT_REJETE', 'Demande rejetée');
  await ctx.db.disbursement.update({ where: { id: disbursementId }, data: { status: 'PAYEE', paidAt: ctx.at, paymentRef: paymentRef || `VIR-${dd.ref}`, validatedAt: dd.validatedAt ?? ctx.at, validatedById: dd.validatedById ?? ctx.actor.userId } });
  const order = dd.contract.order;
  const lastPv = order.deliveries.map((d) => d.pv?.signedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? ctx.at;
  await activateContract(ctx, order.id, lastPv);
  await transition(ctx.db, order.id, 'ACTIF', ctx.actor, `Paiement SOLINK confirmé (${paymentRef || 'virement'}) — contrat actif`);
  await notifyRoles(ctx, order.financerId, ['BANQUE_TRESORERIE'], 'DECAISSEMENT_PAYE', { ref: dd.ref, amount: fcfa(dd.amount), contract: dd.contract.ref }, '/banque/decaissements', ['PORTAIL']);
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  await notifyRoles(ctx, solink.id, ['SOLINK_FINANCE', 'SOLINK_ADMIN'], 'DECAISSEMENT_PAYE', { ref: dd.ref, amount: fcfa(dd.amount), contract: dd.contract.ref }, '/solink/decaissements', ['EMAIL']);
}

export async function activateContract(ctx: Ctx, orderId: string, lastPvDate: Date) {
  const contract = await ctx.db.contract.findUniqueOrThrow({ where: { orderId } });
  const start = rentStartDate(lastPvDate);
  const amounts = await contractAmounts(ctx, orderId);
  const comm = commissionSchedule(contract.financedAmount, ctx.params.commission_apporteur_pct, contract.durationMonths);
  const plan = buildSchedule(start, contract.durationMonths, amounts, comm, ctx.params.facture_jour_emission, ctx.params.facture_jour_echeance);
  await ctx.db.installment.deleteMany({ where: { contractId: contract.id } });
  await ctx.db.installment.createMany({ data: plan.map((p) => ({ contractId: contract.id, number: p.number, dueDate: p.dueDate, rentHt: p.rentHt, rentTva: p.rentTva, servicesHt: p.servicesHt, servicesTva: p.servicesTva, totalTtc: p.totalTtc })) });
  await ctx.db.contract.update({ where: { id: contract.id }, data: { status: 'ACTIF', startDate: start, endDate: addMonths(start, contract.durationMonths) } });
  await ctx.db.device.updateMany({ where: { orderId, status: { in: ['LIVRE', 'ENROLE', 'EN_STOCK'] } }, data: { status: 'ACTIF', contractId: contract.id } });
  await generatePack(ctx, orderId, true, ['ANNEXE_2']);
  await audit(ctx.db, 'Contract', contract.id, 'CONTRAT_ACTIF', ctx.actor.userId, { start: start.toISOString(), installments: plan.length });
}

'use server';

import type { MandateMethod, Role, Segment, SignatureMode, VdiTier } from '@solink/db';
import { svc, fcfa } from '@solink/core';
import { act, int, requestMeta, str, type ActionResult } from '@/lib/action';

type A = ActionResult | null;
const C = 'client' as const;

export async function updateLineAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.updateLine(ctx, str(f, 'lineId'), { quantity: int(f, 'quantity'), siteId: str(f, 'siteId') || null, vdiTier: (str(f, 'vdiTier') || undefined) as VdiTier | undefined, insurance: f.get('insurance') === 'on' });
    return { ok: true, message: 'Panier mis à jour.' };
  });
}
export async function removeLineAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.removeLine(ctx, str(f, 'lineId'));
  });
}
export async function setDurationAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.setDuration(ctx, str(f, 'orderId'), int(f, 'duration'));
  });
}
export async function issueQuoteAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const id = str(f, 'orderId');
    const q = await svc.issueQuote(ctx, id);
    return { ok: true, message: `Devis ${q.ref}-v${q.version} émis.`, redirect: `/client/commandes/${id}` };
  });
}
export async function callbackAction(_: A, f: FormData) {
  return act(C, async (ctx, actor) => {
    const solink = await svc.orgByType(ctx.db, 'OPERATEUR');
    await svc.notifyRoles(ctx, solink.id, ['SOLINK_COMMERCIAL'], 'MESSAGE_DOSSIER', { author: actor.name, body: `Demande de rappel au sujet du panier ${str(f, 'ref')}` }, '/solink', ['EMAIL', 'PORTAIL']);
    return { ok: true, message: 'Demande de rappel transmise à un commercial SOLINK.' };
  });
}
export async function addPackAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.addPackToCart(ctx, str(f, 'packId'), Math.max(1, int(f, 'quantity')), str(f, 'siteId') || null);
    return { ok: true, message: 'Pack ajouté au panier.', redirect: '/client/panier' };
  });
}
export async function createPackAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const items = f
      .getAll('productId')
      .map(String)
      .filter(Boolean)
      .map((productId) => ({ productId, quantity: 1 }));
    await svc.createPack(ctx, { name: str(f, 'name'), description: str(f, 'description'), items, vdiTier: (str(f, 'vdiTier') || 'AUCUN') as VdiTier });
    return { ok: true, message: 'Pack créé.' };
  });
}
export async function deletePackAction(_: A, f: FormData) {
  return act(C, async (ctx) => svc.deletePack(ctx, str(f, 'packId')));
}

export async function reviseQuoteAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.reviseQuote(ctx, str(f, 'orderId'));
    return { ok: true, redirect: '/client/panier' };
  });
}
export async function refreshQuoteAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const r = await svc.refreshExpiredQuote(ctx, str(f, 'orderId'));
    return { ok: true, message: `Devis réactualisé : ${fcfa(r.previousMonthly)} → ${fcfa(r.newMonthly)} (écart ${r.delta >= 0 ? '+' : ''}${fcfa(r.delta)}).` };
  });
}
export async function acceptQuoteAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const r = await svc.acceptQuote(ctx, str(f, 'orderId'));
    return { ok: true, message: r.approvalRequired ? 'Devis transmis à votre approbateur interne.' : 'Devis accepté.' };
  });
}
export async function approvalAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.decideApproval(ctx, str(f, 'orderId'), str(f, 'decision') === 'oui', str(f, 'reason'));
    return { ok: true, message: 'Décision enregistrée.' };
  });
}
export async function requestFinancingAction(_: A, f: FormData) {
  const meta = await requestMeta();
  return act(C, async (ctx) => {
    const id = str(f, 'orderId');
    await svc.requestFinancing(ctx, id, { cgu: f.get('cgu') === 'on', donnees: f.get('donnees') === 'on', bic: f.get('bic') === 'on', ...meta });
    return { ok: true, redirect: `/client/commandes/${id}/dossier` };
  });
}
export async function cancelOrderAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.cancelOrder(ctx, str(f, 'orderId'), str(f, 'reason'));
    return { ok: true, message: 'Commande annulée.' };
  });
}
export async function messageAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.postMessage(ctx, str(f, 'orderId'), str(f, 'body'));
    return { ok: true, message: 'Message envoyé.' };
  });
}

// ── Dossier de crédit ──
export async function saveEntrepriseAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.saveBlock(ctx, str(f, 'orderId'), 'entreprise', {
      name: str(f, 'name'),
      ninea: str(f, 'ninea'),
      rccm: str(f, 'rccm'),
      legalForm: str(f, 'legalForm'),
      createdOn: str(f, 'createdOn'),
      capital: int(f, 'capital'),
      address: str(f, 'address'),
      activity: str(f, 'activity'),
      employees: int(f, 'employees'),
      banks: str(f, 'banks'),
      group: str(f, 'group'),
    });
    return { ok: true, message: 'Bloc Entreprise enregistré.' };
  });
}
export async function savePersonsAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const types = f.getAll('type').map(String);
    const persons = types
      .map((type, i) => ({ type, firstName: String(f.getAll('firstName')[i] ?? ''), lastName: String(f.getAll('lastName')[i] ?? ''), role: String(f.getAll('role')[i] ?? ''), ownershipPct: Number(f.getAll('ownershipPct')[i] ?? 0) || undefined, ppe: f.getAll('ppe').map(String).includes(String(i)) }))
      .filter((p) => p.firstName || p.lastName);
    await svc.saveBlock(ctx, str(f, 'orderId'), 'dirigeants', { persons });
    return { ok: true, message: 'Bloc Dirigeants enregistré.' };
  });
}
export async function saveFinancesAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const years = f
      .getAll('year')
      .map(String)
      .map((year, i) => {
        const g = (k: string) => Number(String(f.getAll(k)[i] ?? '0').replace(/\s/g, '')) || 0;
        return { year: Number(year), ca: g('ca'), rex: g('rex'), rn: g('rn'), cp: g('cp'), dettes: g('dettes'), tresorerie: g('tresorerie') };
      })
      .filter((y) => y.ca > 0);
    await svc.saveBlock(ctx, str(f, 'orderId'), 'finances', { years, commitments: str(f, 'commitments') });
    return { ok: true, message: 'Bloc Finances enregistré.' };
  });
}
export async function saveDeclarationsAction(_: A, f: FormData) {
  const meta = await requestMeta();
  return act(C, async (ctx) => {
    await svc.saveDeclarations(ctx, str(f, 'orderId'), { exactitude: f.get('exactitude') === 'on', ppe: f.get('ppe') === 'on', orange: f.get('orange') === 'on' }, meta);
    return { ok: true, message: 'Déclarations enregistrées.' };
  });
}
export async function uploadDocAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const id = str(f, 'documentId');
    const mode = str(f, 'mode');
    let r;
    if (mode === 'demo' || mode === 'demo-perime') r = await svc.uploadDocument(ctx, id, { demo: true, ageDays: mode === 'demo-perime' ? 120 : 15 });
    else {
      const file = f.get('file');
      if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choisissez un fichier' };
      r = await svc.uploadDocument(ctx, id, { name: file.name, mime: file.type || 'application/octet-stream', data: Buffer.from(await file.arrayBuffer()) });
    }
    return r.status === 'A_REPRENDRE' ? { ok: true, message: `Pièce à reprendre : ${r.reason}` } : { ok: true, message: 'Pièce reçue — en vérification. Vérifiez les champs extraits.' };
  });
}
export async function uploadAllDemoAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const orderId = str(f, 'orderId');
    const docs = await ctx.db.document.findMany({ where: { creditFile: { orderId }, status: { in: ['A_FOURNIR', 'A_REPRENDRE'] } } });
    for (const d of docs) await svc.uploadDocument(ctx, d.id, { demo: true, ageDays: 15 });
    return { ok: true, message: `${docs.length} pièce(s) de démo jointe(s).` };
  });
}
export async function confirmExtractionAction(_: A, f: FormData) {
  return act(C, async (ctx) => svc.confirmExtraction(ctx, str(f, 'documentId')));
}
export async function notApplicableAction(_: A, f: FormData) {
  return act(C, async (ctx) => svc.markNotApplicable(ctx, str(f, 'documentId'), str(f, 'reason')));
}
export async function submitDossierAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const id = str(f, 'orderId');
    await svc.submitDossier(ctx, id);
    return { ok: true, message: 'Dossier soumis et scellé. SOLINK vérifie la complétude.', redirect: `/client/commandes/${id}` };
  });
}
export async function provideComplementsAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const id = str(f, 'orderId');
    const r = await svc.provideComplements(ctx, id);
    return { ok: true, message: `Compléments transmis à la banque (${r.pkg.packageId}).`, redirect: `/client/commandes/${id}` };
  });
}
export async function inviteColleagueAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.inviteMember(ctx, { email: str(f, 'email'), firstName: str(f, 'firstName') || 'Collègue', lastName: str(f, 'lastName') || '(invité)', roles: ['CLIENT_FINANCE'], isSignatory: false });
    return { ok: true, message: 'Invitation envoyée (accès limité au bloc Finances).' };
  });
}

// ── Décision, signature, conditions ──
export async function acceptConditionsAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.acceptConditions(ctx, str(f, 'orderId'));
    return { ok: true, message: 'Nouvelle offre acceptée.' };
  });
}
export async function startCeremonyAction(_: A, f: FormData) {
  return act(C, async (ctx, actor) => {
    const id = str(f, 'orderId');
    const c = await svc.startCeremony(ctx, id, (str(f, 'method') || 'PRELEVEMENT_BANCAIRE') as MandateMethod);
    const me = c.signers.find((s) => s.userId === actor.userId && s.status === 'A_SIGNER');
    return { ok: true, redirect: me ? `/signer/${me.token}` : `/client/commandes/${id}/signature` };
  });
}

// ── Livraison ──
export async function scheduleDeliveryAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.scheduleDelivery(ctx, str(f, 'deliveryId'), new Date(`${str(f, 'slot')}T09:00:00Z`));
    return { ok: true, message: 'Créneau enregistré.' };
  });
}
export async function sendPvOtpAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.sendPvOtp(ctx, str(f, 'deliveryId'));
    return { ok: true, message: 'Code envoyé par SMS (Boîte de démo).' };
  });
}
export async function signPvAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const r = await svc.signPv(ctx, str(f, 'deliveryId'), str(f, 'otp'), str(f, 'reserves'), f.get('blocking') === 'on');
    return { ok: true, message: r.disbursement ? 'PV signé. Dernier site réceptionné : la demande de décaissement est transmise à la banque.' : 'PV signé.' };
  });
}

// ── Parc, tickets, équipe, sites, entreprise ──
export async function createTicketAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const t = await svc.createTicket(ctx, { subject: str(f, 'subject'), description: str(f, 'description'), deviceId: str(f, 'deviceId') || null });
    return { ok: true, message: `Ticket ${t.ref} créé.` };
  });
}
export async function inviteMemberAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.inviteMember(ctx, {
      email: str(f, 'email'),
      firstName: str(f, 'firstName'),
      lastName: str(f, 'lastName'),
      title: str(f, 'title'),
      mobile: str(f, 'mobile'),
      roles: f.getAll('roles').map(String) as Role[],
      isSignatory: f.get('isSignatory') === 'on',
      signatureMode: (str(f, 'signatureMode') || 'SEUL') as SignatureMode,
    });
    return { ok: true, message: 'Invitation envoyée.' };
  });
}
export async function updateMemberAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.updateMember(ctx, str(f, 'membershipId'), { roles: f.getAll('roles').map(String) as Role[], isSignatory: f.get('isSignatory') === 'on', signatureMode: (str(f, 'signatureMode') || 'SEUL') as SignatureMode });
    return { ok: true, message: 'Membre mis à jour.' };
  });
}
export async function upsertSiteAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.upsertSite(ctx, { id: str(f, 'id') || undefined, name: str(f, 'name'), address: str(f, 'address'), landmark: str(f, 'landmark'), contactName: str(f, 'contactName'), contactPhone: str(f, 'contactPhone'), contactEmail: str(f, 'contactEmail'), hours: str(f, 'hours') });
    return { ok: true, message: 'Site enregistré.' };
  });
}
export async function importSitesAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    const file = f.get('file');
    const csv = file instanceof File && file.size ? await file.text() : str(f, 'csv');
    const n = await svc.importSitesCsv(ctx, csv);
    return { ok: true, message: `${n} site(s) importé(s).` };
  });
}
export async function updateCompanyAction(_: A, f: FormData) {
  return act(C, async (ctx) => {
    await svc.updateCompany(ctx, {
      name: str(f, 'name'),
      ninea: str(f, 'ninea'),
      rccm: str(f, 'rccm'),
      segment: str(f, 'segment') as Segment,
      sector: str(f, 'sector'),
      legalForm: str(f, 'legalForm'),
      address: str(f, 'address'),
      createdOn: str(f, 'createdOn') || undefined,
      approvalThreshold: int(f, 'approvalThreshold') || undefined,
      jointSignature: f.get('jointSignature') === 'on',
    });
    return { ok: true, message: 'Entreprise mise à jour.' };
  });
}

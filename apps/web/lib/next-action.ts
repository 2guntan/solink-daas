import 'server-only';
import { prisma, type OrderStatus } from '@solink/db';
import { STATUS_INFO, date, type Actor } from '@solink/core';

export interface NextAction {
  label: string;
  href?: string;
  owner: string;
  mine: boolean;
  orderRef?: string;
  updatedAt?: Date;
}

/** Règle d'or « jamais bloqué » (v4 §4.3) : une seule prochaine action, son responsable, son délai. */
export async function nextActionFor(orderId: string, actor: Actor): Promise<NextAction> {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      creditFile: { include: { documents: true } },
      contract: { include: { ceremonies: { include: { signers: true }, orderBy: { createdAt: 'desc' }, take: 1 }, mandate: true, invoices: true } },
      deliveries: { include: { pv: true, site: true } },
      quotes: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const base = `/client/commandes/${o.id}`;
  const s = o.status as OrderStatus;
  const info = STATUS_INFO[s];
  const mk = (label: string, href?: string, owner = 'Vous', mine = true): NextAction => ({ label, href, owner, mine, orderRef: o.ref, updatedAt: o.statusChangedAt });
  switch (s) {
    case 'PANIER':
      return mk('Complétez votre panier puis émettez le devis', '/client/panier');
    case 'DEVIS_EMIS':
      return o.quotes[0] && o.quotes[0].validUntil < new Date() ? mk('Réactualisez votre devis expiré', base) : mk(`Acceptez le devis avant le ${date(o.quotes[0]?.validUntil)}`, base);
    case 'APPROBATION_INTERNE':
      return actor.roles.includes('CLIENT_APPROBATEUR') ? mk('Approuvez ou refusez le devis', base) : mk('En attente de votre approbateur interne', base, 'Approbateur interne', false);
    case 'DEVIS_ACCEPTE':
      return mk('Demandez le financement', base);
    case 'DOSSIER_EN_COURS':
    case 'DOSSIER_A_REPRENDRE': {
      const docs = o.creditFile?.documents ?? [];
      const redo = docs.find((d) => d.status === 'A_REPRENDRE');
      if (redo) return mk(`Reprenez la pièce « ${redo.label} » (${redo.rejectReason})`, `${base}/dossier#piece-${redo.id}`);
      const missing = docs.find((d) => d.required && d.status === 'A_FOURNIR');
      if (missing) return mk(`Ajoutez : ${missing.label}`, `${base}/dossier#piece-${missing.id}`);
      return mk('Vérifiez vos blocs et soumettez votre dossier', `${base}/dossier`);
    }
    case 'PIECES_COMPLEMENTAIRES': {
      const req = o.creditFile?.documents.find((d) => d.origin === 'DEMANDE_BANQUE' && d.status === 'A_FOURNIR');
      return req ? mk(`La banque demande : ${req.label} — avant le ${date(req.dueDate)}`, `${base}/dossier#piece-${req.id}`) : mk('Transmettez les compléments à la banque', `${base}/dossier`);
    }
    case 'ACCORDE_SOUS_CONDITIONS':
      return mk('Acceptez la nouvelle offre (conditions de la banque)', base);
    case 'OFFRE_EMISE':
      return actor.roles.includes('CLIENT_SIGNATAIRE') ? mk('Signez le contrat en ligne', `${base}/signature`) : mk('Le signataire doit signer le contrat', `${base}/signature`, 'Signataire', false);
    case 'SIGNATURE_CLIENT': {
      const signer = o.contract?.ceremonies[0]?.signers.find((x) => x.status === 'A_SIGNER');
      if (signer && signer.userId === actor.userId) return mk('Signez le contrat', `/signer/${signer.token}`);
      return mk(`En attente de la signature de ${signer?.name ?? 'un co-signataire'}`, `${base}/signature`, signer?.name ?? 'Co-signataire', false);
    }
    case 'CONDITIONS_SUSPENSIVES': {
      const c = o.contract;
      if (c && !c.depositReceivedAt) return mk(`Virez le dépôt de garantie au compte de la banque (réf. ${c.depositReference})`, `${base}/signature`);
      return mk('Finalisation par la banque (mandat, conditions)', `${base}/signature`, 'Banque Pilote (démo)', false);
    }
    case 'EXPEDIE':
    case 'EN_PREPARATION':
    case 'ACHETE': {
      const unplanned = o.deliveries.find((d) => d.status === 'A_PLANIFIER');
      if (unplanned && s !== 'EXPEDIE') return mk(`Choisissez votre créneau de livraison (${unplanned.site.name})`, '/client/livraisons');
      return mk(info.label, '/client/livraisons', 'SOLINK', false);
    }
    case 'PV_A_SIGNER': {
      const pv = o.deliveries.find((d) => d.pv?.status === 'A_SIGNER');
      return pv ? mk(`Signez le PV de livraison (${pv.site.name})`, '/client/livraisons') : mk('Livraison des autres sites en cours', '/client/livraisons', 'SOLINK', false);
    }
    case 'ACTIF': {
      const unpaid = o.contract?.invoices.find((i) => i.status === 'IMPAYEE');
      return unpaid ? mk(`Réglez la facture ${unpaid.ref}`, '/client/factures') : mk('Tout est à jour', '/client/parc', '—', false);
    }
    default:
      return mk(info.label, base, info.owner, false);
  }
}

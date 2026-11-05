/** Modèles pré-approuvés (v4 §12) — aucun message hors modèle. */
export const TEMPLATES: Record<string, { subject: string; body: string }> = {
  OTP: { subject: 'Votre code de connexion SOLINK', body: 'Votre code de connexion SOLINK est {{code}}. Valable 10 minutes.' },
  INVITATION: { subject: 'Invitation SOLINK DaaS', body: '{{inviter}} vous invite à rejoindre {{org}} sur SOLINK DaaS. Connectez-vous : {{link}}' },
  DEVIS_EMIS: { subject: 'Votre devis {{ref}}', body: 'Votre devis {{ref}} est disponible ({{monthly}} TTC/mois). Valable jusqu’au {{validUntil}}.' },
  DEVIS_EXPIRE_J2: { subject: 'Votre devis expire bientôt', body: 'Votre devis {{ref}} expire le {{validUntil}}.' },
  APPROBATION_REQUISE: { subject: 'Approbation requise', body: 'Le devis {{ref}} ({{monthly}} TTC/mois) dépasse le seuil interne et attend votre approbation.' },
  APPROBATION_RESULTAT: { subject: 'Décision de l’approbateur', body: 'Votre devis {{ref}} a été {{result}} par l’approbateur. {{comment}}' },
  DOSSIER_OUVERT: { subject: 'Votre dossier de financement est ouvert', body: 'La commande {{ref}} est créée. Complétez votre dossier de financement.' },
  PIECE_A_REPRENDRE: { subject: 'Pièce à reprendre', body: 'La pièce « {{piece}} » est à reprendre : {{motif}}. Téléversez une nouvelle version.' },
  DOSSIER_INACTIF: { subject: 'Votre dossier vous attend', body: 'Prochaine action pour {{ref}} : {{action}}.' },
  DOSSIER_SOUMIS_SOLINK: { subject: 'Dossier à pré-contrôler', body: 'Le dossier {{ref}} ({{org}}) est soumis et attend le pré-contrôle.' },
  DOSSIER_TRANSMIS: { subject: 'Dossier transmis à la banque', body: 'Votre dossier {{ref}} a été transmis à {{financer}}.' },
  DOSSIER_A_INSTRUIRE: { subject: 'Nouveau dossier à instruire', body: 'Le dossier {{ref}} ({{org}}, {{amount}}) est transmis. SLA : {{sla}}.' },
  PIECES_COMPLEMENTAIRES: { subject: 'La banque demande un complément', body: 'La banque demande : {{pieces}} — avant le {{due}}.' },
  DECISION: { subject: 'Décision de financement', body: 'Décision pour {{ref}} : {{result}}. Prochaine étape : {{next}}.' },
  DECISION_ORANGE: { subject: 'Statut d’un apport', body: 'Votre apport {{org}} ({{ref}}) : {{result}}.' },
  SIGNATURE_A_FAIRE: { subject: 'Signature électronique', body: 'Vous êtes invité(e) à signer le contrat {{ref}} : {{link}}' },
  CONTRESIGNATURE: { subject: 'Contre-signature attendue', body: 'Le client a signé le contrat {{ref}}. Votre contre-signature est attendue.' },
  DEPOT_MANDAT: { subject: 'Dépôt de garantie et mandat', body: 'Dépôt de garantie {{amount}} à virer au compte désigné par la banque, référence {{depositRef}}. Activez votre mandat de prélèvement.' },
  CREneau: { subject: 'Livraison planifiée', body: 'Livraison sur le site {{site}} le {{slot}}.' },
  EXPEDITION: { subject: 'Expédition en cours', body: 'Vos équipements pour le site {{site}} sont en route ({{slot}}).' },
  PV_A_SIGNER: { subject: 'PV de livraison à signer', body: 'Confirmez la réception sur le site {{site}} : {{link}}' },
  DECAISSEMENT_DEMANDE: { subject: 'Demande de décaissement', body: 'Demande de décaissement {{ref}} de {{amount}} pour le contrat {{contract}}.' },
  DECAISSEMENT_PAYE: { subject: 'Décaissement payé', body: 'Le décaissement {{ref}} ({{amount}}) a été payé. Contrat {{contract}} actif.' },
  FACTURE_EMISE: { subject: 'Facture Orange {{ref}}', body: 'Votre facture {{ref}} de {{amount}} est émise. Échéance : {{due}}.' },
  IMPAYE_RAPPEL: { subject: 'Rappel de paiement', body: 'Rappel : la facture {{ref}} ({{amount}}) arrivée à échéance le {{due}} reste impayée.' },
  IMPAYE_RELANCE: { subject: 'Relance de paiement', body: 'Relance : la facture {{ref}} ({{amount}}) est impayée depuis {{days}} jours.' },
  IMPAYE_PROPOSITION_VERROUILLAGE: { subject: 'Proposition de verrouillage', body: 'Impayé J+{{days}} sur {{contract}} ({{amount}}). Verrouillage MDM proposé : décision banque requise.' },
  IMPAYE_PRE_VERROUILLAGE_CLIENT: { subject: 'Risque de verrouillage', body: 'Sans régularisation de la facture {{ref}}, vos équipements pourront être verrouillés sur décision de la banque.' },
  IMPAYE_MISE_EN_DEMEURE: { subject: 'Mise en demeure', body: 'Mise en demeure de régler la facture {{ref}} ({{amount}}).' },
  IMPAYE_PROPOSITION_RESILIATION: { subject: 'Proposition de résiliation', body: 'Impayé J+{{days}} sur {{contract}}. Résiliation proposée à la banque.' },
  VERROUILLAGE_ORDONNE: { subject: 'Ordre de verrouillage', body: 'La banque ordonne le verrouillage des équipements du contrat {{contract}}. Exécution MDM requise.' },
  VERROUILLAGE_EXECUTE: { subject: 'Équipements verrouillés', body: 'Vos équipements du contrat {{contract}} ont été verrouillés suite à l’impayé {{ref}}.' },
  REGULARISATION: { subject: 'Paiement reçu', body: 'Paiement de {{amount}} reçu pour la facture {{ref}}. Merci.' },
  DEVERROUILLAGE: { subject: 'Équipements déverrouillés', body: 'Régularisation constatée : vos équipements du contrat {{contract}} sont déverrouillés.' },
  ENVELOPPE_ALERTE: { subject: 'Alerte enveloppe', body: 'L’enveloppe {{name}} n’a plus que {{pct}} % disponibles ({{available}}).' },
  TICKET: { subject: 'Ticket {{ref}}', body: 'Ticket {{ref}} : {{subject}} — statut {{status}}.' },
  FIN_DE_CONTRAT: { subject: 'Fin de contrat', body: 'Le contrat {{contract}} arrive à échéance : organisez la restitution de vos équipements.' },
  RENOUVELLEMENT: { subject: 'Renouvellement de parc', body: 'Votre contrat {{contract}} se termine dans 120 jours : découvrez nos offres de renouvellement.' },
  SLA_DEPASSE: { subject: 'SLA dépassé', body: 'Le dossier {{ref}} dépasse le SLA de l’état « {{state}} ». Escalade : {{to}}.' },
  MESSAGE_DOSSIER: { subject: 'Nouveau message', body: '{{author}} : {{body}}' },
  ECHANTILLON: { subject: 'Accord auto échantillonné', body: 'L’accord automatique {{ref}} fait partie de l’échantillon de contrôle a posteriori.' },
  LEAD_INVITATION: { subject: 'Votre conseiller Orange Business vous invite', body: '{{commercial}} (Orange Business) vous invite à équiper {{org}} avec SOLINK DaaS : {{link}}' },
};

export function render(template: string, vars: Record<string, string | number>): { subject: string; body: string } {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`Modèle de message inconnu : ${template}`);
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
  return { subject: fill(t.subject), body: fill(t.body) };
}

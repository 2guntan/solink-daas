/** Interface Ocr — extraction de champs proposés au client (qui confirme). Simulation déterministe. */
export interface OcrField {
  key: string;
  label: string;
  value: string;
  confidence: number;
}

export interface Ocr {
  extract(input: { type: string; org: { name: string; ninea?: string | null; rccm?: string | null }; personName?: string; today: Date }): Promise<{
    fields: OcrField[];
    quality: { readable: boolean; blurry: boolean; pages: number };
  }>;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const simOcr: Ocr = {
  async extract({ type, org, personName, today }) {
    const base: OcrField[] = [];
    const f = (key: string, label: string, value: string, confidence = 0.93) => base.push({ key, label, value, confidence });
    switch (type) {
      case 'RCCM':
        f('raison_sociale', 'Raison sociale', org.name, 0.97);
        f('rccm', 'N° RCCM', org.rccm ?? 'SN-DKR-DEMO', 0.95);
        f('date_extrait', 'Date de l’extrait', iso(new Date(today.getTime() - 20 * 86400000)), 0.9);
        break;
      case 'NINEA':
        f('raison_sociale', 'Raison sociale', org.name, 0.97);
        f('ninea', 'NINEA', org.ninea ?? '', 0.96);
        break;
      case 'CNI_DIRIGEANT':
        f('nom', 'Nom et prénom', personName ?? 'DÉMO Dirigeant', 0.91);
        f('numero', 'N° de pièce', '1 751 1990 DEMO', 0.88);
        f('expiration', 'Date d’expiration', iso(new Date(today.getTime() + 900 * 86400000)), 0.86);
        break;
      case 'ETATS_FIN_N1':
      case 'ETATS_FIN_N2':
      case 'ETATS_FIN_N3':
        f('exercice', 'Exercice', String(today.getUTCFullYear() - Number(type.slice(-1))), 0.95);
        f('liasse', 'Type de liasse', 'SYSCOHADA — système normal', 0.9);
        break;
      case 'RIB':
        f('titulaire', 'Titulaire', org.name, 0.95);
        f('iban', 'IBAN', 'SN08 SN000 01234 567890123456 DEMO', 0.92);
        break;
      default:
        f('document', 'Type détecté', type.replace(/_/g, ' ').toLowerCase(), 0.8);
        f('date_document', 'Date du document', iso(new Date(today.getTime() - 10 * 86400000)), 0.8);
    }
    return { fields: base, quality: { readable: true, blurry: false, pages: 1 } };
  },
};

export const ocr: Ocr = simOcr;

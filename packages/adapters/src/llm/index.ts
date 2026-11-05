/**
 * Interface Llm — implémentation DÉTERMINISTE (modèles de texte). Aucune décision, aucune signature,
 * aucun mouvement de fonds (garde-fou v4 §15). Toute sortie est étiquetée « générée automatiquement, à vérifier ».
 */
export interface SynthesisInput {
  orgName: string;
  segment: string;
  sector: string | null;
  ageYears: number;
  need: string;
  amount: string;
  monthly: string;
  duration: number;
  score: number;
  riskClass: string;
  factors: { label: string; points: number; max: number; detail: string }[];
  knockouts: string[];
  documents: { label: string; status: string }[];
}

export interface Llm {
  analystSynthesis(input: SynthesisInput): Promise<{ text: string[]; disclaimer: string }>;
  recommendOffer(answers: { metier: string; mobilite: string; applications: string }): Promise<{ offer: string; range: string; explanation: string }>;
}

export const AI_DISCLAIMER = 'Générée automatiquement par l’assistant (modèle déterministe) — à vérifier. Aucune valeur de décision.';

export const simLlm: Llm = {
  async analystSynthesis(i) {
    const strong = i.factors.filter((f) => f.points >= f.max * 0.7).map((f) => f.label.toLowerCase());
    const weak = i.factors.filter((f) => f.points < f.max * 0.4).map((f) => f.label.toLowerCase());
    const text = [
      `${i.orgName} (${i.segment}${i.sector ? `, secteur ${i.sector}` : ''}) — ${i.ageYears} ans d’existence.`,
      `Besoin : ${i.need}. Montant financé ${i.amount}, mensualité ${i.monthly} TTC sur ${i.duration} mois.`,
      `Score calculé par la grille du financeur : ${i.score}/100 (classe ${i.riskClass}).`,
      strong.length ? `Points forts relevés : ${strong.join(', ')}.` : 'Aucun point fort marqué selon la grille.',
      weak.length ? `Points de vigilance : ${weak.join(', ')}.` : 'Pas de point de vigilance majeur selon la grille.',
      i.knockouts.length ? `Critères bloquants détectés : ${i.knockouts.join(' ; ')}.` : 'Aucun critère bloquant (knock-out) détecté.',
      `Pièces : ${i.documents.filter((d) => d.status === 'VALIDEE').length}/${i.documents.length} validées par SOLINK (complétude uniquement, sans avis de crédit).`,
    ];
    return { text, disclaimer: AI_DISCLAIMER };
  },
  async recommendOffer(a) {
    const mobile = a.mobilite === 'oui' || a.mobilite === 'souvent';
    const lourd = a.applications === 'lourdes';
    const sedentaire = a.mobilite === 'non';
    let offer = mobile ? 'POSTE_MOBILE' : sedentaire ? 'BUREAU_CLOUD' : 'HYBRIDE';
    if (a.metier === 'guichet' || a.metier === 'centre_appels') offer = 'BUREAU_CLOUD';
    const range = lourd ? 'PREMIUM' : a.metier === 'direction' ? 'PREMIUM' : mobile ? 'PRO' : 'ESSENTIAL';
    const label: Record<string, string> = { BUREAU_CLOUD: 'Bureau cloud', POSTE_MOBILE: 'Poste mobile', HYBRIDE: 'Hybride' };
    return {
      offer,
      range,
      explanation: `D’après vos réponses (règles déterministes), l’offre ${label[offer]} en gamme ${range.charAt(0) + range.slice(1).toLowerCase()} correspond le mieux : ${
        offer === 'BUREAU_CLOUD' ? 'postes fixes, données centralisées dans le cloud Orange' : offer === 'POSTE_MOBILE' ? 'collaborateurs mobiles avec un portable managé' : 'un mix de postes fixes et mobiles'
      }.`,
    };
  },
};

export const llm: Llm = simLlm;

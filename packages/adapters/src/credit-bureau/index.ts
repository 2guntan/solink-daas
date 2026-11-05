/** Interface CreditBureau (BIC — Creditinfo VoLo). Simulation : réponse déterministe par NINEA. */
export type BicResult = 'AUCUN_INCIDENT' | 'INCIDENT_MINEUR' | 'INCIDENT_GRAVE';

export interface CreditBureau {
  lookup(ninea: string): Promise<{ result: BicResult; reference: string; consultedAt: string }>;
}

/** Table de seed (NINEA fictifs « DÉMO »). Par défaut : AUCUN_INCIDENT. */
export const BIC_TABLE: Record<string, BicResult> = {
  'DEMO-0012345-2A1': 'AUCUN_INCIDENT', // Assurances Teranga
  'DEMO-0023456-2B2': 'AUCUN_INCIDENT', // Microfinance Baobab
  'DEMO-0034567-2C3': 'INCIDENT_MINEUR', // ONG Sahel Santé
  'DEMO-0045678-2D4': 'INCIDENT_MINEUR', // PME Logistique Ndar
  'DEMO-0056789-2E5': 'AUCUN_INCIDENT', // Call Center Atlantique
  'DEMO-0099999-9Z9': 'INCIDENT_GRAVE', // NINEA de test knock-out
};

export const simCreditBureau: CreditBureau = {
  async lookup(ninea) {
    return {
      result: BIC_TABLE[ninea] ?? 'AUCUN_INCIDENT',
      reference: `BIC-SIM-${ninea}`,
      consultedAt: new Date().toISOString(),
    };
  },
};

export const creditBureau: CreditBureau = simCreditBureau;

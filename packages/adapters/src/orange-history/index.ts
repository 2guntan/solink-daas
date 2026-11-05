/** Interface OrangeHistory — score de paiement 0–100 par NINEA (simulation : table de seed). */
export interface OrangeHistory {
  paymentScore(ninea: string): Promise<number | null>;
}

export const ORANGE_SCORES: Record<string, number> = {
  'DEMO-0012345-2A1': 95,
  'DEMO-0023456-2B2': 80,
  'DEMO-0034567-2C3': 60,
  'DEMO-0045678-2D4': 70,
  'DEMO-0056789-2E5': 90,
};

export const simOrangeHistory: OrangeHistory = {
  async paymentScore(ninea) {
    return ORANGE_SCORES[ninea] ?? null;
  },
};

export const orangeHistory: OrangeHistory = simOrangeHistory;

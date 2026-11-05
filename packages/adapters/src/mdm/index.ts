/**
 * Interface Mdm (Intune / Autopilot). Simulation : statuts simulés, actions journalisées par core.
 * Verrouiller / effacer ne s'exécute qu'après un ordre banque (contrôlé dans core/services/collections).
 */
export interface Mdm {
  enroll(serial: string): Promise<{ mdmId: string; status: 'ENROLE' }>;
  lock(mdmId: string): Promise<{ ok: true }>;
  unlock(mdmId: string): Promise<{ ok: true }>;
  wipe(mdmId: string): Promise<{ ok: true }>;
}

export const simMdm: Mdm = {
  async enroll(serial) {
    return { mdmId: `INTUNE-SIM-${serial}`, status: 'ENROLE' };
  },
  async lock() {
    return { ok: true };
  },
  async unlock() {
    return { ok: true };
  },
  async wipe() {
    return { ok: true };
  },
};

export const mdm: Mdm = simMdm;

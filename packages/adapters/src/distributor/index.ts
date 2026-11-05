import { createHash } from 'node:crypto';

/** Interface Distributor — BC (PDF généré par core) + réception simulée (séries + hash Autopilot fictifs). */
export interface ReceivedUnit {
  sku: string;
  serial: string;
  autopilotHash: string | null;
}

export interface Distributor {
  simulateReception(poRef: string, lines: { sku: string; quantity: number; autopilot: boolean }[]): Promise<ReceivedUnit[]>;
}

export const simDistributor: Distributor = {
  async simulateReception(poRef, lines) {
    const out: ReceivedUnit[] = [];
    let n = 0;
    for (const l of lines) {
      for (let i = 0; i < l.quantity; i++) {
        n++;
        const serial = `SN-${poRef.replace(/[^0-9]/g, '').slice(-7)}-${String(n).padStart(4, '0')}`;
        out.push({
          sku: l.sku,
          serial,
          autopilotHash: l.autopilot ? createHash('sha256').update(`autopilot:${serial}`).digest('base64').slice(0, 44) : null,
        });
      }
    }
    return out;
  },
};

export const distributor: Distributor = simDistributor;

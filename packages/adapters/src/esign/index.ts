import { randomUUID } from 'node:crypto';

/**
 * Interface ESign (prestataire de signature avancée). Simulation : page interne /signer/[token],
 * OTP, PDF signé (tampon + horodatage + hash) généré par core, dossier de preuve JSON,
 * webhooks signer_done / signature_request_done postés sur /api/webhooks/esign.
 */
export interface ESignRequest {
  contractRef: string;
  documents: { id: string; title: string; sha256: string }[];
  signers: { userId: string; name: string; order: number; role: string }[];
  expiresAt: Date;
}

export interface ESign {
  createRequest(req: ESignRequest): Promise<{ providerRef: string; tokens: Record<string, string> }>;
  proof(input: {
    providerRef: string;
    contractRef: string;
    signers: { name: string; role: string; signedAt: string; ip: string | null; otpVerified: boolean }[];
    documents: { title: string; sha256: string; signedSha256: string }[];
  }): Record<string, unknown>;
}

export const simESign: ESign = {
  async createRequest(req) {
    const providerRef = `ESIGN-SIM-${randomUUID().slice(0, 8).toUpperCase()}`;
    const tokens: Record<string, string> = {};
    for (const s of req.signers) tokens[`${s.userId}:${s.role}`] = randomUUID().replace(/-/g, '');
    return { providerRef, tokens };
  },
  proof(input) {
    return {
      provider: 'SIMULATION SOLINK (démo) — signature électronique avancée',
      providerRef: input.providerRef,
      contract: input.contractRef,
      method: 'OTP SMS/WhatsApp',
      signers: input.signers,
      documents: input.documents,
      legalFramework: 'Loi n° 2008-08 sur les transactions électroniques (Sénégal) — à confirmer par avis juridique',
      generatedAt: new Date().toISOString(),
    };
  },
};

export const esign: ESign = simESign;

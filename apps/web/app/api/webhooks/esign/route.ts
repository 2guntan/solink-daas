import { prisma } from '@solink/db';
import { SYSTEM, svc } from '@solink/core';

/** Webhooks du prestataire e-sign simulé : signer_done / signature_request_done (HMAC). */
export async function POST(req: Request) {
  const body = await req.text();
  if (!svc.verifySignature(req.headers.get('x-esign-signature'), body)) return Response.json({ error: { code: 'SIGNATURE_INVALIDE', message: 'Signature invalide' } }, { status: 401 });
  const evt = JSON.parse(body) as { type: string; providerRef: string; signerId?: string };
  const r = await svc.run(SYSTEM, (ctx) => svc.handleEsignEvent(ctx, evt));
  void prisma;
  return Response.json({ ok: true, ...r });
}

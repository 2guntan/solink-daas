'use server';

import { appUrl } from '@solink/adapters';
import { SYSTEM, svc } from '@solink/core';
import { prisma } from '@solink/db';
import { act, requestMeta, str, type ActionResult } from '@/lib/action';

export async function sendSignOtpAction(_: ActionResult | null, f: FormData) {
  return act(null, async (ctx) => {
    await svc.sendSigningOtp(ctx, str(f, 'token'));
    return { ok: true, message: 'Code envoyé par SMS (voir la Boîte de démo).' };
  });
}

/** Signature puis webhook e-sign (signer_done / signature_request_done) posté sur /api/webhooks/esign. */
export async function signAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const meta = await requestMeta();
  const token = str(f, 'token');
  if (f.get('lu') !== 'on') return { ok: false, error: 'Confirmez avoir pris connaissance des documents' };
  const res = await act(null, async (ctx) => {
    const r = await svc.signWithToken(ctx, token, str(f, 'otp'), meta.ip);
    return { ok: true, data: r };
  });
  if (!res.ok) return res;
  const r = res.data as { providerRef: string; signerId: string };
  const signer = await prisma.signer.findUniqueOrThrow({ where: { id: r.signerId }, include: { ceremony: { include: { contract: true } } } });
  const body = JSON.stringify({ type: signer.role === 'BANQUE' ? 'signature_request_done' : 'signer_done', providerRef: r.providerRef, signerId: r.signerId });
  const ts = Math.floor(Date.now() / 1000);
  let delivered = false;
  try {
    const resp = await fetch(`${appUrl()}/api/webhooks/esign`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-esign-signature': svc.signPayload(body, ts) }, body, signal: AbortSignal.timeout(20000) });
    delivered = resp.ok;
  } catch {
    delivered = false;
  }
  if (!delivered) await svc.run(SYSTEM, (ctx) => svc.handleEsignEvent(ctx, JSON.parse(body)));
  const orderId = signer.ceremony.contract.orderId;
  return { ok: true, message: 'Document(s) signé(s).', redirect: signer.role === 'BANQUE' ? `/banque/dossiers/${orderId}` : `/client/commandes/${orderId}/signature` };
}

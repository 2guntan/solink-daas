import { prisma } from '@solink/db';
import { svc } from '@solink/core';

/** URL de test interne recevant les webhooks signés (vérification HMAC + anti-rejeu). */
export async function POST(req: Request) {
  const body = await req.text();
  const ok = svc.verifySignature(req.headers.get('x-solink-signature'), body);
  const id = req.headers.get('x-solink-delivery');
  if (id) await prisma.webhookDelivery.updateMany({ where: { id }, data: { verified: ok, status: ok ? 200 : 401 } });
  return Response.json({ received: ok }, { status: ok ? 200 : 401 });
}

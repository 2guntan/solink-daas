import { appUrl } from '@solink/adapters';
import { hmacSha256 } from '../hash';
import type { Ctx } from './context';

/**
 * Webhooks émis vers le financeur (v4 §14.2), signés HMAC : X-Solink-Signature: t=<ts>,sha256=<hex>
 * (signature de `${ts}.${body}`). URL de test interne : /api/demo/webhook-sink.
 */
export const WEBHOOK_SINK_PATH = '/api/demo/webhook-sink';
export const webhookSecret = () => process.env.WEBHOOK_SECRET ?? 'whsec_demo_secret';

export function signPayload(body: string, ts: number, secret = webhookSecret()) {
  return `t=${ts},sha256=${hmacSha256(secret, `${ts}.${body}`)}`;
}

export function verifySignature(header: string | null, body: string, secret = webhookSecret(), toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const m = /^t=(\d+),sha256=([a-f0-9]{64})$/.exec(header);
  if (!m) return false;
  const ts = Number(m[1]);
  if (Math.abs(nowSec - ts) > toleranceSec) return false;
  return hmacSha256(secret, `${ts}.${body}`) === m[2];
}

export async function emitWebhook(ctx: Ctx, event: string, data: Record<string, unknown>) {
  const ts = Math.floor(Date.now() / 1000);
  const payload = { event, created_at: ctx.at.toISOString(), data };
  const body = JSON.stringify(payload);
  const signature = signPayload(body, ts);
  const url = `${appUrl()}${WEBHOOK_SINK_PATH}`;
  const rec = await ctx.db.webhookDelivery.create({ data: { event, url, payload: payload as object, signature, timestamp: ts, at: ctx.at } });
  ctx.after.push(async () => {
    if (process.env.WEBHOOKS_DISABLED === 'true') return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-solink-signature': signature, 'x-solink-delivery': rec.id },
        body,
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      /* serveur indisponible (seed / tests) : la livraison reste tracée en base */
    }
  });
}

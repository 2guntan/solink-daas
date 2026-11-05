import type { Tx } from '@solink/db';
import { canonical, sha256 } from './hash';
import { now } from './clock';

/**
 * Journal d'audit chaîné (v4 P7). hash = sha256(prevHash|entity|entityId|action|actor|payloadHash|at).
 * Un verrou consultatif sérialise les écritures pour garantir la chaîne.
 */
export async function audit(
  db: Tx,
  entity: string,
  entityId: string,
  action: string,
  actorId: string,
  payload: Record<string, unknown> = {},
): Promise<{ hash: string }> {
  await db.$executeRawUnsafe('SELECT pg_advisory_xact_lock(424242)');
  const prev = await db.auditEvent.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
  const at = await now(db);
  const payloadHash = sha256(canonical(payload));
  const prevHash = prev?.hash ?? null;
  const hash = sha256([prevHash ?? 'GENESIS', entity, entityId, action, actorId, payloadHash, at.toISOString()].join('|'));
  await db.auditEvent.create({
    data: { entity, entityId, action, actorId, payloadHash, payload: payload as object, prevHash, hash, at },
  });
  return { hash };
}

export async function verifyAuditChain(db: Tx): Promise<{ ok: boolean; count: number; brokenAt?: number }> {
  const events = await db.auditEvent.findMany({ orderBy: { seq: 'asc' } });
  let prev: string | null = null;
  for (const e of events) {
    const expected = sha256(
      [prev ?? 'GENESIS', e.entity, e.entityId, e.action, e.actorId, e.payloadHash, e.at.toISOString()].join('|'),
    );
    if (e.prevHash !== prev || e.hash !== expected) return { ok: false, count: events.length, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, count: events.length };
}

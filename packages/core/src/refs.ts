import type { Tx } from '@solink/db';

/** Références lisibles : PREFIX-AAAA-NNNNN (CMD, DV, CTR, BC, DD, FO, TK…). */
export async function nextRef(db: Tx, prefix: string, year: number, pad = 5): Promise<string> {
  const name = `${prefix}-${year}`;
  const s = await db.sequence.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  });
  return `${prefix}-${year}-${String(s.value).padStart(pad, '0')}`;
}

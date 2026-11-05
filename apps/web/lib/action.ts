import 'server-only';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isBusinessError, svc, type Actor, type Portal } from '@solink/core';
import { requireActor } from './session';

export type ActionResult = { ok: boolean; message?: string; error?: string; redirect?: string; data?: unknown };

/** Enveloppe d'action serveur : session, transaction, erreurs métier en français, revalidation. */
export async function act(
  portal: Portal | null,
  fn: (ctx: svc.Ctx, actor: Actor) => Promise<ActionResult | void>,
  opts: { revalidate?: string } = {},
): Promise<ActionResult> {
  let res: ActionResult;
  try {
    const actor = await requireActor(portal ?? undefined);
    res = (await svc.run(actor, (ctx) => fn(ctx, actor))) ?? { ok: true };
    revalidatePath(opts.revalidate ?? '/', 'layout');
  } catch (e) {
    if (isBusinessError(e)) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: string }).digest).startsWith('NEXT_REDIRECT')) throw e;
    console.error(e);
    return { ok: false, error: 'Une erreur inattendue est survenue. Réessayez.' };
  }
  // Redirection côté serveur : fiable même si la page re-rendue ne contient plus le formulaire.
  if (res.ok && res.redirect) redirect(res.redirect);
  return res;
}

export async function requestMeta() {
  const h = await headers();
  return { ip: h.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1', userAgent: h.get('user-agent') ?? 'inconnu' };
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
export const int = (f: FormData, k: string) => {
  const v = Number(String(f.get(k) ?? '').replace(/\s/g, ''));
  return Number.isFinite(v) ? Math.round(v) : 0;
};

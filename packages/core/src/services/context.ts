import { prisma, type Role, type Tx } from '@solink/db';
import { messaging } from '@solink/adapters';
import type { Channel } from '@solink/db';
import type { Actor } from '../authz';
import { now } from '../clock';
import { getParams, type Params } from '../params';

export interface Ctx {
  db: Tx;
  actor: Actor;
  at: Date;
  params: Params & { __version: string };
  /** Actions exécutées après validation de la transaction (webhooks, files de tâches). */
  after: (() => Promise<void>)[];
}

/** Exécute un cas d'usage dans une transaction (timeout long : génération PDF / zip). */
export async function run<T>(actor: Actor, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const after: (() => Promise<void>)[] = [];
  const result = await prisma.$transaction(
    async (db) => {
      const at = await now(db);
      const params = await getParams(db);
      return fn({ db, actor, at, params, after });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  for (const f of after) {
    try {
      await f();
    } catch (e) {
      console.error('[after-commit]', e);
    }
  }
  return result;
}

/** Notifie tous les membres d'une organisation ayant l'un des rôles donnés. */
export async function notifyRoles(
  ctx: Ctx,
  orgId: string,
  roles: Role[] | 'ALL',
  template: string,
  vars: Record<string, string | number>,
  link?: string,
  channels: Channel[] = ['EMAIL', 'WHATSAPP'],
) {
  const members = await ctx.db.membership.findMany({ where: { organisationId: orgId }, include: { user: true } });
  const targets = members.filter((m) => roles === 'ALL' || m.roles.some((r) => roles.includes(r)));
  for (const m of targets) await messaging.send(ctx.db, { to: m.user.email, channels, template, vars, link, at: ctx.at });
  return targets.length;
}

export async function notifyUser(
  ctx: Ctx,
  userId: string,
  template: string,
  vars: Record<string, string | number>,
  link?: string,
  channels: Channel[] = ['EMAIL', 'WHATSAPP'],
) {
  const u = await ctx.db.user.findUnique({ where: { id: userId } });
  if (u) await messaging.send(ctx.db, { to: u.email, channels, template, vars, link, at: ctx.at });
}

export async function orgByType(db: Tx, type: 'OPERATEUR' | 'APPORTEUR' | 'FINANCEUR' | 'REFINANCEUR') {
  const o = await db.organisation.findFirst({ where: { type } });
  if (!o) throw new Error(`Organisation ${type} absente du seed`);
  return o;
}

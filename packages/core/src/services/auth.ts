import { prisma, type Role } from '@solink/db';
import { isDemo, messaging } from '@solink/adapters';
import { BusinessError } from '../errors';
import { now, addDays } from '../clock';
import { randomOtp } from '../hash';
import { audit } from '../audit';
import type { Actor } from '../authz';

/** E02 — OTP 6 chiffres, validité 10 min, 5 tentatives. En démo, 000000 est toujours accepté. */
export async function requestOtp(identifier: string) {
  const email = identifier.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new BusinessError('COMPTE_INCONNU', 'Aucun compte pour cet identifiant (voir les comptes de démo)', 404);
  const at = await now(prisma);
  const code = randomOtp();
  await prisma.otpCode.create({ data: { identifier: email, code, expiresAt: addDays(at, 10 / 1440) } });
  await messaging.send(prisma, { to: email, channels: ['EMAIL', 'SMS'], template: 'OTP', vars: { code }, at });
  return { sent: true };
}

export async function verifyOtp(identifier: string, code: string) {
  const email = identifier.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
  if (!user) throw new BusinessError('COMPTE_INCONNU', 'Compte inconnu', 404);
  const at = await now(prisma);
  if (!(isDemo() && code === '000000')) {
    const otp = await prisma.otpCode.findFirst({ where: { identifier: email, usedAt: null, purpose: 'LOGIN' }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < at) throw new BusinessError('OTP_EXPIRE', 'Code expiré : demandez un nouveau code', 400);
    if (otp.attempts >= 5) throw new BusinessError('OTP_BLOQUE', 'Trop de tentatives : demandez un nouveau code', 400);
    if (otp.code !== code) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BusinessError('OTP_INVALIDE', 'Code incorrect', 400);
    }
    await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: at } });
  }
  if (!user.memberships.length) throw new BusinessError('SANS_ORGANISATION', 'Compte sans organisation', 403);
  await prisma.$transaction(async (tx) => audit(tx, 'User', user.id, 'CONNEXION', user.id, { method: 'OTP' }));
  return { userId: user.id, orgId: user.memberships[0].organisationId };
}

export async function loadActor(userId: string, orgId?: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { memberships: { include: { organisation: true } } } });
  if (!user) return null;
  const m = user.memberships.find((x) => x.organisationId === orgId) ?? user.memberships[0];
  if (!m) return null;
  return { userId: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, orgId: m.organisationId, orgType: m.organisation.type, roles: m.roles as Role[] };
}

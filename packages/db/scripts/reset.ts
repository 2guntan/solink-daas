/**
 * pnpm db:reset = drop + migrate + seed (CLAUDE.md §6).
 * Garde-fou : refuse toute base qui n'est pas locale (localhost / 127.0.0.1 / postgres de docker compose),
 * sauf ALLOW_REMOTE_DB_RESET=true. Ne jamais lancer contre une base de production.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
const LOCAL = ['localhost', '127.0.0.1', '::1', 'postgres'];
if (!LOCAL.includes(host) && process.env.ALLOW_REMOTE_DB_RESET !== 'true') {
  console.error(`✖ db:reset refusé : la base « ${host} » n'est pas locale.`);
  process.exit(1);
}

async function main() {
  const db = new PrismaClient();
  console.log(`▶ Réinitialisation de la base locale ${host}…`);
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await db.$executeRawUnsafe('CREATE SCHEMA public');
  await db.$disconnect();
  execSync('prisma migrate deploy', { stdio: 'inherit' });
  execSync('tsx prisma/seed.ts', { stdio: 'inherit' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

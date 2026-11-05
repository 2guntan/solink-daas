import PgBoss from 'pg-boss';
import { svc } from '@solink/core';

/** File de tâches pg-boss : `scheduler-tick` toutes les 5 minutes (factures, relances, SLA, expirations). */
export async function startJobs() {
  if (process.env.PGBOSS_DISABLED === 'true') return;
  try {
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!.replace(/\?schema=public$/, '') });
    boss.on('error', (e: Error) => console.error('[pg-boss]', e.message));
    await boss.start();
    await boss.createQueue('scheduler-tick').catch(() => undefined);
    await boss.schedule('scheduler-tick', '*/5 * * * *', {}, { tz: 'Africa/Dakar' });
    await boss.work('scheduler-tick', async () => {
      const r = await svc.runScheduler();
      console.log('[pg-boss] scheduler-tick', JSON.stringify(r));
    });
    console.log('[pg-boss] démarré — file scheduler-tick');
  } catch (e) {
    console.error('[pg-boss] non démarré :', (e as Error).message);
  }
}

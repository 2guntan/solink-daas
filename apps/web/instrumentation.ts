/** Démarrage serveur (runtime Node uniquement) : file de tâches pg-boss dans PostgreSQL. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobs } = await import('./instrumentation-node');
    await startJobs();
  }
}

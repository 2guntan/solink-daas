'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-slate-600">Nous n’avons pas pu afficher cette page. Réessayez dans un instant.</p>
      <button className="mt-4 rounded bg-primary px-4 py-2 text-white" onClick={() => reset()}>Réessayer</button>
    </main>
  );
}

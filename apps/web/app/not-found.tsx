import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-600">La page demandée n’existe pas ou n’est plus disponible.</p>
      <Link href="/" className="mt-4 inline-block">Retour à l’accueil</Link>
    </main>
  );
}

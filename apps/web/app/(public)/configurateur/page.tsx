import Link from 'next/link';
import { PageHeader } from '@solink/ui';
import { Catalogue } from '@/components/catalogue';

export const metadata = { title: 'Configurateur' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <Link href="/" className="text-sm">← Accueil</Link>
      <PageHeader title="Catalogue et configurateur" description="Sans compte : votre compte ne sera demandé qu’au moment d’enregistrer le panier." />
      <Catalogue basePath="/configurateur" sp={await searchParams} />
    </main>
  );
}

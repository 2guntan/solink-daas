import { PageHeader } from '@solink/ui';
import { Catalogue } from '@/components/catalogue';
import { PublicHeader } from '@/components/public-header';

export const metadata = { title: 'Configurateur' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader eyebrow="Sans compte" title="Catalogue et configurateur" description="Votre compte ne sera demandé qu’au moment d’enregistrer le panier." />
        <Catalogue basePath="/configurateur" sp={await searchParams} />
      </main>
    </>
  );
}

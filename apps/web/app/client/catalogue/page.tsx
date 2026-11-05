import { PageHeader } from '@solink/ui';
import { Catalogue } from '@/components/catalogue';
export const metadata = { title: 'Catalogue' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <div>
      <PageHeader title="Catalogue" description="Mensualité TTC tout compris par poste (loyer matériel, services SOLINK et Orange, assurance, TVA)." />
      <Catalogue basePath="/client/catalogue" sp={await searchParams} />
    </div>
  );
}

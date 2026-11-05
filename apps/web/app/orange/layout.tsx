import { PortalShell } from '@/components/portal-shell';
import { requireActor } from '@/lib/session';

const NAV = [
  { href: '/orange', label: 'Mes apports' },
  { href: '/orange/leads', label: 'Leads & invitations' },
  { href: '/orange/commissions', label: 'Commissions' },
  { href: '/orange/facturation', label: 'Facturation 2 lignes' },
  { href: '/orange/configurateur', label: 'Configurateur RDV' },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('orange');
  return <PortalShell portal="orange" actor={actor} nav={NAV}>{children}</PortalShell>;
}

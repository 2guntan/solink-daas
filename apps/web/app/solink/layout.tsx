import { PortalShell } from '@/components/portal-shell';
import { requireActor } from '@/lib/session';

const NAV = [
  { href: '/solink', label: 'Pipeline' },
  { href: '/solink/conavigation', label: 'Co-navigation' },
  { href: '/solink/catalogue', label: 'Catalogue & prix' },
  { href: '/solink/achats', label: 'Achats & réception' },
  { href: '/solink/logistique', label: 'Livraisons & PV' },
  { href: '/solink/decaissements', label: 'Décaissements' },
  { href: '/solink/parc', label: 'Parc & MDM' },
  { href: '/solink/tickets', label: 'Tickets' },
  { href: '/solink/facturation', label: 'Facturation' },
  { href: '/solink/admin', label: 'Administration' },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('solink');
  return <PortalShell portal="solink" actor={actor} nav={NAV}>{children}</PortalShell>;
}

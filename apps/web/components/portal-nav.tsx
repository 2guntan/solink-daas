'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@solink/ui';
import type { NavItem } from './portal-shell';

/** Navigation du portail : lien actif souligné d'un filet d'encre, défilement horizontal sur mobile. */
export function PortalNav({ items, root }: { items: NavItem[]; root: string }) {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mb-px overflow-x-auto" aria-label="Navigation du portail">
      <ul className="flex gap-1 whitespace-nowrap">
        {items.map((n) => {
          const active = n.href === root ? pathname === root : pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative block px-3 py-3 text-[13px] font-medium no-underline transition-colors hover:no-underline',
                  active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
                  active && 'after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-neutral-900',
                )}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

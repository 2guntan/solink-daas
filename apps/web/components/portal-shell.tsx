import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROLE_LABEL, type Actor } from '@solink/core';
import { prisma } from '@solink/db';
import { logout } from '@/app/demo-actions';

export interface NavItem {
  href: string;
  label: string;
}

const TITLES = { client: 'Espace Client', solink: 'Back-office SOLINK', banque: 'Portail Financeur', orange: 'Portail Orange', refinanceur: 'Portail Refinanceur' } as const;

export async function PortalShell({ portal, actor, nav, children }: { portal: keyof typeof TITLES; actor: Actor; nav: NavItem[]; children: ReactNode }) {
  const org = await prisma.organisation.findUnique({ where: { id: actor.orgId } });
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-3">
            <Link href={`/${portal}`} className="font-bold text-primary no-underline">
              SOLINK DaaS
            </Link>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600" data-testid="portal-name">
              {TITLES[portal]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="hidden sm:inline" data-testid="whoami">
              {actor.name} · {org?.name} · {actor.roles.map((r) => ROLE_LABEL[r]).join(', ')}
            </span>
            <form action={logout}>
              <button className="text-primary underline" type="submit">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-2" aria-label="Navigation du portail">
          <ul className="flex gap-1 whitespace-nowrap pb-1 text-sm">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded px-3 py-2 text-slate-700 no-underline hover:bg-slate-100">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}

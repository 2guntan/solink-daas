import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROLE_LABEL, type Actor } from '@solink/core';
import { prisma } from '@solink/db';
import { Avatar } from '@solink/ui';
import { logout } from '@/app/demo-actions';
import { PortalNav } from './portal-nav';
import { Wordmark } from './wordmark';

export interface NavItem {
  href: string;
  label: string;
}

const TITLES = { client: 'Espace Client', solink: 'Back-office SOLINK', banque: 'Portail Financeur', orange: 'Portail Orange', refinanceur: 'Portail Refinanceur' } as const;

export async function PortalShell({ portal, actor, nav, children }: { portal: keyof typeof TITLES; actor: Actor; nav: NavItem[]; children: ReactNode }) {
  const org = await prisma.organisation.findUnique({ where: { id: actor.orgId } });
  const roles = actor.roles.map((r) => ROLE_LABEL[r]).join(', ');
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/${portal}`} className="no-underline hover:no-underline" aria-label="Accueil du portail">
              <Wordmark />
            </Link>
            <span aria-hidden className="h-4 w-px bg-neutral-200" />
            <span className="truncate text-[13px] text-neutral-500" data-testid="portal-name">
              {TITLES[portal]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar name={actor.name} />
              <span className="flex flex-col leading-tight" data-testid="whoami">
                <span className="text-[13px] font-medium text-neutral-900">{actor.name}</span>
                <span className="text-[11px] text-neutral-500">
                  {org?.name} · {roles}
                </span>
              </span>
            </div>
            <form action={logout}>
              <button className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900" type="submit">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <PortalNav items={nav} root={`/${portal}`} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 text-[11px] text-neutral-400 sm:px-6">SOLINK DaaS · plateforme de démonstration, données fictives.</footer>
    </div>
  );
}

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DemoSwitcher({ accounts, current, action }: { accounts: { email: string; label: string; group: string }[]; current?: string; action: (email: string) => Promise<string> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const groups = [...new Set(accounts.map((a) => a.group))];
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="hidden text-neutral-500 sm:inline">Compte</span>
      <select
        data-testid="demo-switch"
        aria-label="Changer de compte de démo"
        className="ui-select h-7 max-w-[210px] rounded-md border border-white/10 bg-white/[0.06] pl-2 text-xs text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 sm:max-w-xs"
        value={current ?? ''}
        disabled={pending}
        onChange={(e) => {
          const email = e.target.value;
          start(async () => {
            const to = await action(email);
            router.push(to);
            router.refresh();
          });
        }}
      >
        <option value="" className="text-neutral-900">— choisir —</option>
        {groups.map((g) => (
          <optgroup key={g} label={g} className="text-neutral-900">
            {accounts
              .filter((a) => a.group === g)
              .map((a) => (
                <option key={a.email} value={a.email} className="text-neutral-900">
                  {a.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

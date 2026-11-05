'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DemoSwitcher({ accounts, current, action }: { accounts: { email: string; label: string; group: string }[]; current?: string; action: (email: string) => Promise<string> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const groups = [...new Set(accounts.map((a) => a.group))];
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="hidden sm:inline">Compte :</span>
      <select
        data-testid="demo-switch"
        aria-label="Changer de compte de démo"
        className="max-w-[210px] rounded border border-amber-400 bg-white px-1 py-1 text-xs text-slate-900 sm:max-w-xs"
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
        <option value="">— choisir —</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {accounts
              .filter((a) => a.group === g)
              .map((a) => (
                <option key={a.email} value={a.email}>
                  {a.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

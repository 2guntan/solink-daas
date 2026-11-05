'use client';

import { useEffect, useMemo, useState } from 'react';
import { DemoBadge, Select, Input, cn } from '@solink/ui';

type Res = { perSeatTtc: number; totalTtc: number; contractTtc: number; detail: { loyerMaterielHt: number; servicesSolinkHt: number; servicesOrangeHt: number; assuranceHt: number; tva: number } };

const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

function Option({ checked, children, onChange, name, value }: { checked: boolean; children: React.ReactNode; onChange: () => void; name: string; value: string }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm transition-all duration-150 ease-apple',
        checked ? 'border-neutral-900 bg-neutral-900 font-medium text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function Check({ checked, onChange, name, value, label, hint }: { checked: boolean; onChange: (v: boolean) => void; name: string; value?: string; label: string; hint?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors', checked ? 'border-neutral-900/60 bg-white' : 'border-neutral-200 bg-white hover:border-neutral-300')}>
      <input type="checkbox" name={name} value={value} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span className="flex flex-col">
        <span className="font-medium text-neutral-900">{label}</span>
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Bloc « Votre mensualité » toujours visible (E08) — calcul serveur, cache client. */
export function Configurator({
  sku,
  isThin,
  durations,
  accessories,
  financer,
  children,
}: {
  sku: string;
  isThin: boolean;
  durations: number[];
  accessories: { sku: string; name: string }[];
  financer: string;
  children?: React.ReactNode;
}) {
  const [duree, setDuree] = useState(Math.max(...durations));
  const [vdi, setVdi] = useState(isThin ? 'STANDARD' : 'AUCUN');
  const [assurance, setAssurance] = useState(true);
  const [qte, setQte] = useState(1);
  const [acc, setAcc] = useState<string[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [open, setOpen] = useState(false);
  const key = useMemo(() => new URLSearchParams({ sku, duree: String(duree), vdi, assurance: assurance ? '1' : '0', qte: String(qte), acc: acc.join(',') }).toString(), [sku, duree, vdi, assurance, qte, acc]);
  useEffect(() => {
    const cache = (window as unknown as { __px?: Record<string, Res> }).__px ?? ((window as unknown as { __px: Record<string, Res> }).__px = {});
    if (cache[key]) return setRes(cache[key]);
    const ctl = new AbortController();
    fetch(`/api/pricing?${key}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.perSeatTtc !== undefined) {
          cache[key] = j;
          setRes(j);
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [key]);
  const section = 'text-[13px] font-medium text-neutral-700';
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-7">
        <fieldset className="flex flex-col gap-2.5">
          <legend className={section}>Durée</legend>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {durations.map((d) => (
              <Option key={d} name="duration" value={String(d)} checked={d === duree} onChange={() => setDuree(d)}>
                {d} mois
              </Option>
            ))}
          </div>
        </fieldset>
        {isThin ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className={section}>Virtualisation des postes Orange (VDI)</span>
            <Select name="vdiTier" value={vdi} onChange={(e) => setVdi(e.target.value)} className="sm:max-w-xs">
              <option value="STANDARD">VDI Standard</option>
              <option value="PERFORMANCE">VDI Performance</option>
            </Select>
          </label>
        ) : (
          <input type="hidden" name="vdiTier" value="AUCUN" />
        )}
        <Check name="insurance" checked={assurance} onChange={setAssurance} label="Assurance casse / vol incluse" hint="Mensualisée, reversée à l’assureur." />
        <label className="flex flex-col gap-2 text-sm">
          <span className={section}>Quantité (postes)</span>
          <Input type="number" name="quantity" min={1} max={500} value={qte} onChange={(e) => setQte(Math.max(1, Number(e.target.value) || 1))} className="w-32" aria-label="Quantité" />
        </label>
        {accessories.length ? (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className={cn(section, 'mb-2.5')}>Accessoires (par poste)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {accessories.map((a) => (
                <Check key={a.sku} name="acc" value={a.sku} checked={acc.includes(a.sku)} onChange={(on) => setAcc(on ? [...acc, a.sku] : acc.filter((x) => x !== a.sku))} label={a.name} />
              ))}
            </div>
          </fieldset>
        ) : null}
        {children}
      </div>
      <aside className="h-fit rounded-2xl bg-neutral-900 p-6 text-white shadow-pop lg:sticky lg:top-24" aria-live="polite" data-testid="mensualite">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Votre mensualité</p>
        <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight tabular-nums" data-testid="mensualite-poste">{res ? fcfa(res.perSeatTtc) : '…'}</p>
        <p className="mt-2 text-xs text-neutral-400">TTC / mois / poste, tout compris</p>
        {res && qte > 1 ? (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-neutral-300">
            Total pour {qte} postes : <strong className="text-white">{fcfa(res.totalTtc)}</strong> TTC / mois
          </p>
        ) : null}
        <button type="button" className="mt-4 text-xs font-medium text-neutral-300 underline-offset-4 hover:text-white hover:underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Masquer le détail' : 'Voir le détail'}
        </button>
        {open && res ? (
          <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-neutral-300">
            {[
              ['Loyer matériel HT', res.detail.loyerMaterielHt],
              ['Services SOLINK HT', res.detail.servicesSolinkHt],
              ['Services Orange HT', res.detail.servicesOrangeHt],
              ['Assurance HT', res.detail.assuranceHt],
              ['TVA', res.detail.tva],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4">
                <dt>{k}</dt>
                <dd className="tabular-nums text-white">{fcfa(Number(v))}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {res ? <p className="mt-4 text-xs text-neutral-400">Total du contrat : <span className="text-neutral-200">{fcfa(res.contractTtc)}</span> TTC sur {duree} mois</p> : null}
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">Équipements propriété de {financer}, restitués en fin de contrat.</p>
        <DemoBadge className="mt-4 border-white/20 text-neutral-400" />
      </aside>
    </div>
  );
}

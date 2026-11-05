'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@solink/ui';

type Res = { perSeatTtc: number; totalTtc: number; contractTtc: number; detail: { loyerMaterielHt: number; servicesSolinkHt: number; servicesOrangeHt: number; assuranceHt: number; tva: number } };

const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

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
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Durée</legend>
          <div className="flex gap-2">
            {durations.map((d) => (
              <label key={d} className={`cursor-pointer rounded border px-4 py-2 text-sm ${d === duree ? 'border-primary bg-primary/5 font-semibold' : 'border-slate-300'}`}>
                <input type="radio" name="duration" value={d} checked={d === duree} onChange={() => setDuree(d)} className="sr-only" />
                {d} mois
              </label>
            ))}
          </div>
        </fieldset>
        {isThin ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Virtualisation des postes Orange (VDI)</span>
            <select name="vdiTier" value={vdi} onChange={(e) => setVdi(e.target.value)} className="h-10 rounded border border-slate-300 px-2">
              <option value="STANDARD">VDI Standard</option>
              <option value="PERFORMANCE">VDI Performance</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="vdiTier" value="AUCUN" />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="insurance" checked={assurance} onChange={(e) => setAssurance(e.target.checked)} className="h-5 w-5" /> Assurance casse/vol incluse
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Quantité (postes)</span>
          <input type="number" name="quantity" min={1} max={500} value={qte} onChange={(e) => setQte(Math.max(1, Number(e.target.value) || 1))} className="h-10 w-32 rounded border border-slate-300 px-2" aria-label="Quantité" />
        </label>
        {accessories.length ? (
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="font-medium">Accessoires (par poste)</legend>
            {accessories.map((a) => (
              <label key={a.sku} className="flex items-center gap-2">
                <input type="checkbox" name="acc" value={a.sku} checked={acc.includes(a.sku)} onChange={(e) => setAcc(e.target.checked ? [...acc, a.sku] : acc.filter((x) => x !== a.sku))} className="h-5 w-5" /> {a.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        {children}
      </div>
      <aside className="sticky top-12 h-fit rounded-xl border-2 border-primary/30 bg-white p-4 shadow-sm" aria-live="polite" data-testid="mensualite">
        <p className="text-xs uppercase tracking-wide text-slate-500">Votre mensualité</p>
        <p className="mt-1 text-2xl font-bold text-primary" data-testid="mensualite-poste">{res ? fcfa(res.perSeatTtc) : '…'}</p>
        <p className="text-xs text-slate-500">TTC / mois / poste, tout compris</p>
        {res && qte > 1 ? <p className="mt-2 text-sm">Total : <strong>{fcfa(res.totalTtc)}</strong> TTC / mois</p> : null}
        <button type="button" className="mt-2 text-xs text-primary underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Masquer le détail' : 'Voir le détail'}
        </button>
        {open && res ? (
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between"><dt>Loyer matériel HT</dt><dd>{fcfa(res.detail.loyerMaterielHt)}</dd></div>
            <div className="flex justify-between"><dt>Services SOLINK HT</dt><dd>{fcfa(res.detail.servicesSolinkHt)}</dd></div>
            <div className="flex justify-between"><dt>Services Orange HT</dt><dd>{fcfa(res.detail.servicesOrangeHt)}</dd></div>
            <div className="flex justify-between"><dt>Assurance HT</dt><dd>{fcfa(res.detail.assuranceHt)}</dd></div>
            <div className="flex justify-between"><dt>TVA</dt><dd>{fcfa(res.detail.tva)}</dd></div>
          </dl>
        ) : null}
        {res ? <p className="mt-2 text-xs">Total du contrat : {fcfa(res.contractTtc)} TTC sur {duree} mois</p> : null}
        <p className="mt-3 text-xs text-slate-500">Équipements propriété de {financer}, restitués en fin de contrat.</p>
        <Badge tone="warning" className="mt-2">Valeurs de démo</Badge>
      </aside>
    </div>
  );
}

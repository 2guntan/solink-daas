'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const INK = '#1d1d1f';
const GRID = '#e4e4e8';
const MUTED = '#86868b';

const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

export function PipelineChart({ data }: { data: { status: string; n: number }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(120, 28 + data.length * 36) }} aria-label="Répartition des commandes par état">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} height={20} />
          <YAxis type="category" dataKey="status" tick={{ fontSize: 12, fill: INK }} width={210} axisLine={false} tickLine={false} interval={0} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: 10, border: `1px solid ${GRID}`, boxShadow: '0 8px 24px -12px rgba(0,0,0,.2)', fontSize: 12 }} />
          <Bar dataKey="n" name="Commandes" fill={INK} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Enveloppe : barre empilée + légende, lisible d'un coup d'œil. */
export function EnvelopeChart({ consumed, reserved, available }: { consumed: number; reserved: number; available: number }) {
  const total = Math.max(1, consumed + reserved + available);
  const parts = [
    { name: 'Consommé', value: consumed, color: 'bg-neutral-900' },
    { name: 'Réservé', value: reserved, color: 'bg-neutral-400' },
    { name: 'Disponible', value: available, color: 'bg-neutral-200' },
  ];
  return (
    <div className="flex flex-col gap-4" aria-label="Consommation de l’enveloppe">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
        {parts.map((p) => (
          <span key={p.name} className={`${p.color} h-full transition-[width] duration-700 ease-apple`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.name} : ${fcfa(p.value)}`} />
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {parts.map((p) => (
          <div key={p.name} className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span aria-hidden className={`h-2 w-2 rounded-full ${p.color}`} />
              {p.name}
            </dt>
            <dd className="text-sm font-semibold tabular-nums tracking-tight text-neutral-900">{fcfa(p.value)}</dd>
            <dd className="text-[11px] text-neutral-400">{((p.value / total) * 100).toFixed(1).replace('.', ',')} %</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

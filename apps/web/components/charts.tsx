'use client';

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

export function PipelineChart({ data }: { data: { status: string; n: number }[] }) {
  return (
    <div className="h-56 w-full" aria-label="Répartition des commandes par état">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="n" name="Commandes" fill="#0f4c81" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLORS = ['#0f4c81', '#f59e0b', '#94a3b8'];
export function EnvelopeChart({ consumed, reserved, available }: { consumed: number; reserved: number; available: number }) {
  const data = [
    { name: 'Consommé', value: consumed },
    { name: 'Réservé', value: reserved },
    { name: 'Disponible', value: available },
  ];
  return (
    <div className="h-52 w-full" aria-label="Consommation de l’enveloppe">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

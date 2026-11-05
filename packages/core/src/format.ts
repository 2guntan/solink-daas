/** Formats d'affichage : XOF entiers « 1 234 567 FCFA », dates JJ/MM/AAAA (Africa/Dakar). */
export const TZ = 'Africa/Dakar';

export function groupThousands(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '-' : '') + out;
}

export function fcfa(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${groupThousands(n)} FCFA`;
}

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { day: g('day'), month: g('month'), year: g('year'), hour: g('hour'), minute: g('minute') };
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const p = parts(new Date(d));
  return `${p.day}/${p.month}/${p.year}`;
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const p = parts(new Date(d));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits).replace('.', ',')} %`;
}

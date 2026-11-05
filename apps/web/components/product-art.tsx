import { cn } from '@solink/ui';

/** Illustrations SVG génériques au trait (pas de photos de marques). */
export function ProductArt({ category, className = 'h-20 w-full', tile = false }: { category: string; className?: string; tile?: boolean }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes: Record<string, React.ReactNode> = {
    THIN_CLIENT: (<><rect x="38" y="10" width="24" height="60" rx="4" {...common} /><circle cx="50" cy="20" r="3" {...common} /><rect x="30" y="70" width="40" height="6" rx="2" {...common} /></>),
    LAPTOP: (<><rect x="22" y="14" width="56" height="38" rx="4" {...common} /><path d="M12 62h76l-6 8H18z" {...common} /></>),
    MAC: (<><rect x="22" y="14" width="56" height="38" rx="5" {...common} /><path d="M10 62h80c0 4-3 8-8 8H18c-5 0-8-4-8-8z" {...common} /><circle cx="50" cy="33" r="3" {...common} /></>),
    ECRAN: (<><rect x="14" y="10" width="72" height="44" rx="4" {...common} /><path d="M50 54v12M34 70h32" {...common} /></>),
    DOCK: (<><rect x="20" y="34" width="60" height="22" rx="5" {...common} /><path d="M30 45h4M40 45h4M60 45h10" {...common} /></>),
    CASQUE: (<><path d="M22 52V42a28 28 0 0156 0v10" {...common} /><rect x="16" y="48" width="12" height="20" rx="4" {...common} /><rect x="72" y="48" width="12" height="20" rx="4" {...common} /></>),
    SACOCHE: (<><rect x="18" y="26" width="64" height="44" rx="6" {...common} /><path d="M38 26v-8h24v8M18 44h64" {...common} /></>),
  };
  const svg = (
    <svg viewBox="0 0 100 80" className={cn(tile ? 'h-full w-full max-h-24' : className, 'text-neutral-800')} role="img" aria-label="Illustration générique">
      {shapes[category] ?? shapes.LAPTOP}
    </svg>
  );
  if (!tile) return svg;
  return <div className={cn('flex items-center justify-center rounded-xl bg-neutral-50 p-6', className)}>{svg}</div>;
}

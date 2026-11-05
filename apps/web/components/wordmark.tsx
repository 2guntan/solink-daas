import { cn } from '@solink/ui';

/** Marque typographique SOLINK — pas de logo officiel, uniquement de la typographie. */
export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', className)}>
      <span className={cn('text-[17px] font-bold tracking-[-0.04em]', light ? 'text-white' : 'text-neutral-900')}>SOLINK</span>
      <span className={cn('text-[11px] font-medium uppercase tracking-[0.18em]', light ? 'text-neutral-400' : 'text-neutral-500')}>DaaS</span>
    </span>
  );
}

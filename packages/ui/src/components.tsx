import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * Primitives d'interface — style épuré (encre + gris, filets de 1 px, rayons doux).
 * Tout l'habillage de l'application passe par ces composants.
 */

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium no-underline transition-all duration-150 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 hover:no-underline min-h-[44px] sm:min-h-[38px]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-neutral-800',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200/70',
        outline: 'border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700',
        ghost: 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
        inverse: 'bg-white text-neutral-900 hover:bg-neutral-100',
        link: 'text-accent underline-offset-4 hover:underline min-h-0 sm:min-h-0 px-0 h-auto',
      },
      size: { default: 'h-10 px-4 py-2', sm: 'h-9 px-3 text-[13px] sm:min-h-[34px]', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3 sm:p-6 sm:pb-3', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[15px] font-semibold leading-6 tracking-tight text-neutral-900', className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-neutral-500', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-2 sm:p-6 sm:pt-2', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5', {
  variants: {
    tone: {
      neutral: 'bg-neutral-100 text-neutral-700',
      info: 'bg-sky-50 text-sky-800',
      success: 'bg-emerald-50 text-emerald-800',
      warning: 'bg-amber-50 text-amber-800',
      danger: 'bg-red-50 text-red-800',
      primary: 'bg-neutral-900 text-white',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
const DOT: Record<string, string> = { info: 'bg-sky-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' };
export function Badge({ className, tone, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  const dot = tone ? DOT[tone] : undefined;
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} /> : null}
      {children}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('border border-dashed border-neutral-300 bg-transparent text-neutral-500', className)} title="Valeur fictive de démonstration">
      Valeur de démo
    </Badge>
  );
}

export const inputClass =
  'flex h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition-[border-color,box-shadow] duration-150 placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-400 focus:outline-none focus:ring-[3px] focus:ring-neutral-900/[0.06] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60 min-h-[44px] sm:min-h-[40px]';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'ui-select', className)} {...props} />;
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-[88px] leading-relaxed', className)} {...props} />;
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-neutral-700', className)} {...props} />;
}
export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-sm', className)}>
      <span className="text-[13px] font-medium text-neutral-700">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-relaxed text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const color = { primary: 'bg-neutral-900', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-neutral-100', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-apple', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-14 text-center">
      <span aria-hidden className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-400 shadow-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2 3h6l2-3h4" />
          <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      </span>
      <p className="text-[15px] font-medium text-neutral-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm leading-relaxed text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'danger' | 'success' | 'warning' }) {
  return (
    <Card className="flex flex-col justify-between p-5">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <p className={cn('mt-3 break-words text-[22px] font-semibold leading-none tracking-tight tabular-nums text-neutral-900 sm:text-[26px]', tone === 'danger' && 'text-red-600', tone === 'success' && 'text-emerald-600', tone === 'warning' && 'text-amber-600')}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-neutral-500">{hint}</p> : <span className="mt-2 block h-4" />}
    </Card>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[32px]">{title}</h1>
        {description ? <div className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500 sm:text-[15px]">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children?: React.ReactNode }) {
  const c = {
    info: 'bg-sky-50/70 text-sky-950 border-sky-100',
    warning: 'bg-amber-50/70 text-amber-950 border-amber-100',
    danger: 'bg-red-50/70 text-red-950 border-red-100',
    success: 'bg-emerald-50/70 text-emerald-950 border-emerald-100',
  }[tone];
  const bar = { info: 'bg-sky-500', warning: 'bg-amber-500', danger: 'bg-red-500', success: 'bg-emerald-500' }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('relative overflow-hidden rounded-xl border py-3 pl-5 pr-4 text-sm leading-relaxed', c)}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', bar)} />
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-0.5' : ''}>{children}</div> : null}
    </div>
  );
}

export function KV({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-neutral-100 text-sm', className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="shrink-0 text-neutral-500">{k}</dt>
          <dd className="min-w-0 font-medium tabular-nums text-neutral-900 sm:text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Titre de section discret, en petites capitales espacées (typographie suisse). */
export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500', className)} {...props} />;
}

/** Pastille d'initiales. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return (
    <span aria-hidden className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold tracking-wide text-white', className)}>
      {initials || '•'}
    </span>
  );
}

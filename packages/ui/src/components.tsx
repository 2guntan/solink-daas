import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/** Composants de base façon shadcn/ui (Tailwind + CVA). */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px] sm:min-h-[38px]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200',
        outline: 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-900',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700',
        ghost: 'hover:bg-slate-100 text-slate-700',
        link: 'text-primary underline-offset-4 hover:underline min-h-0 sm:min-h-0 px-0',
      },
      size: { default: 'h-10 px-4 py-2', sm: 'h-8 px-3 text-xs', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 sm:p-5 pb-2 sm:pb-2', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-slate-900', className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-slate-500', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5 pt-2 sm:pt-2', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-slate-700',
      info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
      success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
      danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
      primary: 'bg-primary/10 text-primary ring-1 ring-primary/20',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function DemoBadge({ className }: { className?: string }) {
  return <Badge tone="warning" className={className} title="Valeur fictive de démonstration">Valeur de démo</Badge>;
}

export const inputClass =
  'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px] sm:min-h-[40px]';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'pr-8', className)} {...props} />;
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-[80px]', className)} {...props} />;
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-slate-700', className)} {...props} />;
}
export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const color = { primary: 'bg-primary', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' }[tone];
  return (
    <div className={cn('h-2 w-full rounded-full bg-slate-100 overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'danger' | 'success' | 'warning' }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold', tone === 'danger' && 'text-red-600', tone === 'success' && 'text-emerald-600', tone === 'warning' && 'text-amber-600')}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <div className="mt-1 text-sm text-slate-500">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children?: React.ReactNode }) {
  const c = { info: 'border-blue-200 bg-blue-50 text-blue-900', warning: 'border-amber-200 bg-amber-50 text-amber-900', danger: 'border-red-200 bg-red-50 text-red-900', success: 'border-emerald-200 bg-emerald-50 text-emerald-900' }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border p-3 text-sm', c)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

export function KV({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-slate-100 text-sm', className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
          <dt className="text-slate-500">{k}</dt>
          <dd className="font-medium text-slate-900 sm:text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

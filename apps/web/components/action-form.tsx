'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Textarea, cn, type ButtonProps } from '@solink/ui';

export type ActionResult = { ok: boolean; message?: string; error?: string; redirect?: string; data?: unknown };
type ServerAction = (prev: ActionResult | null, f: FormData) => Promise<ActionResult>;

function Submit({ children, variant, size, className, disabled, testId }: { children: ReactNode; variant?: ButtonProps['variant']; size?: ButtonProps['size']; className?: string; disabled?: boolean; testId?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending} data-testid={testId}>
      {pending ? 'Traitement…' : children}
    </Button>
  );
}

/**
 * Formulaire d'action serveur avec retour d'erreur/succès.
 * `confirm` : écran de confirmation (actions irréversibles) ; `reason` : motif obligatoire.
 */
export function ActionForm({
  action,
  children,
  submit,
  variant,
  size,
  className,
  confirm,
  reason,
  hidden,
  disabled,
  testId,
  inline,
}: {
  action: ServerAction;
  children?: ReactNode;
  submit: ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  confirm?: string;
  reason?: string;
  hidden?: Record<string, string | number | undefined | null>;
  disabled?: boolean;
  testId?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      setConfirming(false);
      if (state.redirect) router.push(state.redirect);
      else router.refresh();
    }
  }, [state, router]);
  const needsConfirm = !!(confirm || reason);
  return (
    <form action={formAction} className={cn(inline ? 'inline-flex flex-col gap-1' : 'flex flex-col gap-3', className)}>
      {hidden ? Object.entries(hidden).map(([k, v]) => (v === undefined || v === null ? null : <input key={k} type="hidden" name={k} value={String(v)} />)) : null}
      {children}
      {needsConfirm && !confirming ? (
        <Button type="button" variant={variant} size={size} disabled={disabled} onClick={() => setConfirming(true)} data-testid={testId}>
          {submit}
        </Button>
      ) : null}
      {needsConfirm && confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3" role="dialog" aria-label="Confirmation">
          <p className="text-sm font-medium text-amber-900">{confirm ?? 'Confirmez-vous cette action ?'}</p>
          {reason ? <Textarea name="reason" required minLength={3} placeholder={reason} aria-label="Motif" /> : null}
          <div className="flex gap-2">
            <Submit variant={variant === 'destructive' ? 'destructive' : 'default'} size={size} testId={testId ? `${testId}-confirmer` : undefined}>
              Confirmer
            </Submit>
            <Button type="button" variant="outline" size={size} onClick={() => setConfirming(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}
      {!needsConfirm ? (
        <Submit variant={variant} size={size} disabled={disabled} testId={testId}>
          {submit}
        </Submit>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p role="status" className="text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@solink/ui';
import { sendCode, verifyCode } from './actions';

type R = { ok: boolean; error?: string; message?: string; redirect?: string; data?: unknown } | null;

export function LoginForm({ next, demo }: { next?: string; demo: boolean }) {
  const [email, setEmail] = useState('');
  const [sent, sendAction, sending] = useActionState<R, FormData>(sendCode, null);
  const [verified, verifyAction, verifying] = useActionState<R, FormData>(verifyCode, null);
  const router = useRouter();
  useEffect(() => {
    if (verified?.ok && verified.redirect) {
      router.push(verified.redirect);
      router.refresh();
    }
  }, [verified, router]);
  const step2 = sent?.ok;
  return (
    <div className="flex flex-col gap-4">
      {!step2 ? (
        <form action={sendAction} className="flex flex-col gap-4">
          <Field label="Email professionnel ou mobile">
            <Input name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.sn" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" disabled={sending} className="w-full">
            {sending ? 'Envoi…' : 'Recevoir mon code'}
          </Button>
          {sent?.error ? <p role="alert" className="text-[13px] text-red-600">{sent.error}</p> : null}
        </form>
      ) : (
        <form action={verifyAction} className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-neutral-600">
            Un code à 6 chiffres a été envoyé à <strong className="text-neutral-900">{email}</strong> (valable 10 minutes).
          </p>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next ?? ''} />
          <Field label="Code de connexion" hint={demo ? 'Mode démo : le code 000000 est toujours accepté ; le code réel est dans la Boîte de démo.' : undefined}>
            <Input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" placeholder="000000" autoFocus className="text-center font-mono text-lg tracking-[0.4em]" />
          </Field>
          <Button type="submit" disabled={verifying} className="w-full">
            {verifying ? 'Vérification…' : 'Se connecter'}
          </Button>
          {verified?.error ? <p role="alert" className="text-[13px] text-red-600">{verified.error}</p> : null}
        </form>
      )}
    </div>
  );
}

import Link from 'next/link';
import { prisma } from '@solink/db';
import { Badge, Card, PageHeader, Input, Button, EmptyState, cn } from '@solink/ui';
import { dateTime } from '@solink/core';

export const metadata = { title: 'Boîte de démo' };

const CHANNELS = ['', 'SMS', 'WHATSAPP', 'EMAIL', 'PORTAIL'];

export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string; canal?: string }> }) {
  const sp = await searchParams;
  const recipients = await prisma.notification.groupBy({ by: ['recipient'], _count: true, orderBy: { recipient: 'asc' } });
  const msgs = await prisma.notification.findMany({
    where: { ...(sp.a ? { recipient: sp.a } : {}), ...(sp.canal ? { channel: sp.canal as 'SMS' } : {}) },
    orderBy: { at: 'desc' },
    take: 100,
  });
  if (sp.a) await prisma.notification.updateMany({ where: { recipient: sp.a, read: false }, data: { read: true } });
  const item = 'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] no-underline transition-colors hover:bg-neutral-100 hover:no-underline';
  return (
    <div>
      <PageHeader title="Boîte de démo" description="Tous les SMS, WhatsApp et emails simulés (adaptateur Messaging). Les codes OTP réels apparaissent ici." />
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-3 md:sticky md:top-32 md:self-start">
          <form className="flex gap-2" action="/demo/boite">
            <Input name="a" placeholder="destinataire@…" defaultValue={sp.a} aria-label="Destinataire" />
            <Button variant="secondary" type="submit">OK</Button>
          </form>
          <nav className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white p-2" aria-label="Destinataires">
            <Link href={sp.canal ? `/demo/boite?canal=${sp.canal}` : '/demo/boite'} className={cn(item, !sp.a ? 'bg-neutral-900 text-white hover:bg-neutral-900' : 'text-neutral-700')}>
              Tous les messages
            </Link>
            {recipients.map((r) => (
              <Link key={r.recipient} href={`/demo/boite?a=${encodeURIComponent(r.recipient)}${sp.canal ? `&canal=${sp.canal}` : ''}`} className={cn(item, sp.a === r.recipient ? 'bg-neutral-900 text-white hover:bg-neutral-900' : 'text-neutral-700')}>
                <span className="truncate">{r.recipient}</span>
                <span className={cn('shrink-0 rounded-full px-1.5 text-[11px] tabular-nums', sp.a === r.recipient ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-500')}>{r._count}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex flex-col gap-3" data-testid="inbox">
          <div className="flex flex-wrap gap-1 rounded-full bg-neutral-100 p-1 text-xs w-fit">
            {CHANNELS.map((c) => (
              <Link
                key={c}
                href={`/demo/boite?${new URLSearchParams({ ...(sp.a ? { a: sp.a } : {}), ...(c ? { canal: c } : {}) })}`}
                className={cn('rounded-full px-3 py-1 font-medium no-underline transition-colors hover:no-underline', (sp.canal ?? '') === c ? 'bg-white text-neutral-900 shadow-card' : 'text-neutral-500 hover:text-neutral-900')}
              >
                {c || 'Tous canaux'}
              </Link>
            ))}
          </div>
          {msgs.length === 0 ? <EmptyState title="Aucun message" /> : null}
          {msgs.map((m) => (
            <Card key={m.id} className="p-4 sm:p-5" data-testid="message">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                <Badge tone={m.channel === 'WHATSAPP' ? 'success' : m.channel === 'SMS' ? 'info' : 'neutral'}>{m.channel}</Badge>
                <span className="font-medium text-neutral-700">{m.recipient}</span>
                <span>{dateTime(m.at)}</span>
                <span className="font-mono text-[11px] text-neutral-400">{m.template}</span>
              </div>
              {m.subject ? <p className="mt-2.5 text-[15px] font-semibold tracking-tight text-neutral-900">{m.subject}</p> : null}
              <p className="mt-1 text-sm leading-relaxed text-neutral-700" data-testid="message-body">{m.body}</p>
              {m.link ? (
                <Link href={m.link} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 no-underline hover:underline">
                  Ouvrir le lien <span aria-hidden>→</span>
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

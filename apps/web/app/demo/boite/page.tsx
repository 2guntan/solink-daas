import Link from 'next/link';
import { prisma } from '@solink/db';
import { Badge, Card, CardContent, PageHeader, Input, Button, EmptyState } from '@solink/ui';
import { dateTime } from '@solink/core';

export const metadata = { title: 'Boîte de démo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string; canal?: string }> }) {
  const sp = await searchParams;
  const recipients = await prisma.notification.groupBy({ by: ['recipient'], _count: true, orderBy: { recipient: 'asc' } });
  const msgs = await prisma.notification.findMany({
    where: { ...(sp.a ? { recipient: sp.a } : {}), ...(sp.canal ? { channel: sp.canal as 'SMS' } : {}) },
    orderBy: { at: 'desc' },
    take: 100,
  });
  if (sp.a) await prisma.notification.updateMany({ where: { recipient: sp.a, read: false }, data: { read: true } });
  return (
    <div>
      <PageHeader title="Boîte de démo" description="Tous les SMS, WhatsApp et emails simulés (adaptateur Messaging). Les codes OTP réels apparaissent ici." />
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card>
          <CardContent className="pt-4">
            <form className="mb-3 flex gap-2" action="/demo/boite">
              <Input name="a" placeholder="destinataire@…" defaultValue={sp.a} aria-label="Destinataire" />
              <Button variant="secondary" type="submit">OK</Button>
            </form>
            <ul className="space-y-1 text-sm">
              <li><Link href="/demo/boite">Tous les messages</Link></li>
              {recipients.map((r) => (
                <li key={r.recipient}>
                  <Link href={`/demo/boite?a=${encodeURIComponent(r.recipient)}`}>{r.recipient}</Link> <span className="text-slate-400">({r._count})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2" data-testid="inbox">
          <div className="flex gap-2 text-xs">
            {['', 'SMS', 'WHATSAPP', 'EMAIL', 'PORTAIL'].map((c) => (
              <Link key={c} href={`/demo/boite?${new URLSearchParams({ ...(sp.a ? { a: sp.a } : {}), ...(c ? { canal: c } : {}) })}`}>{c || 'Tous canaux'}</Link>
            ))}
          </div>
          {msgs.length === 0 ? <EmptyState title="Aucun message" /> : null}
          {msgs.map((m) => (
            <Card key={m.id} className="p-3" data-testid="message">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge tone={m.channel === 'WHATSAPP' ? 'success' : m.channel === 'SMS' ? 'info' : 'neutral'}>{m.channel}</Badge>
                <span>{m.recipient}</span>
                <span>{dateTime(m.at)}</span>
                <span className="font-mono">{m.template}</span>
              </div>
              {m.subject ? <p className="mt-1 text-sm font-medium">{m.subject}</p> : null}
              <p className="text-sm text-slate-700" data-testid="message-body">{m.body}</p>
              {m.link ? <Link href={m.link} className="text-sm">Ouvrir le lien →</Link> : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { prisma } from '@solink/db';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, KV } from '@solink/ui';
import { dateTime, verifyAuditChain } from '@solink/core';

export const metadata = { title: 'Outils démo' };

const SIMS = [
  ['Messaging', 'SMS / WhatsApp / email → table Notification → Boîte de démo'],
  ['ESign', 'Page interne /signer/[token] + OTP, PDF signés, dossier de preuve, webhooks /api/webhooks/esign'],
  ['Ocr', 'Champs extraits plausibles + score de confiance, confirmés par le client'],
  ['CreditBureau (BIC)', 'Réponse déterministe par NINEA'],
  ['OrangeHistory', 'Score de paiement 0–100 par NINEA'],
  ['FinancerTransport', 'Portail + SFTP simulé : ./storage/sftp/out (DFS) et ./storage/sftp/in (décisions CSV)'],
  ['Payments', 'Confirmations banque sur /demo/banque-virements + relevé CSV de cantonnement'],
  ['OrangeBilling', 'Factures 2 lignes (PDF) + export CSV (docs/format_orange.md)'],
  ['Distributor', 'BC PDF + « Simuler la réception » (séries + hash Autopilot)'],
  ['Mdm', 'Enrôlement simulé ; verrouillage seulement après ordre banque'],
  ['Llm', 'Modèles de texte déterministes (synthèse analyste, recommandation d’offre)'],
];

export default async function Page() {
  const [hooks, chain] = await Promise.all([prisma.webhookDelivery.findMany({ orderBy: { at: 'desc' }, take: 30 }), verifyAuditChain(prisma)]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Outils de démonstration" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Simulations en place</CardTitle></CardHeader>
          <CardContent><KV rows={SIMS.map(([a, b]) => [a, b])} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Journal d’audit chaîné</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm" data-testid="audit-chain">{chain.ok ? <Badge tone="success">Chaîne intègre</Badge> : <Badge tone="danger">Chaîne rompue à #{chain.brokenAt}</Badge>} {chain.count} événements</p>
            <p className="mt-3 text-sm">API Financeur de démo : <code>Authorization: Bearer partner_demo_key</code> — base <code>/api/partner/v1</code>. Exemple : <Link href="/api/partner/v1/financing-requests?status=TRANSMITTED">financing-requests</Link> (en-tête requis).</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Webhooks émis vers /api/demo/webhook-sink (signés HMAC)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="p-2">Date</th><th className="p-2">Événement</th><th className="p-2">Signature</th><th className="p-2">Réception</th></tr></thead>
              <tbody>
                {hooks.map((h) => (
                  <tr key={h.id} className="border-t"><td className="p-2">{dateTime(h.at)}</td><td className="p-2 font-mono text-xs">{h.event}</td><td className="p-2 font-mono text-xs">{h.signature.slice(0, 40)}…</td><td className="p-2">{h.verified ? <Badge tone="success">Reçu, signature valide ({h.status})</Badge> : <Badge>Tracé (serveur non joignable lors de l’émission)</Badge>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

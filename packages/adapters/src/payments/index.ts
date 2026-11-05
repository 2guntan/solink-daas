/**
 * Interface Payments — la plateforme NE détient NI n'ordonne aucun fonds (garde-fou v4 §15).
 * Elle reçoit uniquement des CONFIRMATIONS de la banque (dépôt reçu, paiement SOLINK, encaissements clients)
 * et produit un relevé CSV de cantonnement. Simulation : page /demo/banque-virements.
 */
export interface StatementRow {
  date: string;
  reference: string;
  label: string;
  debit: number;
  credit: number;
  beneficiary?: string;
}

export interface Payments {
  /** Référence unique de virement pour un dépôt de garantie (compte désigné par la banque). */
  depositReference(contractRef: string): string;
  statementCsv(rows: StatementRow[]): string;
}

export const simPayments: Payments = {
  depositReference(contractRef) {
    return `DEP-${contractRef.replace(/^CTR-/, '')}`;
  },
  statementCsv(rows) {
    const head = 'date;reference;libelle;debit_xof;credit_xof;beneficiaire';
    return [head, ...rows.map((r) => [r.date, r.reference, r.label, r.debit, r.credit, r.beneficiary ?? ''].join(';'))].join('\n');
  },
};

export const payments: Payments = simPayments;

/** Interface OrangeBilling — export CSV des factures 2 lignes (format : docs/format_orange.md). */
export interface OrangeInvoiceRow {
  invoiceRef: string;
  period: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientNinea: string;
  contractRef: string;
  financer: string;
  line1Ht: number;
  line1Tva: number;
  line1Ttc: number;
  line2Ht: number;
  line2Tva: number;
  line2Ttc: number;
  totalTtc: number;
  status: string;
}

export const ORANGE_CSV_HEADER = [
  'num_facture',
  'periode',
  'date_emission',
  'date_echeance',
  'client_raison_sociale',
  'client_ninea',
  'ref_contrat',
  'bailleur',
  'l1_libelle',
  'l1_ht',
  'l1_tva',
  'l1_ttc',
  'l2_libelle',
  'l2_ht',
  'l2_tva',
  'l2_ttc',
  'total_ttc',
  'statut',
];

export interface OrangeBilling {
  exportCsv(rows: OrangeInvoiceRow[]): string;
}

const esc = (s: string | number) => {
  const v = String(s);
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export const simOrangeBilling: OrangeBilling = {
  exportCsv(rows) {
    const lines = rows.map((r) =>
      [
        r.invoiceRef,
        r.period,
        r.issueDate,
        r.dueDate,
        r.clientName,
        r.clientNinea,
        r.contractRef,
        r.financer,
        `Loyer location financière — pour compte de ${r.financer}`,
        r.line1Ht,
        r.line1Tva,
        r.line1Ttc,
        'Services (SOLINK support & MDM, Orange VDI, assurance)',
        r.line2Ht,
        r.line2Tva,
        r.line2Ttc,
        r.totalTtc,
        r.status,
      ]
        .map(esc)
        .join(';'),
    );
    return [ORANGE_CSV_HEADER.join(';'), ...lines].join('\n');
  },
};

export const orangeBilling: OrangeBilling = simOrangeBilling;

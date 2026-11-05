import React from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
type Style = NonNullable<React.ComponentProps<typeof View>['style']>;

/**
 * Générateur PDF générique (@react-pdf/renderer). Chaque document (devis, contrat, annexes, PV,
 * fiche synthèse, facture, BC, pièce de démo) est décrit par un DocSpec puis rendu ici.
 */
export type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'kv'; rows: [string, string][] }
  | { kind: 'table'; head: string[]; rows: string[][]; widths?: number[]; total?: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'signatures'; items: { role: string; name: string; signedAt?: string; hash?: string }[] };

export interface DocSpec {
  title: string;
  ref?: string;
  subtitle?: string;
  issuer?: string;
  blocks: Block[];
  watermark?: string;
  footer?: string;
}

const PRIMARY = '#0f4c81';

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: PRIMARY, paddingBottom: 8, marginBottom: 12 },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  issuer: { fontSize: 8, color: '#6b7280' },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  ref: { fontSize: 9, color: '#374151' },
  subtitle: { fontSize: 9, color: '#6b7280', marginBottom: 8 },
  h: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRIMARY, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 4, lineHeight: 1.35 },
  note: { marginTop: 6, padding: 6, backgroundColor: '#f3f4f6', fontSize: 8.5, color: '#374151' },
  kvRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 2 },
  kvK: { width: '40%', color: '#6b7280' },
  kvV: { width: '60%' },
  tHead: { flexDirection: 'row', backgroundColor: PRIMARY, color: '#fff', paddingVertical: 3 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 3 },
  tTotal: { flexDirection: 'row', paddingVertical: 3, fontFamily: 'Helvetica-Bold', borderTopWidth: 1, borderTopColor: '#111827' },
  cell: { paddingHorizontal: 3 },
  sigBox: { borderWidth: 1, borderColor: '#9ca3af', padding: 6, marginRight: 6, marginBottom: 6, width: 160 },
  sigDone: { borderColor: '#047857', backgroundColor: '#ecfdf5' },
  watermark: { position: 'absolute', top: 360, left: 40, fontSize: 40, color: '#dc2626', opacity: 0.12, transform: 'rotate(-30deg)' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: '#9ca3af', textAlign: 'center' },
});

/** Helvetica (WinAnsi) : on remplace les caractères hors jeu. */
export function pdfSafe(t: string): string {
  return t
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/[●•]/g, '-')
    .replace(/✓/g, 'OK')
    .replace(/[^\u0000-ÿ–—‘’“”…€]/g, '?');
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'h':
      return <Text style={s.h}>{pdfSafe(b.text)}</Text>;
    case 'p':
      return <Text style={s.p}>{pdfSafe(b.text)}</Text>;
    case 'note':
      return <Text style={s.note}>{pdfSafe(b.text)}</Text>;
    case 'kv':
      return (
        <View>
          {b.rows.map(([k, v], i) => (
            <View key={i} style={s.kvRow} wrap={false}>
              <Text style={s.kvK}>{pdfSafe(k)}</Text>
              <Text style={s.kvV}>{pdfSafe(v)}</Text>
            </View>
          ))}
        </View>
      );
    case 'table': {
      const n = b.head.length;
      const widths = b.widths ?? Array.from({ length: n }, () => 100 / n);
      const row = (cells: string[], style: Style, key?: number) => (
        <View key={key} style={style} wrap={false}>
          {cells.map((c, i) => (
            <Text key={i} style={[s.cell, { width: `${widths[i]}%`, textAlign: i > 0 && /\d/.test(c) && /FCFA|%|^\d/.test(c) ? 'right' : 'left' }]}>
              {pdfSafe(c)}
            </Text>
          ))}
        </View>
      );
      return (
        <View style={{ marginBottom: 4 }}>
          {row(b.head, s.tHead)}
          {b.rows.map((r, i) => row(r, s.tRow, i))}
          {b.total ? row(b.total, s.tTotal) : null}
        </View>
      );
    }
    case 'signatures':
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }} wrap={false}>
          {b.items.map((it, i) => (
            <View key={i} style={it.signedAt ? [s.sigBox, s.sigDone] : s.sigBox}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{pdfSafe(it.role)}</Text>
              <Text>{pdfSafe(it.name)}</Text>
              {it.signedAt ? (
                <>
                  <Text style={{ color: '#047857', marginTop: 3 }}>SIGNÉ ÉLECTRONIQUEMENT (OTP)</Text>
                  <Text style={{ fontSize: 7 }}>{pdfSafe(it.signedAt)}</Text>
                  {it.hash ? <Text style={{ fontSize: 6 }}>{it.hash.slice(0, 32)}…</Text> : null}
                </>
              ) : (
                <Text style={{ color: '#9ca3af', marginTop: 10 }}>En attente de signature</Text>
              )}
            </View>
          ))}
        </View>
      );
  }
}

export function PdfDoc({ spec }: { spec: DocSpec }) {
  return (
    <Document title={pdfSafe(spec.title)} author="SOLINK DaaS (démo)">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>SOLINK DaaS</Text>
            <Text style={s.issuer}>{pdfSafe(spec.issuer ?? 'SOLINK Professional Services — Dakar (données de démonstration)')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {spec.ref ? <Text style={s.ref}>{pdfSafe(spec.ref)}</Text> : null}
          </View>
        </View>
        <Text style={s.title}>{pdfSafe(spec.title)}</Text>
        {spec.subtitle ? <Text style={s.subtitle}>{pdfSafe(spec.subtitle)}</Text> : null}
        {spec.blocks.map((b, i) => (
          <BlockView key={i} b={b} />
        ))}
        <Text style={s.watermark} fixed>
          {pdfSafe(spec.watermark ?? 'DOCUMENT FICTIF — DÉMO')}
        </Text>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            pdfSafe(`${spec.footer ?? 'Document fictif généré pour démonstration — aucune valeur contractuelle'} · page ${pageNumber}/${totalPages}`)
          }
        />
      </Page>
    </Document>
  );
}

export async function renderPdf(spec: DocSpec): Promise<Buffer> {
  return renderToBuffer(<PdfDoc spec={spec} />);
}

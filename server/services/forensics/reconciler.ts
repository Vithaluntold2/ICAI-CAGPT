import { db } from '../../db';
import { forensicCases, forensicDocuments, forensicReconciliations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface Row {
  __idx: number;
  amount: number | null;
  date: Date | null;
  vendor: string | null;
  raw: Record<string, any>;
}

interface Match {
  sourceRowIndex: number;
  targetRowIndex: number;
  amount: number;
  sourceDate: string | null;
  targetDate: string | null;
  vendor: string | null;
  dateDiffDays: number | null;
  matchType: 'exact' | 'amount-and-date' | 'amount-only';
}

interface Discrepancy {
  nature: 'unmatched-in-source' | 'unmatched-in-target' | 'amount-mismatch' | 'timing-mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  sourceRowIndex?: number;
  targetRowIndex?: number;
  sourceAmount?: number;
  targetAmount?: number;
  sourceDate?: string | null;
  targetDate?: string | null;
  vendor?: string | null;
  suggestedAction: string;
}

interface ReconcileInput {
  caseId: string;
  userId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  amountTolerance?: number;
  dateWindowDays?: number;
}

const DEFAULT_AMOUNT_TOLERANCE = 0.01;
const DEFAULT_DATE_WINDOW_DAYS = 3;

export class ForensicReconciler {
  static async reconcile(input: ReconcileInput): Promise<{
    sourceDocument: { id: string; filename: string; rowCount: number };
    targetDocument: { id: string; filename: string; rowCount: number };
    summary: {
      matchedCount: number;
      unmatchedSourceCount: number;
      unmatchedTargetCount: number;
      amountMismatchCount: number;
      timingMismatchCount: number;
    };
    matches: Match[];
    discrepancies: Discrepancy[];
  } | null> {
    const tolerance = input.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
    const dateWindowDays = input.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS;

    const [caseRow] = await db
      .select()
      .from(forensicCases)
      .where(and(
        eq(forensicCases.id, input.caseId),
        eq(forensicCases.userId, input.userId)
      ))
      .limit(1);

    if (!caseRow) return null;

    const docs = await db
      .select()
      .from(forensicDocuments)
      .where(eq(forensicDocuments.caseId, input.caseId));

    const source = docs.find(d => d.id === input.sourceDocumentId);
    const target = docs.find(d => d.id === input.targetDocumentId);
    if (!source || !target) return null;

    const sourceRows = this.extractRows(source.extractedData);
    const targetRows = this.extractRows(target.extractedData);

    const { matches, discrepancies, summary } = this.match(sourceRows, targetRows, {
      tolerance,
      dateWindowDays,
    });

    // Persist reconciliation record (best-effort; don't block response on failure)
    try {
      const reconStatus =
        summary.matchedCount > 0 && discrepancies.length === 0 ? 'matched' :
        summary.matchedCount > 0 ? 'partial_match' : 'mismatched';
      await db.insert(forensicReconciliations).values({
        caseId: input.caseId,
        sourceDocumentId: input.sourceDocumentId,
        targetDocumentId: input.targetDocumentId,
        reconciliationType: 'cross-document',
        status: reconStatus,
        reconciliationDetails: { matches, discrepancies, summary } as any,
      });
    } catch (err) {
      console.warn('[Reconciler] Persist failed (non-fatal):', (err as Error).message);
    }

    return {
      sourceDocument: { id: source.id, filename: source.filename, rowCount: sourceRows.length },
      targetDocument: { id: target.id, filename: target.filename, rowCount: targetRows.length },
      summary,
      matches,
      discrepancies,
    };
  }

  private static extractRows(extractedData: any): Row[] {
    const items = Array.isArray(extractedData?.items) ? extractedData.items : [];
    return items.map((row: any, idx: number) => ({
      __idx: idx,
      amount: this.coerceAmount(row),
      date: this.coerceDate(row),
      vendor: this.coerceVendor(row),
      raw: row,
    }));
  }

  private static coerceAmount(row: any): number | null {
    const v = row.totalAmount ?? row.Amount ?? row.amount;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^0-9.\-]/g, ''));
      return isNaN(p) ? null : p;
    }
    return null;
  }

  private static coerceDate(row: any): Date | null {
    const v = row.transactionDate ?? row.Date ?? row.date;
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  private static coerceVendor(row: any): string | null {
    const v = row.Vendor ?? row.vendor;
    return v ? String(v) : null;
  }

  private static match(
    sourceRows: Row[],
    targetRows: Row[],
    opts: { tolerance: number; dateWindowDays: number }
  ) {
    const matches: Match[] = [];
    const discrepancies: Discrepancy[] = [];
    const matchedSource = new Set<number>();
    const matchedTarget = new Set<number>();

    const dateDiffDays = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86_400_000;

    // Pass 1: exact amount + date match
    for (const s of sourceRows) {
      if (s.amount === null || s.date === null) continue;
      for (const t of targetRows) {
        if (matchedTarget.has(t.__idx)) continue;
        if (t.amount === null || t.date === null) continue;
        if (Math.abs(s.amount - t.amount) > opts.tolerance) continue;
        const diff = dateDiffDays(s.date, t.date);
        if (diff === 0) {
          matches.push({
            sourceRowIndex: s.__idx,
            targetRowIndex: t.__idx,
            amount: s.amount,
            sourceDate: s.date.toISOString(),
            targetDate: t.date.toISOString(),
            vendor: s.vendor ?? t.vendor ?? null,
            dateDiffDays: 0,
            matchType: 'exact',
          });
          matchedSource.add(s.__idx);
          matchedTarget.add(t.__idx);
          break;
        }
      }
    }

    // Pass 2: amount match within date window (timing mismatch)
    for (const s of sourceRows) {
      if (matchedSource.has(s.__idx)) continue;
      if (s.amount === null || s.date === null) continue;
      for (const t of targetRows) {
        if (matchedTarget.has(t.__idx)) continue;
        if (t.amount === null || t.date === null) continue;
        if (Math.abs(s.amount - t.amount) > opts.tolerance) continue;
        const diff = dateDiffDays(s.date, t.date);
        if (diff <= opts.dateWindowDays) {
          matches.push({
            sourceRowIndex: s.__idx,
            targetRowIndex: t.__idx,
            amount: s.amount,
            sourceDate: s.date.toISOString(),
            targetDate: t.date.toISOString(),
            vendor: s.vendor ?? t.vendor ?? null,
            dateDiffDays: Number(diff.toFixed(2)),
            matchType: 'amount-and-date',
          });
          matchedSource.add(s.__idx);
          matchedTarget.add(t.__idx);
          discrepancies.push({
            nature: 'timing-mismatch',
            severity: diff > 1 ? 'medium' : 'low',
            description: `Amount ${s.amount} appears in both documents but dates differ by ${diff.toFixed(1)} day(s).`,
            sourceRowIndex: s.__idx,
            targetRowIndex: t.__idx,
            sourceAmount: s.amount,
            targetAmount: t.amount,
            sourceDate: s.date.toISOString(),
            targetDate: t.date.toISOString(),
            vendor: s.vendor ?? t.vendor ?? null,
            suggestedAction: 'Investigate the date gap — possible delayed booking or backdated entry.',
          });
          break;
        }
      }
    }

    // Pass 3: same date + vendor but different amount (amount-mismatch)
    for (const s of sourceRows) {
      if (matchedSource.has(s.__idx)) continue;
      if (s.date === null || !s.vendor) continue;
      for (const t of targetRows) {
        if (matchedTarget.has(t.__idx)) continue;
        if (t.date === null || !t.vendor) continue;
        if (this.normalizeVendor(s.vendor) !== this.normalizeVendor(t.vendor)) continue;
        const diff = dateDiffDays(s.date, t.date);
        if (diff > opts.dateWindowDays) continue;
        if (s.amount === null || t.amount === null) continue;
        if (Math.abs(s.amount - t.amount) <= opts.tolerance) continue;
        matches.push({
          sourceRowIndex: s.__idx,
          targetRowIndex: t.__idx,
          amount: s.amount,
          sourceDate: s.date.toISOString(),
          targetDate: t.date.toISOString(),
          vendor: s.vendor,
          dateDiffDays: Number(diff.toFixed(2)),
          matchType: 'amount-only',
        });
        matchedSource.add(s.__idx);
        matchedTarget.add(t.__idx);
        discrepancies.push({
          nature: 'amount-mismatch',
          severity: Math.abs(s.amount - t.amount) > Math.max(100, s.amount * 0.05) ? 'high' : 'medium',
          description: `Same vendor "${s.vendor}" around the same date, but amounts differ: source=${s.amount}, target=${t.amount} (Δ=${(s.amount - t.amount).toFixed(2)}).`,
          sourceRowIndex: s.__idx,
          targetRowIndex: t.__idx,
          sourceAmount: s.amount,
          targetAmount: t.amount,
          sourceDate: s.date.toISOString(),
          targetDate: t.date.toISOString(),
          vendor: s.vendor,
          suggestedAction: 'Obtain supporting invoice / receipt to reconcile the amount difference.',
        });
        break;
      }
    }

    // Unmatched — remaining rows that have no counterpart
    for (const s of sourceRows) {
      if (matchedSource.has(s.__idx)) continue;
      if (s.amount === null) continue;
      discrepancies.push({
        nature: 'unmatched-in-source',
        severity: 'medium',
        description: `Row ${s.__idx + 1} in the source document has no corresponding entry in the target document.`,
        sourceRowIndex: s.__idx,
        sourceAmount: s.amount,
        sourceDate: s.date ? s.date.toISOString() : null,
        vendor: s.vendor,
        suggestedAction: 'Confirm whether the entry is missing from the target ledger or was recorded under a different reference.',
      });
    }
    for (const t of targetRows) {
      if (matchedTarget.has(t.__idx)) continue;
      if (t.amount === null) continue;
      discrepancies.push({
        nature: 'unmatched-in-target',
        severity: 'medium',
        description: `Row ${t.__idx + 1} in the target document has no corresponding entry in the source document.`,
        targetRowIndex: t.__idx,
        targetAmount: t.amount,
        targetDate: t.date ? t.date.toISOString() : null,
        vendor: t.vendor,
        suggestedAction: 'Investigate origin of the unmatched entry — possible unauthorized or duplicated booking.',
      });
    }

    const summary = {
      matchedCount: matches.length,
      unmatchedSourceCount: discrepancies.filter(d => d.nature === 'unmatched-in-source').length,
      unmatchedTargetCount: discrepancies.filter(d => d.nature === 'unmatched-in-target').length,
      amountMismatchCount: discrepancies.filter(d => d.nature === 'amount-mismatch').length,
      timingMismatchCount: discrepancies.filter(d => d.nature === 'timing-mismatch').length,
    };

    return { matches, discrepancies, summary };
  }

  private static normalizeVendor(v: string): string {
    return v.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}

import { db } from '../../db';
import { forensicCases, forensicDocuments, forensicFindings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface TimelineEvent {
  id: string;
  date: string;               // ISO date
  eventType: 'transaction' | 'finding' | 'document';
  title: string;
  description: string;
  amount?: number | null;
  vendor?: string | null;
  severity?: string | null;
  sourceDocumentId: string | null;
  sourceDocumentFilename: string | null;
  rowIndex?: number;
  rawEvidence?: Record<string, any>;
}

interface TimelineResponse {
  caseId: string;
  totalEvents: number;
  dateRange: { earliest: string | null; latest: string | null };
  events: TimelineEvent[];
  gaps: Array<{ after: string; before: string; days: number }>;
  highActivityPeriods: Array<{ start: string; end: string; eventCount: number }>;
}

export class ForensicTimelineBuilder {
  static async build(caseId: string, userId: string): Promise<TimelineResponse | null> {
    const [forensicCase] = await db
      .select()
      .from(forensicCases)
      .where(and(
        eq(forensicCases.id, caseId),
        eq(forensicCases.userId, userId)
      ))
      .limit(1);
    if (!forensicCase) return null;

    const docs = await db
      .select()
      .from(forensicDocuments)
      .where(eq(forensicDocuments.caseId, caseId));

    const findings = await db
      .select()
      .from(forensicFindings)
      .where(eq(forensicFindings.caseId, caseId));

    const events: TimelineEvent[] = [];

    // 1. Document ingest events
    for (const d of docs) {
      if (d.createdAt) {
        events.push({
          id: `doc-${d.id}`,
          date: new Date(d.createdAt).toISOString(),
          eventType: 'document',
          title: `Document ingested: ${d.filename}`,
          description: `Uploaded and analyzed as part of the case file.`,
          sourceDocumentId: d.id,
          sourceDocumentFilename: d.filename,
        });
      }

      // 2. Row-level transaction events from tabular data
      const extracted = (d.extractedData ?? {}) as any;
      const items: any[] = Array.isArray(extracted.items) ? extracted.items : [];
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const d0 = this.coerceDate(row);
        if (!d0) continue;
        const amount = this.coerceAmount(row);
        const vendor = this.coerceVendor(row);
        events.push({
          id: `txn-${d.id}-${i}`,
          date: d0.toISOString(),
          eventType: 'transaction',
          title: vendor
            ? `Transaction — ${vendor}${amount !== null ? ` (${this.fmtAmount(amount)})` : ''}`
            : `Transaction${amount !== null ? ` (${this.fmtAmount(amount)})` : ''}`,
          description: this.rowSummary(row),
          amount,
          vendor,
          sourceDocumentId: d.id,
          sourceDocumentFilename: d.filename,
          rowIndex: i,
          rawEvidence: row,
        });
      }
    }

    // 3. Finding events — anchor on referenced row's date if available, else creation time
    const docById = new Map(docs.map(d => [d.id, d]));
    for (const f of findings) {
      const evidence: any = f.evidenceDetails ?? {};
      let eventDate: Date | null = null;
      if (evidence.row && (evidence.row.Date || evidence.row.transactionDate)) {
        eventDate = this.coerceDate(evidence.row);
      }
      if (!eventDate && f.createdAt) {
        eventDate = new Date(f.createdAt);
      }
      if (!eventDate) continue;

      const srcDoc = f.documentId ? docById.get(f.documentId) : undefined;
      events.push({
        id: `find-${f.id}`,
        date: eventDate.toISOString(),
        eventType: 'finding',
        title: f.title || '(untitled finding)',
        description: f.description || '',
        severity: f.severity,
        sourceDocumentId: f.documentId ?? null,
        sourceDocumentFilename: srcDoc?.filename ?? null,
        rowIndex: typeof evidence.rowIndex === 'number' ? evidence.rowIndex : undefined,
        rawEvidence: evidence,
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    const { gaps, highActivityPeriods } = this.detectPatterns(events);

    return {
      caseId,
      totalEvents: events.length,
      dateRange: {
        earliest: events[0]?.date ?? null,
        latest: events[events.length - 1]?.date ?? null,
      },
      events,
      gaps,
      highActivityPeriods,
    };
  }

  private static detectPatterns(events: TimelineEvent[]) {
    const gaps: Array<{ after: string; before: string; days: number }> = [];
    const highActivityPeriods: Array<{ start: string; end: string; eventCount: number }> = [];

    if (events.length < 2) return { gaps, highActivityPeriods };

    // Gaps: consecutive events >14 days apart (noteworthy quiet stretch)
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].date).getTime();
      const curr = new Date(events[i].date).getTime();
      const days = (curr - prev) / 86_400_000;
      if (days > 14) {
        gaps.push({
          after: events[i - 1].date,
          before: events[i].date,
          days: Number(days.toFixed(1)),
        });
      }
    }

    // High-activity: sliding 24-hour window with >=5 events
    for (let i = 0; i < events.length; i++) {
      const start = new Date(events[i].date).getTime();
      let count = 1;
      let endIdx = i;
      for (let j = i + 1; j < events.length; j++) {
        const t = new Date(events[j].date).getTime();
        if (t - start <= 86_400_000) {
          count++;
          endIdx = j;
        } else break;
      }
      if (count >= 5) {
        highActivityPeriods.push({
          start: events[i].date,
          end: events[endIdx].date,
          eventCount: count,
        });
        i = endIdx; // skip ahead to avoid overlapping reports
      }
    }

    return { gaps, highActivityPeriods };
  }

  private static coerceDate(row: any): Date | null {
    const v = row?.transactionDate ?? row?.Date ?? row?.date;
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  private static coerceAmount(row: any): number | null {
    const v = row?.totalAmount ?? row?.Amount ?? row?.amount;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^0-9.\-]/g, ''));
      return isNaN(p) ? null : p;
    }
    return null;
  }

  private static coerceVendor(row: any): string | null {
    const v = row?.Vendor ?? row?.vendor;
    return v ? String(v) : null;
  }

  private static fmtAmount(n: number): string {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  private static rowSummary(row: Record<string, any>): string {
    const entries = Object.entries(row).slice(0, 4);
    return entries.map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' · ');
  }
}

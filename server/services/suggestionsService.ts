/**
 * Dynamic chat-mode suggestions service.
 *
 * Builds 2-3 visually-distinct chips per mode from three sources:
 *   1. recent      → user's recent conversation titles in this mode
 *   2. calendar    → upcoming ICAI / GST / income-tax compliance deadlines
 *   3. circular    → curated highlights from recent Council circulars / KB
 *
 * Each chip carries a `source` tag so the UI can colour/iconify it.
 */

import { db } from '../db';
import { conversations } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { CanonicalChatMode as ChatMode } from './chatModeNormalizer';

export type SuggestionSource = 'recent' | 'calendar' | 'circular';

export interface Suggestion {
  id: string;
  prompt: string;        // text inserted into the composer when clicked
  label: string;         // display text on the chip (may be shorter)
  source: SuggestionSource;
  hint?: string;         // small secondary text (e.g. "Due in 4 days")
}

// ---------------------------------------------------------------------------
// 1. ICAI / GST / IT compliance calendar
// ---------------------------------------------------------------------------
//
// Recurring monthly + annual deadlines. We compute the *next* occurrence of
// each rule relative to today and return the ones falling inside the next
// 14 days, sorted by proximity.

interface CalendarRule {
  /** Day of month (1-31) when the deadline falls. */
  dayOfMonth: number;
  /** Months in which this rule applies. Empty = every month. */
  months?: number[];      // 1-12
  /** Modes for which this deadline is relevant. */
  modes: ChatMode[];
  label: string;          // short chip label
  prompt: string;         // full prompt sent to the model
}

const CALENDAR: CalendarRule[] = [
  {
    dayOfMonth: 11,
    modes: ['standard', 'checklist', 'workflow'],
    label: 'GSTR-1 due',
    prompt: 'Walk me through the GSTR-1 filing checklist for this month with deadline considerations',
  },
  {
    dayOfMonth: 20,
    modes: ['standard', 'checklist', 'calculation'],
    label: 'GSTR-3B due',
    prompt: 'Prepare a GSTR-3B summary checklist covering output liability, ITC reconciliation and late-fee rules',
  },
  {
    dayOfMonth: 7,
    modes: ['standard', 'calculation', 'checklist'],
    label: 'TDS payment due',
    prompt: 'Summarise the TDS deposit deadline for the previous month including section-wise rates and interest implications',
  },
  {
    dayOfMonth: 15,
    months: [6, 9, 12, 3],
    modes: ['standard', 'calculation', 'checklist'],
    label: 'Advance tax instalment',
    prompt: 'Compute the advance-tax instalment due this quarter with cumulative target and shortfall interest under Sec 234C',
  },
  {
    dayOfMonth: 31,
    months: [7],
    modes: ['standard', 'audit-plan', 'checklist'],
    label: 'ITR (non-audit) due',
    prompt: 'Build an ITR filing checklist for non-audit individual taxpayers covering Form 26AS reconciliation and Schedule AL',
  },
  {
    dayOfMonth: 30,
    months: [9],
    modes: ['audit-plan', 'checklist', 'standard'],
    label: 'Tax audit (3CD) due',
    prompt: 'Draft the Form 3CD tax-audit reporting plan covering clauses 44, 21, 18 and the recent CBDT amendments',
  },
  {
    dayOfMonth: 31,
    months: [10],
    modes: ['standard', 'audit-plan'],
    label: 'ITR (audit) due',
    prompt: 'Prepare the ITR-6 audit-case filing checklist including Form 3CEB and transfer pricing schedules',
  },
  {
    dayOfMonth: 31,
    months: [12],
    modes: ['standard', 'checklist', 'audit-plan'],
    label: 'GSTR-9 / 9C due',
    prompt: 'Walk me through the GSTR-9 and GSTR-9C reconciliation checklist for the previous financial year',
  },
  {
    dayOfMonth: 30,
    months: [4],
    modes: ['standard', 'audit-plan', 'deliverable-composer'],
    label: 'Statutory audit (AGM)',
    prompt: 'Outline the statutory-audit closure plan for the financial year ending 31 March with key materiality thresholds',
  },
];

function daysUntil(target: Date, now: Date): number {
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}

function nextOccurrence(rule: CalendarRule, now: Date): Date | null {
  const candidates: Date[] = [];
  for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth() + monthOffset, rule.dayOfMonth);
    if (rule.months && !rule.months.includes(candidate.getMonth() + 1)) continue;
    if (candidate < now) continue;
    candidates.push(candidate);
    if (candidates.length >= 1) break;
  }
  return candidates[0] ?? null;
}

function calendarSuggestions(mode: ChatMode, now: Date, max = 2): Suggestion[] {
  const out: Array<Suggestion & { _days: number }> = [];
  for (const rule of CALENDAR) {
    if (!rule.modes.includes(mode)) continue;
    const next = nextOccurrence(rule, now);
    if (!next) continue;
    const days = daysUntil(next, now);
    if (days < 0 || days > 30) continue;
    out.push({
      _days: days,
      id: `cal-${rule.dayOfMonth}-${rule.label.replace(/\s+/g, '-')}`,
      prompt: rule.prompt,
      label: rule.label,
      source: 'calendar',
      hint: days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`,
    });
  }
  out.sort((a, b) => a._days - b._days);
  return out.slice(0, max).map(({ _days, ...s }) => s);
}

// ---------------------------------------------------------------------------
// 2. Recent conversations in this mode
// ---------------------------------------------------------------------------

async function recentSuggestions(userId: string, mode: ChatMode, max = 2): Promise<Suggestion[]> {
  try {
    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.chatMode, mode)))
      .orderBy(desc(conversations.updatedAt))
      .limit(5);

    return rows.slice(0, max).map((r) => {
      const trimmed = (r.title ?? 'Untitled').trim().replace(/\s+/g, ' ');
      const short = trimmed.length > 64 ? trimmed.slice(0, 61) + '…' : trimmed;
      return {
        id: `recent-${r.id}`,
        prompt: `Continue the discussion: ${short}`,
        label: short,
        source: 'recent',
        hint: 'Recent topic',
      };
    });
  } catch (err) {
    console.warn('[suggestionsService] recentSuggestions failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. Curated circular / KB highlights
// ---------------------------------------------------------------------------
//
// Hand-curated, mode-aware editorial picks. Refreshed via deploys until an
// automated circulars-KB feed lands.

interface CircularHighlight {
  modes: ChatMode[];
  label: string;
  prompt: string;
  hint?: string;
}

const CIRCULARS: CircularHighlight[] = [
  {
    modes: ['standard', 'deep-research'],
    label: 'CBDT Circular on Sec 194R',
    prompt: 'Summarise the latest CBDT clarification on Sec 194R applicability for sales promotion expenses',
    hint: 'Recent circular',
  },
  {
    modes: ['standard', 'deep-research'],
    label: 'GST Council 53rd meeting',
    prompt: 'Summarise the key recommendations from the 53rd GST Council meeting and rate revisions',
    hint: 'Council update',
  },
  {
    modes: ['audit-plan', 'standard'],
    label: 'NFRA inspection findings',
    prompt: 'Highlight common audit-quality findings from the latest NFRA inspection report and remedial actions',
    hint: 'Regulator focus',
  },
  {
    modes: ['deep-research', 'standard'],
    label: 'Ind AS amendments 2026',
    prompt: 'Walk me through the latest Ind AS amendments effective this financial year with transition guidance',
    hint: 'Standard update',
  },
  {
    modes: ['calculation', 'scenario-simulator'],
    label: 'Buyback tax shift',
    prompt: 'Model the post-amendment tax impact of share buybacks now taxed as deemed dividend in the shareholder\u2019s hands',
    hint: 'Recent amendment',
  },
  {
    modes: ['workflow', 'checklist'],
    label: 'e-Invoicing AATO threshold',
    prompt: 'Build the e-invoicing onboarding workflow now that the AATO threshold is ₹5 crore',
    hint: 'Threshold change',
  },
  {
    modes: ['forensic-intelligence'],
    label: 'Fake-ITC racket signals',
    prompt: 'List the red-flag indicators identified by DGGI in recent fake-ITC investigations and a forensic test plan',
    hint: 'Investigation pattern',
  },
  {
    modes: ['roundtable'],
    label: 'GAAR vs SAAR debate',
    prompt: 'Convene a panel debate on when GAAR overrides SAAR provisions in cross-border holding structures',
    hint: 'Hot topic',
  },
  {
    modes: ['spreadsheet', 'calculation'],
    label: 'New tax-regime breakeven',
    prompt: 'Build a workbook computing the salary breakeven where new tax regime overtakes the old regime for FY26',
    hint: 'Investor question',
  },
  {
    modes: ['deliverable-composer'],
    label: 'CARO 2020 boilerplate refresh',
    prompt: 'Draft the CARO 2020 reporting paragraphs for a manufacturing company with updated clause 3(xxi) language',
    hint: 'Reporting standard',
  },
  {
    modes: ['scenario-simulator'],
    label: 'Repo-rate stress scenario',
    prompt: 'Stress-test borrower DSCR if RBI hikes the repo rate by 75 bps and lending spreads widen 30 bps',
    hint: 'Macro scenario',
  },
];

function circularSuggestions(mode: ChatMode, max = 2): Suggestion[] {
  const matching = CIRCULARS.filter((c) => c.modes.includes(mode));
  return matching.slice(0, max).map((c, i) => ({
    id: `circ-${mode}-${i}`,
    prompt: c.prompt,
    label: c.label,
    source: 'circular',
    hint: c.hint,
  }));
}

// ---------------------------------------------------------------------------
// Combiner
// ---------------------------------------------------------------------------

export async function buildSuggestions(params: {
  userId: string;
  mode: ChatMode;
  now?: Date;
  count?: number;
}): Promise<Suggestion[]> {
  const now = params.now ?? new Date();
  const target = Math.max(2, Math.min(params.count ?? 3, 4));

  const [recent, calendar, circular] = await Promise.all([
    recentSuggestions(params.userId, params.mode, 1),
    Promise.resolve(calendarSuggestions(params.mode, now, 2)),
    Promise.resolve(circularSuggestions(params.mode, 2)),
  ]);

  // Priority: 1 calendar (most time-sensitive) → 1 recent (continuity) → fill from circulars.
  const picked: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s?: Suggestion) => {
    if (!s) return;
    const key = s.prompt.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(s);
  };

  push(calendar[0]);
  push(recent[0]);
  for (const s of circular) {
    if (picked.length >= target) break;
    push(s);
  }
  for (const s of calendar.slice(1)) {
    if (picked.length >= target) break;
    push(s);
  }

  return picked.slice(0, target);
}

// Test seam — exposed for unit tests, not the runtime path.
export const __suggestionsTestInternals = {
  CALENDAR,
  CIRCULARS,
  calendarSuggestions,
  circularSuggestions,
  nextOccurrence,
  daysUntil,
};

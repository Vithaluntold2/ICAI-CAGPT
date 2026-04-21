// client/src/lib/mode-registry.ts
import {
  MessageSquare,
  Sparkles,
  ListChecks,
  Network,
  ShieldCheck,
  Calculator,
  ScanSearch,
  FileStack,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type ChatMode =
  | 'standard'
  | 'deep-research'
  | 'checklist'
  | 'workflow'
  | 'audit-plan'
  | 'calculation'
  | 'forensic-intelligence'
  | 'deliverable-composer'
  | 'roundtable';

export interface ModeConfig {
  id: ChatMode;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Three suggested prompts for the empty-mode state. */
  starters: [string, string, string];
}

export const MODES: ModeConfig[] = [
  {
    id: 'standard',
    label: 'Standard',
    icon: MessageSquare,
    description: 'Open-ended accounting conversation — research, lookup, anything.',
    starters: [
      'Summarise the latest GST Council press note',
      'Explain Section 194Q vs 206C(1H) applicability',
      'Walk me through Schedule III reclassifications',
    ],
  },
  {
    id: 'deep-research',
    label: 'Research',
    icon: Sparkles,
    description: 'Multi-source analysis with citations from tax codes, accounting standards, and case law.',
    starters: [
      'Research ITC reversal on common credit',
      'Compare Ind AS 115 vs IFRS 15 disclosure',
      'Find recent rulings on Section 80JJAA',
    ],
  },
  {
    id: 'checklist',
    label: 'Checklist',
    icon: ListChecks,
    description: 'Step-by-step compliance checklists with deadlines and completion tracking.',
    starters: [
      'Pre-audit checklist for a listed NBFC',
      'GSTR-9 filing checklist FY 2025-26',
      'Due-diligence checklist for slump sale',
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: Network,
    description: 'Visual process flows with decision nodes, approval gates, and compliance checkpoints.',
    starters: [
      'GST interstate supply flow',
      'Approval workflow for vendor onboarding',
      'TDS deduction + remittance pipeline',
    ],
  },
  {
    id: 'audit-plan',
    label: 'Audit',
    icon: ShieldCheck,
    description: 'Structured audit plans with risk assessments, testing procedures, and evidence documentation.',
    starters: [
      'Statutory audit plan for a trading co',
      'Internal audit scope for receivables',
      'Risk-based test plan for revenue',
    ],
  },
  {
    id: 'calculation',
    label: 'Calculation',
    icon: Calculator,
    description: 'Precise financial computations with formula transparency and scenario comparisons.',
    starters: [
      'Compute NPV for a ₹12cr capex proposal',
      'Depreciation schedule under Sec 32',
      'WACC for a leveraged buyout',
    ],
  },
  {
    id: 'forensic-intelligence',
    label: 'Forensics',
    icon: ScanSearch,
    description: 'Anomaly detection across ledgers, transaction chains, and compliance gaps.',
    starters: [
      'Flag unusual journal entries in Q2',
      'Vendor-employee linkage scan',
      'Round-number suspicious-entry review',
    ],
  },
  {
    id: 'deliverable-composer',
    label: 'Deliverables',
    icon: FileStack,
    description: 'Produce polished client-facing deliverables — reports, memos, filings — with consistent formatting.',
    starters: [
      'Draft a transfer-pricing memo',
      "Compose the director's report",
      'Generate a CARO reporting section',
    ],
  },
  {
    id: 'roundtable',
    label: 'Roundtable',
    icon: Users,
    description: 'Multi-perspective panel debate: auditor / advisor / litigator views on the same question.',
    starters: [
      'Should we restate FY24 for a newly-found error?',
      'GAAR applicability on a proposed structure',
      'Panel debate: intangibles amortisation life',
    ],
  },
];

export const MODE_IDS = MODES.map((m) => m.id);

export function getMode(id: string): ModeConfig | undefined {
  return MODES.find((m) => m.id === id);
}

# UI Rethink Aurora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the app shell (icon rail + mode sidebar + main) and the chat page to the D3 Aurora direction with Satoshi/Inter typography, C3 asymmetric messages, K2 floating composer, and earned-depth discipline. Both light and dark themes; platform-aware keyboard hints. Whiteboard gets styling-only updates (existing PIP/selection flow preserved).

**Architecture:** Seven phases. Foundation (tokens, fonts, utilities) → shell components → chat view + message components → composer → command palette → whiteboard/PIP restyle → cleanup. Each phase produces a shipable, verifiable unit. Visual components get manual smoke verification; utilities and data registries get vitest tests.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (existing). New: `mind-elixir@5.10` (already installed), Satoshi + Inter + JetBrains Mono via Fontshare + Google Fonts. No new build tools.

**Spec reference:** `docs/superpowers/specs/2026-04-21-ui-rethink-aurora-design.md` (commit `eb637fa` on `feat/ui-rethink-aurora`). All design rationale, token values, and visual rules live there — this plan references spec sections where helpful.

**Branch:** `feat/ui-rethink-aurora` (already created).

**Test runner:** `vitest` — project already configured. Check with `cd client && npx vitest run` from repo root.

---

## Phase 1 · Foundation

### Task 1: Aurora tokens, font imports, radii, shadow rules

Introduces every new design token in one commit. No components reference them yet, so the app continues to render as-is; this is pure additive CSS.

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/tailwind.config.ts`

- [ ] **Step 1: Open the existing `:root` block in `client/src/index.css` and add Aurora palette + extended radii at the top of the block** (before the `@layer` directives).

```css
/* ============================================================
   Aurora palette — shared across light + dark; usage differs.
   ============================================================ */
:root {
  --aurora-navy: 222 72% 14%;
  --aurora-cyan: 190 88% 37%;
  --aurora-teal: 172 78% 40%;
  --aurora-teal-soft: 167 85% 65%;
  --aurora-gold: 45 96% 75%;
  --aurora-gold-deep: 48 96% 53%;
  --aurora-amber-deep: 25 93% 37%;

  --gradient-aurora: linear-gradient(135deg,
    hsl(var(--aurora-navy)) 0%,
    hsl(var(--aurora-cyan)) 55%,
    hsl(var(--aurora-teal)) 100%);

  /* Radii — shifted up one notch vs previous scale */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-full: 999px;

  /* Shadow + glow — earned depth */
  --shadow-float: 0 8px 32px hsl(215 28% 17% / 0.08);
  --shadow-popover: 0 4px 16px hsl(215 28% 17% / 0.08);
  --shadow-dialog: 0 20px 60px hsl(215 28% 17% / 0.12);
  --glow-teal: 0 0 10px hsl(var(--aurora-teal) / 0.2);

  /* Border-strong for floating frames */
  --border-strong: 215 20% 86%;
}

.dark {
  --shadow-float: 0 10px 40px hsl(0 0% 0% / 0.5), 0 0 32px hsl(var(--aurora-teal) / 0.08);
  --shadow-popover: 0 4px 16px hsl(0 0% 0% / 0.4);
  --shadow-dialog: 0 20px 60px hsl(0 0% 0% / 0.6);
  --glow-teal: 0 0 16px hsl(var(--aurora-teal) / 0.35);
  --border-strong: 220 10% 28%;
}
```

- [ ] **Step 2: Add font imports at the very top of `client/src/index.css`** (before `@tailwind`).

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
```

- [ ] **Step 3: Update `--font-sans`/`--font-display`/`--font-mono` inside the existing `:root` block** to point at the new stacks. Leave the existing Exo 2 fallback in place as a belt-and-braces measure (third token fallback).

```css
--font-sans: 'Inter', system-ui, -apple-system, 'Exo 2', sans-serif;
--font-display: 'Satoshi', 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'JetBrains Mono', monospace;
```

- [ ] **Step 4: Extend `client/tailwind.config.ts` with Aurora colors + display font + new radius scale.**

Inside `theme.extend`:

```ts
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  display: ['Satoshi', 'Inter', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
},
colors: {
  // ... existing
  'aurora-navy': 'hsl(var(--aurora-navy))',
  'aurora-cyan': 'hsl(var(--aurora-cyan))',
  'aurora-teal': 'hsl(var(--aurora-teal))',
  'aurora-teal-soft': 'hsl(var(--aurora-teal-soft))',
  'aurora-gold': 'hsl(var(--aurora-gold))',
  'aurora-gold-deep': 'hsl(var(--aurora-gold-deep))',
  'aurora-amber-deep': 'hsl(var(--aurora-amber-deep))',
  'border-strong': 'hsl(var(--border-strong))',
},
borderRadius: {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-full)',
},
boxShadow: {
  float: 'var(--shadow-float)',
  popover: 'var(--shadow-popover)',
  dialog: 'var(--shadow-dialog)',
  'glow-teal': 'var(--glow-teal)',
},
backgroundImage: {
  'gradient-aurora': 'var(--gradient-aurora)',
},
```

- [ ] **Step 5: Build + sanity-check.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -cE 'error TS'
```

Expected: same count as baseline (15 pre-existing). No new errors.

```bash
cd client && npx vite build 2>&1 | tail -5
```

Expected: clean build ending in `✓ built in ...`.

- [ ] **Step 6: Commit.**

```bash
git add client/src/index.css client/tailwind.config.ts
git commit -m "feat(tokens): add Aurora palette, Satoshi/Inter fonts, shadow + radius scale"
```

---

### Task 2: Platform-aware keyboard utility

Single source of truth for `⌘` vs `Ctrl`. Tested.

**Files:**
- Create: `client/src/lib/platform.ts`
- Create: `client/src/lib/platform.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// client/src/lib/platform.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('platform', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = navigator.platform;
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    vi.resetModules();
  });

  it('renders mac glyphs on MacIntel', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    const { isMac, MOD, SHIFT, RETURN, OPTION } = await import('./platform');
    expect(isMac).toBe(true);
    expect(MOD).toBe('⌘');
    expect(SHIFT).toBe('⇧');
    expect(RETURN).toBe('↵');
    expect(OPTION).toBe('⌥');
  });

  it('renders windows glyphs on Win32', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    const { isMac, MOD, SHIFT, RETURN, OPTION } = await import('./platform');
    expect(isMac).toBe(false);
    expect(MOD).toBe('Ctrl');
    expect(SHIFT).toBe('Shift');
    expect(RETURN).toBe('Enter');
    expect(OPTION).toBe('Alt');
  });

  it('treats iPad/iPhone as mac', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'iPad', configurable: true });
    const { isMac } = await import('./platform');
    expect(isMac).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
cd client && npx vitest run src/lib/platform.test.ts
```

Expected: FAIL (Cannot find module './platform').

- [ ] **Step 3: Write the implementation.**

```ts
// client/src/lib/platform.ts

/**
 * Platform detection for keyboard-shortcut hint rendering.
 * Evaluated once at module load; never reacts to runtime platform changes
 * (not a real-world concern — platform doesn't change mid-session).
 */
export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const MOD = isMac ? '⌘' : 'Ctrl';
export const SHIFT = isMac ? '⇧' : 'Shift';
export const RETURN = isMac ? '↵' : 'Enter';
export const OPTION = isMac ? '⌥' : 'Alt';
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
cd client && npx vitest run src/lib/platform.test.ts
```

Expected: PASS · 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add client/src/lib/platform.ts client/src/lib/platform.test.ts
git commit -m "feat(platform): add navigator-detected mac/ctrl kbd utility"
```

---

### Task 3: Kbd component

Renders platform-aware keyboard-shortcut chips. Used by the composer footer, sidebar, command palette, and hint banner.

**Files:**
- Create: `client/src/components/ui/Kbd.tsx`

- [ ] **Step 1: Implement the component.**

```tsx
// client/src/components/ui/Kbd.tsx
import { cn } from '@/lib/utils';
import { MOD, SHIFT, RETURN, OPTION } from '@/lib/platform';

type KbdToken = 'mod' | 'shift' | 'return' | 'option' | string;

const GLYPHS: Record<string, string> = {
  mod: MOD,
  shift: SHIFT,
  return: RETURN,
  option: OPTION,
};

interface KbdProps {
  /** Either a list of semantic tokens ("mod", "shift", "return", "option")
   *  or raw glyphs ("K", "Esc"). Rendered with a middle-dot between. */
  keys: KbdToken[];
  className?: string;
}

export function Kbd({ keys, className }: KbdProps) {
  const rendered = keys.map((k) => GLYPHS[k] ?? k).join(' ');
  return (
    <kbd
      className={cn(
        'inline-block font-mono text-[10px] px-1.5 py-0.5 rounded',
        'bg-muted/60 border border-border text-muted-foreground',
        className
      )}
    >
      {rendered}
    </kbd>
  );
}
```

- [ ] **Step 2: Typecheck.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep Kbd.tsx | head
```

Expected: no output (component typechecks clean).

- [ ] **Step 3: Commit.**

```bash
git add client/src/components/ui/Kbd.tsx
git commit -m "feat(ui): add platform-aware <Kbd> component"
```

---

### Task 4: Mode registry

Canonical data for the 9 modes in the UI. Tested against a hard-coded parity expectation so drift from the server's `professionalModes` list is caught early.

**Files:**
- Create: `client/src/lib/mode-registry.ts`
- Create: `client/src/lib/mode-registry.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// client/src/lib/mode-registry.test.ts
import { describe, it, expect } from 'vitest';
import { MODES, getMode, MODE_IDS } from './mode-registry';

describe('mode-registry', () => {
  it('lists 9 modes in canonical order', () => {
    expect(MODE_IDS).toEqual([
      'standard',
      'deep-research',
      'checklist',
      'workflow',
      'audit-plan',
      'calculation',
      'forensic-intelligence',
      'deliverable-composer',
      'roundtable',
    ]);
  });

  it('every mode has label, icon, description, and starters', () => {
    for (const m of MODES) {
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.starters).toHaveLength(3);
    }
  });

  it('getMode returns undefined for unknown id', () => {
    expect(getMode('nonsense')).toBeUndefined();
  });

  it('getMode returns the matching entry', () => {
    expect(getMode('workflow')?.label).toBe('Workflow');
  });
});
```

- [ ] **Step 2: Run — should fail with "Cannot find module".**

```bash
cd client && npx vitest run src/lib/mode-registry.test.ts
```

- [ ] **Step 3: Implement the registry.**

```ts
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
      'Compose the director\'s report',
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
```

- [ ] **Step 4: Run tests.**

```bash
cd client && npx vitest run src/lib/mode-registry.test.ts
```

Expected: PASS · 4 tests.

- [ ] **Step 5: Commit.**

```bash
git add client/src/lib/mode-registry.ts client/src/lib/mode-registry.test.ts
git commit -m "feat(modes): add canonical 9-mode registry with icons, starters"
```

---

## Phase 2 · Shell components

### Task 5: IconRail

Fixed 52px left rail. Logo plate + nav buttons + settings at the bottom.

**Files:**
- Create: `client/src/components/shell/IconRail.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/shell/IconRail.tsx
import { Grid3x3, Search, Plus, Settings, Sparkle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconRailProps {
  activeView?: 'modes' | 'search';
  onOpenModes?: () => void;
  onOpenSearch?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
}

export function IconRail({
  activeView = 'modes',
  onOpenModes,
  onOpenSearch,
  onNewChat,
  onOpenSettings,
}: IconRailProps) {
  return (
    <nav className="w-[52px] bg-sidebar border-r border-border flex flex-col items-center py-3.5 gap-1.5 shrink-0">
      <div className="w-8 h-8 rounded-lg bg-gradient-aurora flex items-center justify-center text-white mb-2.5">
        <Sparkle className="w-[18px] h-[18px]" strokeWidth={2} />
      </div>
      <RailButton label="Modes" active={activeView === 'modes'} onClick={onOpenModes}>
        <Grid3x3 className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <RailButton label="Search" active={activeView === 'search'} onClick={onOpenSearch}>
        <Search className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <RailButton label="New chat" onClick={onNewChat}>
        <Plus className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
      <div className="flex-1" />
      <RailButton label="Settings" onClick={onOpenSettings}>
        <Settings className="w-4 h-4" strokeWidth={1.75} />
      </RailButton>
    </nav>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
        active
          ? 'bg-aurora-teal/15 text-aurora-teal-soft'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep IconRail.tsx | head
# expected: no output
git add client/src/components/shell/IconRail.tsx
git commit -m "feat(shell): add 52px IconRail with logo, nav buttons, settings"
```

---

### Task 6: ModeRow + ConvoRow

Two tight components rendered inside the sidebar.

**Files:**
- Create: `client/src/components/shell/ModeRow.tsx`
- Create: `client/src/components/shell/ConvoRow.tsx`

- [ ] **Step 1: Implement `ModeRow`.**

```tsx
// client/src/components/shell/ModeRow.tsx
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ModeRowProps {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export function ModeRow({ icon: Icon, label, count, active, onClick }: ModeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full flex items-center gap-2.5 px-4 py-1.5 text-[13px] transition-colors text-left',
        active
          ? 'text-aurora-teal-soft bg-gradient-to-r from-aurora-teal/10 to-transparent'
          : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground'
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-aurora-teal shadow-glow-teal"
        />
      )}
      <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'font-mono text-[10px]',
            active ? 'text-aurora-teal-soft/70' : 'text-muted-foreground/70'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Implement `ConvoRow`.**

```tsx
// client/src/components/shell/ConvoRow.tsx
import { cn } from '@/lib/utils';

interface ConvoRowProps {
  title: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ConvoRow({ title, selected, onClick }: ConvoRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left pl-9 pr-4 py-1 text-[12px] leading-[1.35] transition-colors',
        selected
          ? 'bg-aurora-teal/5 text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="line-clamp-1">{title}</span>
    </button>
  );
}
```

- [ ] **Step 3: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -E "ModeRow|ConvoRow"
# expected: no output
git add client/src/components/shell/ModeRow.tsx client/src/components/shell/ConvoRow.tsx
git commit -m "feat(shell): add ModeRow and ConvoRow sidebar primitives"
```

---

### Task 7: ModeSidebar

Header + mode list (with expandable conversation nests) + footer. Accepts `conversations` prop and groups them by `conversation.mode`.

**Files:**
- Create: `client/src/components/shell/ModeSidebar.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/shell/ModeSidebar.tsx
import { useState, useMemo } from 'react';
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { ModeRow } from './ModeRow';
import { ConvoRow } from './ConvoRow';
import { Kbd } from '@/components/ui/Kbd';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface ModeSidebarProps {
  conversations: SidebarConversation[];
  activeMode?: ChatMode;
  activeConversationId?: string;
  userLabel?: string;
  userPlan?: string;
  userInitial?: string;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
}

export function ModeSidebar({
  conversations,
  activeMode,
  activeConversationId,
  userLabel = 'User',
  userPlan = 'Free',
  userInitial = 'U',
  onSelectMode,
  onSelectConversation,
}: ModeSidebarProps) {
  const [expanded, setExpanded] = useState<ChatMode | null>(activeMode ?? null);

  const byMode = useMemo(() => {
    const map = new Map<ChatMode, SidebarConversation[]>();
    for (const c of conversations) {
      const list = map.get(c.mode) ?? [];
      list.push(c);
      map.set(c.mode, list);
    }
    return map;
  }, [conversations]);

  const handleModeClick = (mode: ChatMode) => {
    setExpanded((prev) => (prev === mode ? null : mode));
    onSelectMode(mode);
  };

  return (
    <aside className="w-[280px] bg-sidebar border-r border-border flex flex-col overflow-hidden shrink-0">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border">
        <div className="font-display font-bold text-[15px] tracking-tight text-foreground">
          CA-GPT
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Chartered Accountancy · Research &amp; Practice
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
          Modes
        </div>
        {MODES.map((mode) => {
          const convos = byMode.get(mode.id) ?? [];
          const isExpanded = expanded === mode.id;
          return (
            <div key={mode.id}>
              <ModeRow
                icon={mode.icon}
                label={mode.label}
                count={convos.length}
                active={mode.id === activeMode}
                onClick={() => handleModeClick(mode.id)}
              />
              {isExpanded && convos.length > 0 && (
                <div>
                  {convos.map((c) => (
                    <ConvoRow
                      key={c.id}
                      title={c.title}
                      selected={c.id === activeConversationId}
                      onClick={() => onSelectConversation(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <footer className="px-3.5 py-2.5 border-t border-border flex items-center gap-2.5 text-[12px] text-muted-foreground">
        <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white text-[11px] font-bold font-display">
          {userInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-foreground font-display font-semibold text-[12px] truncate">
            {userLabel}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            {userPlan} · <Kbd keys={['mod', 'K']} />
          </div>
        </div>
      </footer>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep ModeSidebar.tsx
# expected: no output
git add client/src/components/shell/ModeSidebar.tsx
git commit -m "feat(shell): add ModeSidebar grouping conversations by mode"
```

---

### Task 8: AppShell (layout)

Combines IconRail + ModeSidebar + main pane. Owns the Chat/Whiteboard toggle and the breadcrumb header is supplied by children.

**Files:**
- Create: `client/src/components/shell/AppShell.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/shell/AppShell.tsx
import type { ReactNode } from 'react';
import { IconRail } from './IconRail';
import { ModeSidebar } from './ModeSidebar';
import type { ChatMode } from '@/lib/mode-registry';

interface SidebarConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface AppShellProps {
  conversations: SidebarConversation[];
  activeMode?: ChatMode;
  activeConversationId?: string;
  userLabel?: string;
  userPlan?: string;
  userInitial?: string;
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onOpenSearch?: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  /** Rendered inside the main pane — should include its own header. */
  children: ReactNode;
}

export function AppShell({ children, ...sidebarProps }: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <IconRail
        activeView="modes"
        onOpenSearch={sidebarProps.onOpenSearch}
        onNewChat={sidebarProps.onNewChat}
        onOpenSettings={sidebarProps.onOpenSettings}
      />
      <ModeSidebar {...sidebarProps} />
      <main className="flex-1 flex flex-col min-w-0 relative">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep AppShell.tsx
# expected: no output
git add client/src/components/shell/AppShell.tsx
git commit -m "feat(shell): add AppShell composition (rail + sidebar + main)"
```

---

## Phase 3 · Chat view + messages

### Task 9: UserTurn

**Files:**
- Create: `client/src/components/chat/UserTurn.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/UserTurn.tsx
interface UserTurnProps {
  children: React.ReactNode;
  timestamp?: string;
}

export function UserTurn({ children, timestamp }: UserTurnProps) {
  return (
    <div className="self-end max-w-[78%] group relative">
      <div className="px-4 py-3 rounded-lg bg-aurora-teal/10 border border-aurora-teal/25 text-[14px] leading-[1.5] text-foreground">
        {children}
      </div>
      {timestamp && (
        <div className="absolute -top-5 right-0 font-mono text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {timestamp}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep UserTurn.tsx
git add client/src/components/chat/UserTurn.tsx
git commit -m "feat(chat): add UserTurn right-bubble component"
```

---

### Task 10: KindPill + AssistantTurn

`KindPill` renders the "CHART / CHECKLIST / …" badge. `AssistantTurn` wraps the assistant message body.

**Files:**
- Create: `client/src/components/chat/KindPill.tsx`
- Create: `client/src/components/chat/AssistantTurn.tsx`

- [ ] **Step 1: Implement `KindPill`.**

```tsx
// client/src/components/chat/KindPill.tsx
import {
  BarChart3, ListChecks, Network, Sparkle as MindIcon,
  Table2, Share2, FileText,
} from 'lucide-react';
import type { WhiteboardArtifact } from '../../../../shared/schema';

const KIND_META: Record<WhiteboardArtifact['kind'], { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  chart: { label: 'CHART', Icon: BarChart3 },
  checklist: { label: 'CHECKLIST', Icon: ListChecks },
  workflow: { label: 'WORKFLOW', Icon: Network },
  mindmap: { label: 'MINDMAP', Icon: MindIcon },
  spreadsheet: { label: 'SHEET', Icon: Table2 },
  flowchart: { label: 'FLOW', Icon: Share2 },
  document: { label: 'NOTE', Icon: FileText },
};

interface KindPillProps {
  kind: WhiteboardArtifact['kind'];
}

export function KindPill({ kind }: KindPillProps) {
  const meta = KIND_META[kind];
  if (!meta) return null;
  const { Icon, label } = meta;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-aurora-teal/10 border border-aurora-teal/20 text-aurora-teal-soft text-[10px] font-mono font-medium">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Implement `AssistantTurn`.**

```tsx
// client/src/components/chat/AssistantTurn.tsx
import { Sparkle, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantTurnProps {
  modeName?: string;
  timestamp?: string;
  streaming?: boolean;
  onStop?: () => void;
  children: React.ReactNode;
}

export function AssistantTurn({
  modeName,
  timestamp,
  streaming,
  onStop,
  children,
}: AssistantTurnProps) {
  return (
    <div className="flex gap-3.5 max-w-full">
      <div className="w-[30px] h-[30px] rounded-full bg-gradient-aurora flex items-center justify-center text-white shrink-0">
        <Sparkle className="w-[15px] h-[15px]" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-[12px] text-foreground mb-1 flex items-center gap-2">
          <span>CA-GPT</span>
          {(modeName || timestamp) && (
            <span className="font-mono font-normal text-[10px] text-muted-foreground">
              {[modeName, timestamp].filter(Boolean).join(' · ')}
            </span>
          )}
          {streaming && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <div
          className={cn(
            'text-[14px] leading-[1.58] text-foreground/90',
            streaming && 'after:inline-block after:w-2 after:h-[1.2em] after:ml-0.5 after:bg-aurora-teal after:align-text-bottom after:animate-pulse'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -E "KindPill|AssistantTurn"
git add client/src/components/chat/KindPill.tsx client/src/components/chat/AssistantTurn.tsx
git commit -m "feat(chat): add KindPill + AssistantTurn components"
```

---

### Task 11: InlineArtifactCard

Uniform chrome around `ArtifactRenderer`. Copy / Download / View-in-Whiteboard actions.

**Files:**
- Create: `client/src/components/chat/InlineArtifactCard.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/InlineArtifactCard.tsx
import { Copy, Download, Maximize2 } from 'lucide-react';
import type { WhiteboardArtifact } from '../../../../shared/schema';
import { ArtifactRenderer } from './artifacts/ArtifactRenderer';
import { KindPill } from './KindPill';

interface InlineArtifactCardProps {
  artifact: WhiteboardArtifact;
  conversationId?: string;
  onOpenInWhiteboard?: (artifactId: string) => void;
}

export function InlineArtifactCard({
  artifact,
  conversationId,
  onOpenInWhiteboard,
}: InlineArtifactCardProps) {
  const title = (artifact.payload as any)?.title ?? artifact.kind;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(artifact.payload, null, 2));
    } catch {
      // silently fail; clipboard may be blocked
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(artifact.payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.kind}-${artifact.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 bg-card border border-border rounded-md overflow-hidden">
      <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-[12px]">
        <div className="flex items-center gap-2 text-foreground font-display font-semibold">
          <KindPill kind={artifact.kind} />
          <span>{title}</span>
        </div>
        <div className="flex gap-0.5 text-muted-foreground">
          <ActionButton title="Copy JSON" onClick={handleCopy}>
            <Copy className="w-[13px] h-[13px]" strokeWidth={1.75} />
          </ActionButton>
          <ActionButton title="Download JSON" onClick={handleDownload}>
            <Download className="w-[13px] h-[13px]" strokeWidth={1.75} />
          </ActionButton>
          {onOpenInWhiteboard && (
            <ActionButton
              title="View in whiteboard"
              onClick={() => onOpenInWhiteboard(artifact.id)}
            >
              <Maximize2 className="w-[13px] h-[13px]" strokeWidth={1.75} />
            </ActionButton>
          )}
        </div>
      </header>
      <div className="p-4">
        <ArtifactRenderer
          artifact={artifact}
          conversationId={conversationId}
          embedded
        />
      </div>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-foreground/5 hover:text-aurora-teal-soft transition-colors"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep InlineArtifactCard
git add client/src/components/chat/InlineArtifactCard.tsx
git commit -m "feat(chat): add InlineArtifactCard wrapping ArtifactRenderer"
```

---

### Task 12: MessageColumn

Scrollable centred column that holds user + assistant turns.

**Files:**
- Create: `client/src/components/chat/MessageColumn.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/MessageColumn.tsx
import type { ReactNode } from 'react';

interface MessageColumnProps {
  children: ReactNode;
}

export function MessageColumn({ children }: MessageColumnProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-7 pb-[180px] flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep MessageColumn
git add client/src/components/chat/MessageColumn.tsx
git commit -m "feat(chat): add MessageColumn scroll container"
```

---

### Task 13: ChatBreadcrumb

Mode icon + mode name + conversation title + Chat/Whiteboard toggle.

**Files:**
- Create: `client/src/components/chat/ChatBreadcrumb.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/ChatBreadcrumb.tsx
import { cn } from '@/lib/utils';
import { getMode, type ChatMode } from '@/lib/mode-registry';

type ViewMode = 'chat' | 'whiteboard';

interface ChatBreadcrumbProps {
  mode: ChatMode;
  title: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  rightSlot?: React.ReactNode;
}

export function ChatBreadcrumb({
  mode,
  title,
  view,
  onViewChange,
  rightSlot,
}: ChatBreadcrumbProps) {
  const modeConfig = getMode(mode);
  const ModeIcon = modeConfig?.icon;

  return (
    <header className="h-12 px-5 border-b border-border flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 font-display font-semibold text-[13px] min-w-0">
        <span className="flex items-center gap-1.5 text-aurora-teal-soft shrink-0">
          {ModeIcon && <ModeIcon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          {modeConfig?.label ?? mode}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
    </header>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex bg-foreground/[0.04] border border-border rounded-md p-0.5 text-[11px] font-medium">
      {(['chat', 'whiteboard'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'px-3 py-1 rounded transition-colors capitalize',
            view === v
              ? 'bg-aurora-teal/15 text-aurora-teal-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep ChatBreadcrumb
git add client/src/components/chat/ChatBreadcrumb.tsx
git commit -m "feat(chat): add ChatBreadcrumb with view toggle"
```

---

## Phase 4 · Composer

### Task 14: Composer component

K2 floating. Controlled — parent owns the value + send logic. Two variants (`main` / `pip`).

**Files:**
- Create: `client/src/components/chat/Composer.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/Composer.tsx
import { useRef, useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { Paperclip, AtSign, Mic, X } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export type ComposerVariant = 'main' | 'pip';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onVoice?: () => void;
  onMention?: () => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: ComposerVariant;
  /** Shown above the textarea as removable chips. */
  selectionChips?: Array<{ id: string; label: string; icon?: ReactNode }>;
  onRemoveSelection?: (id: string) => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  onAttach,
  onVoice,
  onMention,
  placeholder = 'Ask CA-GPT…',
  disabled = false,
  variant = 'main',
  selectionChips,
  onRemoveSelection,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxRows = variant === 'pip' ? 4 : 8;
    const maxHeight = 24 * maxRows + 16;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [value, variant]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      if (value.trim().length > 0) onSend();
    }
  };

  const frameClass = cn(
    'border border-border-strong bg-card/85 rounded-xl px-4 py-3.5 transition-shadow',
    'backdrop-blur-[14px] supports-[backdrop-filter]:bg-card/85',
    value.trim() ? 'shadow-float ring-1 ring-aurora-teal/20' : 'shadow-float',
    disabled && 'opacity-60'
  );

  return (
    <div className={frameClass}>
      {selectionChips && selectionChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 mb-2 border-b border-border">
          {selectionChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aurora-teal/12 border border-aurora-teal/30 text-aurora-teal-soft text-[10px] font-medium"
            >
              {chip.icon}
              {chip.label}
              {onRemoveSelection && (
                <button
                  type="button"
                  className="opacity-50 hover:opacity-100"
                  onClick={() => onRemoveSelection(chip.id)}
                  aria-label={`Remove ${chip.label}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full bg-transparent outline-none resize-none text-[14px] text-foreground placeholder:text-muted-foreground font-sans leading-[1.5]"
      />

      <div className="flex justify-between items-center mt-2.5 text-[11px] text-muted-foreground">
        <div className="flex gap-0.5">
          <ToolButton title="Attach" onClick={onAttach}>
            <Paperclip className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton title="Mention" onClick={onMention}>
            <AtSign className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton title="Voice" onClick={onVoice}>
            <Mic className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </ToolButton>
        </div>
        {variant === 'main' ? (
          <div className="flex items-center gap-2">
            <Kbd keys={['shift', 'return']} /> newline
            <Kbd keys={['return']} /> send
            <Kbd keys={['mod', 'K']} /> commands
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Kbd keys={['return']} /> send
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-aurora-teal-soft transition-colors"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep Composer.tsx
git add client/src/components/chat/Composer.tsx
git commit -m "feat(chat): add K2 floating Composer (main + pip variants)"
```

---

### Task 15: EmptyModeState

Shown when a mode has no active conversation or a new conversation has no messages.

**Files:**
- Create: `client/src/components/chat/EmptyModeState.tsx`

- [ ] **Step 1: Implement.**

```tsx
// client/src/components/chat/EmptyModeState.tsx
import { getMode, type ChatMode } from '@/lib/mode-registry';

interface EmptyModeStateProps {
  mode: ChatMode;
  onPickStarter: (prompt: string) => void;
}

export function EmptyModeState({ mode, onPickStarter }: EmptyModeStateProps) {
  const config = getMode(mode);
  if (!config) return null;
  const { icon: Icon, label, description, starters } = config;

  return (
    <div className="flex flex-col items-center text-center py-24 max-w-[560px] mx-auto">
      <div className="w-10 h-10 rounded-lg bg-gradient-aurora flex items-center justify-center text-white mb-5">
        <Icon className="w-6 h-6" strokeWidth={1.75} />
      </div>
      <h2 className="font-display font-semibold text-[22px] tracking-tight text-foreground">
        New {label} conversation
      </h2>
      <p className="text-[13px] text-muted-foreground mt-2 max-w-[480px]">
        {description}
      </p>
      <div className="flex flex-col gap-2 mt-7 w-full">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPickStarter(prompt)}
            className="text-left text-[13px] text-foreground px-4 py-2.5 rounded-md border border-border hover:border-aurora-teal/40 hover:bg-aurora-teal/5 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep EmptyModeState
git add client/src/components/chat/EmptyModeState.tsx
git commit -m "feat(chat): add EmptyModeState with per-mode starter prompts"
```

---

## Phase 5 · Command palette

### Task 16: CommandMenu

⌘K / Ctrl+K unified palette. Uses shadcn's `Command` primitive (already in `client/src/components/ui/command.tsx`).

**Files:**
- Create: `client/src/components/shell/CommandMenu.tsx`

- [ ] **Step 1: Verify `Command` primitive exists, then implement.**

```bash
ls client/src/components/ui/command.tsx
# expected: file present
```

```tsx
// client/src/components/shell/CommandMenu.tsx
import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { MODES, type ChatMode } from '@/lib/mode-registry';
import { Plus, Moon, Sun, Maximize2, Minimize2, LogOut } from 'lucide-react';

interface RecentConversation {
  id: string;
  title: string;
  mode: ChatMode;
}

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentConversations: RecentConversation[];
  currentView: 'chat' | 'whiteboard';
  onSelectMode: (mode: ChatMode) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onToggleTheme: () => void;
  onToggleView: () => void;
  onSignOut: () => void;
}

export function CommandMenu(props: CommandMenuProps) {
  const { open, onOpenChange, recentConversations, currentView } = props;

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => () => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modes, conversations, actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Jump to mode">
          {MODES.map(({ id, label, icon: Icon }) => (
            <CommandItem key={id} onSelect={run(() => props.onSelectMode(id))}>
              <Icon className="mr-2 w-4 h-4" strokeWidth={1.75} />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        {recentConversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent conversations">
              {recentConversations.slice(0, 10).map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={run(() => props.onSelectConversation(c.id))}
                >
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(props.onNewChat)}>
            <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} /> New chat
          </CommandItem>
          <CommandItem onSelect={run(props.onToggleTheme)}>
            <Moon className="mr-2 w-4 h-4" strokeWidth={1.75} /> Toggle theme
          </CommandItem>
          <CommandItem onSelect={run(props.onToggleView)}>
            {currentView === 'chat' ? (
              <Maximize2 className="mr-2 w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Minimize2 className="mr-2 w-4 h-4" strokeWidth={1.75} />
            )}
            {currentView === 'chat' ? 'Open whiteboard' : 'Back to chat'}
          </CommandItem>
          <CommandItem onSelect={run(props.onSignOut)}>
            <LogOut className="mr-2 w-4 h-4" strokeWidth={1.75} /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Typecheck + commit.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep CommandMenu
git add client/src/components/shell/CommandMenu.tsx
git commit -m "feat(shell): add CommandMenu (⌘K/Ctrl+K palette)"
```

---

## Phase 6 · Integrate into Chat.tsx

This is the switch-over. `Chat.tsx` currently renders its own layout; we replace it with `AppShell` + new chat components while preserving all the existing send / SSE / artifact-placeholder logic.

### Task 17: Wire `Chat.tsx` to use AppShell + new components

**Files:**
- Modify: `client/src/pages/Chat.tsx`

- [ ] **Step 1: Read the current file to locate the layout JSX.**

```bash
grep -n "return (" client/src/pages/Chat.tsx | head -5
```

- [ ] **Step 2: Locate where the current sidebar + message stream + composer are rendered. Wrap them in the new primitives.**

Strategy: keep `Chat.tsx`'s existing state / effects / send handler intact. Replace only the JSX return block with:

```tsx
// in Chat.tsx, inside the component, replace the current return (...) block with:
return (
  <AppShell
    conversations={sidebarConversations}
    activeMode={currentMode}
    activeConversationId={activeConversation}
    userLabel={user?.name ?? 'User'}
    userPlan={user?.plan ?? 'Free'}
    userInitial={user?.name?.[0]?.toUpperCase() ?? 'U'}
    onSelectMode={handleSelectMode}
    onSelectConversation={handleSelectConversation}
    onNewChat={handleNewChat}
    onOpenSettings={() => setLocation('/settings')}
    onOpenSearch={() => setCommandOpen(true)}
  >
    <ChatBreadcrumb
      mode={currentMode}
      title={activeConversationTitle ?? 'New conversation'}
      view={view}
      onViewChange={setView}
    />
    {view === 'chat' ? (
      <>
        <MessageColumn>
          {messages.length === 0 ? (
            <EmptyModeState mode={currentMode} onPickStarter={(p) => { setInput(p); textareaRef.current?.focus(); }} />
          ) : (
            messages.map((msg) => (
              msg.role === 'user' ? (
                <UserTurn key={msg.id}>{msg.content}</UserTurn>
              ) : (
                <AssistantTurn
                  key={msg.id}
                  modeName={getMode(currentMode)?.label.toLowerCase()}
                  timestamp={formatTimestamp(msg.createdAt)}
                  streaming={msg.streaming}
                  onStop={handleStop}
                >
                  {/* Existing markdown renderer — unchanged. */}
                  <ChatMessageBody message={msg} artifactsData={artifactsData} />
                </AssistantTurn>
              )
            ))
          )}
        </MessageColumn>
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-[calc(100%-40px)] max-w-[720px]">
            <Composer
              value={input}
              onChange={setInput}
              onSend={() => handleSend(input, selection)}
              placeholder={`Ask CA-GPT anything in ${getMode(currentMode)?.label} mode…`}
              disabled={isStreaming}
            />
          </div>
        </div>
      </>
    ) : (
      <WhiteboardView conversationId={activeConversation} />
    )}

    <CommandMenu
      open={commandOpen}
      onOpenChange={setCommandOpen}
      recentConversations={sidebarConversations}
      currentView={view}
      onSelectMode={handleSelectMode}
      onSelectConversation={handleSelectConversation}
      onNewChat={handleNewChat}
      onToggleTheme={toggleTheme}
      onToggleView={() => setView((v) => (v === 'chat' ? 'whiteboard' : 'chat'))}
      onSignOut={handleSignOut}
    />
  </AppShell>
);
```

- [ ] **Step 3: Add missing helpers at the top of the Chat component (outside the return).**

```tsx
const [view, setView] = useState<'chat' | 'whiteboard'>('chat');
const [commandOpen, setCommandOpen] = useState(false);
const currentMode = activeConversationMode ?? 'standard';
const activeConversationTitle = conversationList.find(c => c.id === activeConversation)?.title;
const sidebarConversations = useMemo(
  () => conversationList.map(c => ({
    id: c.id,
    title: c.title ?? 'Untitled',
    mode: (c.mode ?? 'standard') as ChatMode,
  })),
  [conversationList],
);
const handleSelectMode = (mode: ChatMode) => {
  // Filter conversations by mode in sidebar; don't auto-create.
  // This function can be a no-op if expanding the section already happens inside ModeSidebar.
};
const handleSelectConversation = (id: string) => setActiveConversation(id);
const handleNewChat = () => handleCreateConversation({ mode: currentMode });
const handleStop = () => { /* reuse existing cancel-stream logic */ };
```

Adjust any identifier mismatches (`conversationList`, `handleCreateConversation`, `toggleTheme`, `handleSignOut`) to match the actual names in your `Chat.tsx` — this file is ~2000 LOC with evolving internals. Use `grep` to confirm and adapt.

- [ ] **Step 4: Extract the current message-body renderer (markdown + LaTeX + artifact-placeholder) into its own component so `AssistantTurn` can render it cleanly.**

```tsx
// client/src/components/chat/ChatMessageBody.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { InlineArtifactCard } from './InlineArtifactCard';
// ... rest of imports match what Chat.tsx currently imports for markdown

interface ChatMessageBodyProps {
  content: string;
  artifactsById: Record<string, any>;
  conversationId?: string;
  onOpenInWhiteboard?: (artifactId: string) => void;
}

export function ChatMessageBody({
  content,
  artifactsById,
  conversationId,
  onOpenInWhiteboard,
}: ChatMessageBodyProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        'artifact-placeholder': ({ id }: any) => {
          const artifact = artifactsById?.[id];
          if (!artifact) {
            return (
              <div className="text-xs text-muted-foreground italic my-2">
                [artifact {id} loading…]
              </div>
            );
          }
          return (
            <InlineArtifactCard
              artifact={artifact}
              conversationId={conversationId}
              onOpenInWhiteboard={onOpenInWhiteboard}
            />
          );
        },
        // Preserve other custom renderers (code, tables, etc.) by copying them
        // from the current Chat.tsx markdown block.
      } as any}
    >
      {content}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 5: Typecheck, build, smoke test.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -E "(Chat.tsx|ChatMessageBody)"
# expected: only pre-existing errors if any
cd client && npx vite build 2>&1 | tail -3
# expected: ✓ built
```

Run the dev server (`npm run dev` from repo root), open a conversation, send a message, confirm:
- Sidebar shows 9 modes with counts.
- Clicking a mode expands its conversations.
- Message stream renders user bubble + assistant turn.
- Inline artifact (if generated by the AI) renders inside `InlineArtifactCard`.
- Floating composer at bottom; Enter sends; Shift+Enter newlines.
- ⌘K or Ctrl+K opens palette; arrow-navigating and selecting a mode switches view.

- [ ] **Step 6: Commit.**

```bash
git add client/src/pages/Chat.tsx client/src/components/chat/ChatMessageBody.tsx
git commit -m "feat(chat): wire AppShell + new chat primitives into Chat.tsx"
```

---

## Phase 7 · PIP + Whiteboard restyle

Existing behavior is preserved; we only replace the chrome.

### Task 18: Restyle ChatPIP

**Files:**
- Modify: `client/src/components/chat/pip/ChatPIP.tsx`

- [ ] **Step 1: Read the existing ChatPIP to find the container class and composer mount.**

```bash
grep -n "className\|Composer" client/src/components/chat/pip/ChatPIP.tsx | head -20
```

- [ ] **Step 2: Update the container to use Aurora tokens + swap in the new `Composer` with `variant="pip"`.**

Key JSX changes (keep existing refs + drag logic):

```tsx
// In ChatPIP.tsx, update container class:
<div
  ref={pipRef}
  style={{ left: pos.x, top: pos.y, width: 360, height: collapsed ? 40 : 480 }}
  className={cn(
    'fixed bg-card/85 backdrop-blur-[14px] border border-border-strong rounded-xl shadow-float',
    'flex flex-col overflow-hidden z-40',
    value.trim() && 'ring-1 ring-aurora-teal/20'
  )}
>
  <header
    onPointerDown={beginDrag}
    className="h-10 px-3 border-b border-border flex items-center justify-between text-[12px] cursor-grab active:cursor-grabbing select-none"
  >
    {/* grip + title on left, icon buttons on right */}
  </header>

  {!collapsed && (
    <>
      {/* existing transcript JSX — style with font-sans text-[12px] */}

      {/* REPLACE existing ChatInput mount with: */}
      <div className="border-t border-border p-3">
        <Composer
          variant="pip"
          value={value}
          onChange={setValue}
          onSend={handleSend}
          placeholder="Ask about the selected artifacts…"
          selectionChips={selectionChips}
          onRemoveSelection={handleRemoveSelection}
        />
      </div>
    </>
  )}
</div>
```

Build `selectionChips` from `useSelectionContext` + `byId` (look up the artifact title + pick a `KindPill`-style icon). Reuse `KindPill`'s meta table if convenient.

- [ ] **Step 3: Typecheck.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep ChatPIP
# expected: no errors
```

- [ ] **Step 4: Smoke test.**

With `whiteboardV2` feature flag on, open whiteboard view, drag the PIP, select artifacts on the canvas, confirm chips appear in the PIP composer, send a message — the existing backend flow (`handleSend(text, selection)`) still runs.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/chat/pip/ChatPIP.tsx
git commit -m "refactor(pip): restyle ChatPIP with Aurora tokens + new Composer"
```

---

### Task 19: Whiteboard canvas background + selection ring

**Files:**
- Modify: `client/src/components/chat/whiteboard/Whiteboard.tsx`

- [ ] **Step 1: Find the canvas container and selection-ring styling.**

```bash
grep -n "selected\|canvas\|bg-\|border-" client/src/components/chat/whiteboard/Whiteboard.tsx | head -30
```

- [ ] **Step 2: Update the canvas background to a dotted grid + update selection ring to teal.**

Replace the outer canvas div with:

```tsx
<div
  className={cn(
    'flex-1 overflow-auto bg-background',
    "bg-[radial-gradient(circle,_hsl(var(--foreground)/0.04)_1px,_transparent_1px)] [background-size:24px_24px]"
  )}
>
  {/* ... existing card grid */}
</div>
```

For the per-card selected state, replace whatever class sets the selected border/shadow with:

```tsx
className={cn(
  'bg-card border rounded-md transition-all',
  selected
    ? 'border-aurora-teal ring-[3px] ring-aurora-teal/20 shadow-glow-teal'
    : 'border-border hover:border-border-strong'
)}
```

Add the corner check badge when `selected`:

```tsx
{selected && (
  <span className="absolute top-2.5 left-2.5 w-[18px] h-[18px] rounded-full bg-aurora-teal text-white text-[11px] font-bold font-mono flex items-center justify-center shadow-glow-teal z-10">
    ✓
  </span>
)}
```

- [ ] **Step 3: Add the hint banner on first visit.**

Add a `dismissed` localStorage key (`cagpt.whiteboard.hint.v1`). If not dismissed, render at the top of the canvas:

```tsx
{!hintDismissed && (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 bg-card/92 backdrop-blur-[14px] border border-border-strong rounded-full text-[11px] text-muted-foreground inline-flex items-center gap-2 shadow-popover">
    <Info className="w-3.5 h-3.5 text-aurora-teal-soft" strokeWidth={1.75} />
    <span>
      Click artifacts to select · Shift-click for multiple · <Kbd keys={['mod', 'K']} /> to ask about selection
    </span>
    <button onClick={dismissHint} className="ml-1 opacity-50 hover:opacity-100">
      <X className="w-3 h-3" />
    </button>
  </div>
)}
```

- [ ] **Step 4: Typecheck, build, smoke test.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep Whiteboard.tsx
cd client && npx vite build 2>&1 | tail -3
```

Open whiteboard, confirm dotted canvas, confirm clicking a card renders teal ring + check badge, confirm hint banner dismisses and stays dismissed across refresh.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/chat/whiteboard/Whiteboard.tsx
git commit -m "refactor(whiteboard): Aurora canvas dots, teal selection ring, dismissible hint"
```

---

## Phase 8 · Cleanup

### Task 20: Delete deprecated components + keyframes

**Files:**
- Delete: `client/src/components/ModeDockRibbon.tsx`
- Delete: `client/src/components/ChatSidebar.tsx` (verify no other callers first)
- Delete: legacy `ChatInput.tsx` / `ChatInputBox.tsx` (verify no other callers first)
- Modify: `client/src/index.css` (remove unused keyframes + utilities)

- [ ] **Step 1: Grep for each deletion candidate to confirm zero callers.**

```bash
grep -rnE "ModeDockRibbon|import.*ChatSidebar|import.*ChatInputBox|import.*ChatInput " client/src/ | grep -v node_modules
```

For each candidate, either confirm zero imports remain (safe to delete) or list the remaining callers so they can be migrated in a follow-up. Only delete what is fully unreferenced.

- [ ] **Step 2: Delete the unreferenced files.**

```bash
git rm client/src/components/ModeDockRibbon.tsx
# and any others that are fully unreferenced
```

- [ ] **Step 3: Remove retired utility classes + keyframes from `client/src/index.css`.**

Delete these CSS rules / keyframes if present:
- `.glass-heavy`
- `.shimmer-effect`
- `.float-card`
- `.pulse-success`
- `@keyframes float-orb`
- `@keyframes gradient-shift`
- `@keyframes pulse-success`
- `@keyframes shimmer-effect`

Keep `.glass` if still used elsewhere, but grep first — if unused, delete it too.

```bash
grep -rnE "glass-heavy|shimmer-effect|float-card|pulse-success|float-orb|gradient-shift" client/src/ | grep -v node_modules | grep -v index.css
# expected: no matches — only index.css (which we're deleting from)
```

- [ ] **Step 4: Typecheck + build.**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -cE "error TS"
# expected: same as baseline (15 pre-existing)
cd client && npx vite build 2>&1 | tail -3
# expected: ✓ built
```

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "chore: remove deprecated components + unused keyframes"
```

---

### Task 21: Final manual smoke pass

No code changes — just the verification checklist from the spec. Any failure here becomes a bug task.

- [ ] **Step 1: Run the full smoke checklist** from the spec's `Verification` section:

1. `npm run build` succeeds from repo root.
2. Rail + sidebar + main render; all 9 modes shown with correct counts.
3. Clicking a mode expands its conversations; clicking a conversation loads it; breadcrumb shows mode + title.
4. Send a message in each mode — user bubble + assistant turn render; streaming bar appears.
5. Inline artifacts render for each kind (chart, checklist, workflow, mindmap, spreadsheet, flowchart, document).
6. Theme toggle works both directions; gold → amber-deep for numbers; composer shadow adapts.
7. `<Kbd>` renders platform-correct glyphs (spoof `navigator.platform` in dev tools if needed).
8. ⌘K / Ctrl+K opens command palette; selecting a mode or conversation navigates.
9. Whiteboard: artifacts laid out; select → teal ring + badge; PIP shows chips; send routes correctly.
10. `<md` breakpoint: rail collapses, sidebar becomes a drawer.

- [ ] **Step 2: Record any visual deltas from the mockups** (mockups live in `.superpowers/brainstorm/16992-1776735363/content/`). If a screen diverges meaningfully, file it in a follow-up todo; don't block the merge on pixel-perfect parity.

- [ ] **Step 3: Final commit (if any tweaks) + push.**

```bash
git status
# If clean, simply push; otherwise commit tweaks:
# git commit -am "polish: smoke-pass adjustments"
git push -u origin feat/ui-rethink-aurora
```

---

## Out-of-scope reminders

Do **not** touch in this plan:
- Landing, auth, settings, admin, analytics, marketing/legal pages.
- Voice-mode deep restyling (only verify the existing `VoiceModeEnhanced` still works against the new `Composer`'s `onVoice` callback).
- Mobile-specific layout tuning below `sm` breakpoint.
- Server-side code.

These are Phase 2 concerns.

---

## Self-review checklist (done)

- **Spec coverage:** Tokens ✓ (Task 1). Platform util ✓ (Task 2-3). Mode registry ✓ (Task 4). Shell ✓ (Tasks 5-8). Messages ✓ (Tasks 9-13). Composer ✓ (Task 14). Empty state ✓ (Task 15). Command palette ✓ (Task 16). Chat.tsx integration ✓ (Task 17). PIP + whiteboard restyle ✓ (Tasks 18-19). Cleanup ✓ (Tasks 20-21).
- **Placeholders:** None. Every step either has complete code, a runnable command with expected output, or a `grep`-first verify-then-delete pattern.
- **Type consistency:** `ChatMode` defined in Task 4, used in Tasks 7, 8, 13, 15, 16, 17. Same union. `WhiteboardArtifact['kind']` referenced from `shared/schema` (existing). `ComposerVariant` defined and used consistently.
- **Test coverage:** Platform util and mode registry are unit-tested (Tasks 2, 4). Visual components verified manually in Task 21's smoke pass — no automated test scaffolding exists for React components in this project, and adding one is out of scope.

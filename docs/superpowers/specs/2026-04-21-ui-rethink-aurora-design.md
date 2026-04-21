# UI rethink — Aurora (app shell + chat)

**Date:** 2026-04-21
**Scope:** App shell (icon rail + sidebar + main) and the chat page. Whiteboard gets a theming/styling refresh to match the new tokens but keeps its existing architecture (`ChatPIP`, `useSelectionContext`, `useConversationArtifacts`, feature-flagged `whiteboardV2`).
**Explicitly out of scope:** Landing, auth, settings, admin, analytics, marketing/legal pages, Roundtable standalone, voice-mode deep restyling.

## Context

CA-GPT's current chrome is the residue of several rapid-iteration cycles: gradient-text utilities with hardcoded hex, flat shadows, heavy glassmorphism applied to non-floating surfaces, a collapsible `ModeDockRibbon` that duplicates modes that elsewhere live as separate routes, and typography centred on Exo 2 which reads as pre-2022 startup. The app shell is functional but feels inconsistent. This spec aligns the shell and chat page to a single coherent "D-expressive, executed well" direction — inspired by Raycast/Arc but applied to an accounting professional tool.

The output pane has already been deleted; artifacts render inline in the chat stream (via `<artifact-placeholder>` markdown tags routed to `ArtifactRenderer`) and are aggregated in the whiteboard view (with selection-aware PIP chat). This spec preserves both paths and standardises their visual language.

## Decisions locked during brainstorming

| Axis | Choice |
|---|---|
| Aesthetic | D · Expressive (Raycast/Arc-flavoured), executed with discipline |
| Palette | D3 · Aurora — CA Navy → Cyan → Teal, with gold accents for numeric/financial highlights |
| Typography | Satoshi (display), Inter (body), JetBrains Mono (numbers + code + kbd) |
| Shell | L2 · 52px icon rail + 260–280px mode sidebar + main |
| Mode treatment | M3 · All 9 modes as sidebar folders (uniform; no chat-vs-workspace distinction) |
| Message style | C3 · Asymmetric hybrid (user subtle bubble right, assistant flat with avatar + kicker) |
| Composer | K2 · Minimal floating — backdrop-blur card, keyboard-first, no Send button |
| Depth discipline | A · Earned depth — no default shadows; glass and glow only on floating/active elements |
| Both themes | Light + dark fully supported; tokens handle parity |
| Keyboard hints | Platform-aware — `navigator.platform` detection at boot, `⌘`/`Ctrl`/`⇧`/`Shift` picked accordingly |

## Design tokens

All token changes live in `client/src/index.css` and `client/tailwind.config.ts`.

### Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');

--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-display: 'Satoshi', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

Exo 2 and Georgia are retired. Any component previously styled with `font-display: 'Exo 2'` inherits the new Satoshi stack automatically.

### Aurora palette

```css
/* Aurora accents — identical HSL in light and dark mode;
   usage alpha and text companions differ per theme. */
--aurora-navy: 222 72% 14%;    /* #0a1a3d */
--aurora-cyan: 190 88% 37%;    /* #0891b2 */
--aurora-teal: 172 78% 40%;    /* #14b8a6 */
--aurora-teal-soft: 167 85% 65%; /* #5eead4 */
--aurora-gold: 45 96% 75%;     /* #fde68a (dark-mode number highlight) */
--aurora-gold-deep: 48 96% 53%; /* #facc15 */
--aurora-amber-deep: 25 93% 37%; /* #b45309 (light-mode number highlight) */

--gradient-aurora: linear-gradient(135deg,
  hsl(var(--aurora-navy)) 0%,
  hsl(var(--aurora-cyan)) 55%,
  hsl(var(--aurora-teal)) 100%);
```

`--primary` stays CA Navy in light mode (institutional), switches to `var(--aurora-teal)` in dark mode so focus rings and active states pick up the brand's "AI" note instead of staid blue.

`--chart-1..5` are retuned to the Aurora palette across both themes (cyan, teal, gold, violet, rose — bright enough on dark, deep enough on light).

### Surface stack (unchanged structure, values retuned)

| Token | Dark | Light |
|---|---|---|
| `--background` | `220 14% 7%` · `#05070f` | `220 20% 98%` · `#f7f8fb` |
| `--sidebar-bg` | `220 12% 10%` | `0 0% 100%` |
| `--card` | `220 10% 15%` | `0 0% 100%` |
| `--popover` | `220 9% 18%` | `0 0% 100%` |
| `--border` | `220 10% 20%` | `215 20% 92%` (≈ `rgba(15,23,42,0.08)`) |
| `--border-strong` | `220 10% 28%` | `215 20% 86%` (≈ `rgba(15,23,42,0.14)`) |

Foreground: dark `0 0% 95%` (off-white, not pure), light `222 47% 11%` (slate-900). Muted foreground: dark `220 8% 62%`, light `215 16% 47%`.

`--border-strong` is used for the composer and PIP chat frames — they need slightly more contrast than in-flow cards so the floating element reads as separate from the surface beneath.

### Radii

```css
--radius-sm: 6px;   /* chips, inputs, small buttons */
--radius-md: 10px;  /* cards, artifact cards in stream */
--radius-lg: 14px;  /* message bubbles, inline artifact containers */
--radius-xl: 18px;  /* composer, dialogs, PIP */
--radius-full: 999px;
```

### Shadow + glass — earned depth rules

| Token | Value | Allowed on |
|---|---|---|
| (none / default) | — | Sidebar, header, message turns, inline artifact cards, whiteboard body |
| `--shadow-float` | `0 10px 40px rgba(0,0,0,0.5), 0 0 32px rgba(20,184,166,0.08)` (dark) / `0 8px 32px rgba(15,23,42,0.08)` (light) | Floating composer, PIP chat |
| `--shadow-popover` | `0 4px 16px rgba(0,0,0,0.4)` / `0 4px 16px rgba(15,23,42,0.08)` | Dropdowns, tooltips, command palette |
| `--shadow-dialog` | `0 20px 60px rgba(0,0,0,0.6)` / `0 20px 60px rgba(15,23,42,0.12)` | Modals, fullscreen overlays |
| `--glow-teal` | `0 0 16px rgba(20,184,166,0.35)` (dark) · `0 0 10px rgba(20,184,166,0.18)` (light) | Active mode left-bar indicator, composer edge when armed, selected-artifact ring in whiteboard |

`backdrop-filter: blur(14px)` only on elements that *literally float* over content: composer, PIP chat, popovers, dialogs. `.glass` / `.glass-heavy` utilities applied to sidebar, headers, in-stream cards, and tooltips-inside-cards are removed.

### Motion

Keep `transition: all 0.15s`. Retire `pulse-success`, `shimmer-effect`, `float-orb`, `gradient-shift`, `float-card`. Keep `animate-fade-in` (enter) and `animate-slide-up` (message-arrive). Whiteboard streaming badge uses a single 2px teal bar at the bottom of the streaming paragraph instead of a pulse.

### Platform-aware keyboard shortcuts

Single utility, consumed everywhere a `<Kbd>` is rendered:

```ts
// client/src/lib/platform.ts
export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const MOD = isMac ? '⌘' : 'Ctrl';
export const SHIFT = isMac ? '⇧' : 'Shift';
export const RETURN = isMac ? '↵' : 'Enter';
export const OPTION = isMac ? '⌥' : 'Alt';
```

`client/src/components/ui/Kbd.tsx` renders with those symbols.

## Shell architecture

Three layers left-to-right, rendered by a single new `AppShell` component.

### Icon rail (`IconRail`, 52px)

- Logo plate 32×32, `rounded-lg`, background `var(--gradient-aurora)`, sparkle icon in white.
- Rail buttons 32×32 (hit area) with 16px Lucide stroke icons: **Modes** (grid), **Search** (magnifier), **New chat** (plus).
- `flex-1` spacer.
- Bottom: **Settings** (gear).
- Active: teal-light icon on `rgba(20,184,166,0.12)`; hover: fg on `rgba(255,255,255,0.04)` (dark) / `rgba(15,23,42,0.04)` (light).

### Mode sidebar (`ModeSidebar`, 280px)

- **Header** (`p-4 border-b`): `.display` title "CA-GPT" (Satoshi 700, 15px) + 11px muted subline ("Chartered Accountancy · Research & Practice").
- **Body** (scrollable, `py-2`): single group label "Modes". Nine `<ModeRow>` entries in canonical order (source of truth: `server/services/aiOrchestrator.ts` — the `professionalModes` array and `calculation`):
  1. Standard · `MessageSquare`
  2. Research · `Sparkles`
  3. Checklist · `ListChecks`
  4. Workflow · `Network`
  5. Audit · `ShieldCheck`
  6. Calculation · `Calculator`
  7. Forensics · `ScanSearch`
  8. Deliverables · `FileStack`
  9. Roundtable · `Users`
- `<ModeRow>` layout: 15px icon + label + right-aligned conversation count (JetBrains Mono 10px, muted).
- Active mode: teal-light text, 2px `border-l` with `var(--glow-teal)`, background `linear-gradient(90deg, rgba(20,184,166,0.08), transparent)`. Clicking an active mode collapses it; clicking inactive expands.
- Expanded mode shows nested `<ConvoRow>` list (`pl-9`, 12px font). Current conversation highlighted with `bg-teal/5` and foreground text colour.
- **Footer** (`p-3 border-t`): compact avatar + username + plan + platform-aware `MOD K` hint.

### Main (`flex-1`)

- **Header** (48px, `border-b`): breadcrumb on left (mode icon + mode name in teal-light Satoshi 600, `/` separator, conversation title in foreground) + header actions on right. Header actions:
  - Chat view: `Chat | Whiteboard` segmented toggle, plus overflow menu (`⋯`) for rename / delete / share.
  - Whiteboard view: adds **Fit**, **Clear selection** tool buttons (only visible in whiteboard).
- **Body**: `ChatView` or `WhiteboardView` based on toggle. Toggle state persists per conversation in `conversation.uiState.view`.

### Command palette (`CommandMenu`, ⌘K / Ctrl+K)

shadcn's `Command` primitive. Three result groups:

1. **Jump to mode** (9 entries, icon + label)
2. **Recent conversations** (latest 10)
3. **Actions** — New chat (in current mode), Toggle theme, Toggle whiteboard, Open settings, Sign out

Keyboard-first; arrow-navigate; mod+enter selects. Registered via a single `useCommandMenu()` hook that reads mode/conversation state.

### Data model addendum

```ts
// shared/schema.ts
interface Conversation {
  // ...existing fields
  mode: ChatMode;       // canonical 9-mode union — already tracked server-side
  uiState?: {
    view?: 'chat' | 'whiteboard';
    pip?: { x: number; y: number; collapsed: boolean }; // passthrough for ChatPIP
  };
}

type ChatMode =
  | 'standard' | 'deep-research' | 'checklist'
  | 'workflow' | 'audit-plan' | 'calculation'
  | 'forensic-intelligence' | 'deliverable-composer' | 'roundtable';
```

`mode` is already present in DB / API; this spec just surfaces it to the sidebar UI. `uiState.view` is new and persisted via existing conversation PATCH endpoint (client debounces).

## Chat page

### Layout (`ChatView`)

- Message column: `max-w-[720px] mx-auto px-5`, `flex flex-col gap-5`, `pb-[160px]` to clear floating composer.
- Overflow scrolls inside the column's parent (`flex-1 overflow-y-auto`).

### User turn (`UserTurn`, C3 right bubble)

`self-end max-w-[78%] px-4 py-3 rounded-[14px] bg-teal/[0.08] border border-teal/22 text-foreground text-[14px] leading-[1.5]`. No avatar, no timestamp inline; timestamp surfaces on hover as a small tooltip above the right edge (Satoshi 10px, JetBrains Mono for the time).

### Assistant turn (`AssistantTurn`, C3 flat left)

- Row: `flex gap-3.5`.
- Avatar: 30×30 `rounded-full`, `background: var(--gradient-aurora)`, sparkle Lucide icon 15×15 white.
- Body:
  - Kicker (`.display`, Satoshi 600, 12px): "CA-GPT" + middle-dot + mode name + middle-dot + timestamp (muted JetBrains Mono 10px).
  - Paragraphs: Inter 14px, `line-height: 1.58`, text at 90% foreground. Existing markdown / LaTeX / code highlighting preserved via current renderer.
  - `.num` class: tabular numerics in JetBrains Mono. Dark: `var(--aurora-gold)`. Light: `var(--aurora-amber-deep)`.
  - `.code` class: JetBrains Mono 12px, muted chip with 1px border.
- **Inline artifacts**: `<artifact-placeholder id="..." />` rendered via `ArtifactRenderer` inside an `<InlineArtifactCard>` wrapper (see below). Artifacts can appear mid-prose between paragraphs — the AI can emit multiple.
- **Reasoning block** (if present): inline disclosure below kicker. Collapsed by default: `Reasoning · 847 tokens · ▾` (11px, muted). Expanded: Inter 13px / 1.55, dimmed 80% foreground. No separate card.
- **Streaming state**: 2px teal bar at the bottom of the last paragraph, animated (opacity pulse 1.2s cycle). A 16×16 "stop" icon next to the kicker.

### Inline artifact card (`InlineArtifactCard`)

Wraps `ArtifactRenderer` output with uniform chrome (currently each artifact ships its own header; this unifies them). Layout:

- `my-3 bg-card border border-border rounded-[12px] overflow-hidden`.
- **Head** (`px-3.5 py-2.5 border-b`): kind-pill (`<KindPill>` — uppercase Mono 10px, teal tint) + title (Satoshi 600, 12px) + right-side icon cluster: **Copy**, **Download**, **View in whiteboard**.
- **Body** (`p-4`): renders `ArtifactRenderer` with `embedded={true}` so the artifact's own title chrome is suppressed.
- Kind-pill maps artifact.kind → icon + abbreviation: CHART / CHECKLIST / WORKFLOW / MINDMAP / SHEET / FLOW / NOTE.
- "View in whiteboard" icon calls `setView('whiteboard')` and fires `useSelectionContext.setArtifacts([artifact.id])` so the whiteboard opens with this artifact pre-selected.

### Empty state (`EmptyModeState`)

Shown when a mode is open with no conversation or a new conversation has no messages. Centred column, `py-24`:

- Mode icon at 40×40 on a teal-gradient plate (24px icon inside).
- `.display` heading: `New {ModeName} conversation` (Satoshi 600, 22px).
- 13px muted subline (mode description — lives in `mode-registry.ts`).
- Three suggested-prompt chips (`rounded-[10px] px-3 py-2 border border-border`, teal border on hover). Prompts per mode live in the same registry.
- Suggestions fire `handleSend(prompt, {})` on click.

### Floating composer (`Composer`, K2)

Identical component used by `ChatView` and `ChatPIP` (prop-driven size + placeholder). Variants:

- **Main**: `absolute bottom-6 left-0 right-0`, wrapper `pointer-events-none`, inner `pointer-events-auto max-w-[720px] w-[calc(100%-40px)] mx-auto`.
- **PIP**: natural-flow, 100% width of PIP frame, no absolute positioning.

Styling (shared):

- Border 1px `var(--border-strong)`.
- Background: `rgba(12,15,26,0.85)` (dark) · `rgba(255,255,255,0.92)` (light).
- `backdrop-filter: blur(14px)`; `border-radius: var(--radius-xl)`.
- Shadow: `var(--shadow-float)` always. When textarea has content, add `var(--glow-teal)` — the only glow the composer gets.

Contents:

- Textarea (Inter 14px, auto-grow up to 8 rows in main / 4 rows in PIP, placeholder reflects context: `Ask CA-GPT anything in {ModeName} mode…` or `Ask about the selected artifacts…`).
- **Selection bar** above footer (only when `useSelectionContext.artifactIds.length > 0`): "Ask about:" label + chip per selected artifact (kind icon + short label + `×` to remove). Chips are clickable; clicking one scrolls the whiteboard to that artifact.
- Footer: left = three icon buttons (`Paperclip` attach, `AtSign` mention, `Mic` voice); right = platform-aware kbd hints `SHIFT RETURN newline · RETURN send · MOD K commands`.
- **No Send button.** Enter sends; Shift+Enter newlines. Mic-active: red pulsing dot badge on the mic icon.
- File attachments render as thumbnail chips above the textarea with `×` remove.

## Whiteboard view

### Visual refresh (not a rewrite)

The whiteboard already exists at `client/src/components/chat/whiteboard/Whiteboard.tsx` with full selection + PIP + conversation artifact hook. This spec restyles its surfaces to match Aurora:

- **Canvas background**: `var(--background)` with a 24px-gap radial-dot pattern at 3% opacity (dark) / 5% opacity (light) for subtle grid texture. Replaces current flat background.
- **Artifact cards on canvas** (`ArtifactCard`): same chrome as `InlineArtifactCard` (head with kind-pill + title, body with full artifact). Card is `bg-card border-border rounded-[12px]`. Hover: border → `var(--border-strong)`. Selected: border → `var(--aurora-teal)`, outer ring `0 0 0 3px rgba(20,184,166,0.18)` + `var(--glow-teal)`, plus a 18×18 teal circle with white check at top-left (corner badge).
- **Hint banner** (top of canvas, first visit): `Click artifacts to select · Shift-click for multiple · MOD K to ask about selection` — dismissible pill.

### PIP chat (`ChatPIP`) — styling only

Existing functionality (drag, persist, selection-to-context, same `Composer` with `onSend` callback, 360×480) is preserved. Style updates:

- Glass container: `rgba(10,14,26,0.85)` + `blur(14px)` (dark) / `rgba(255,255,255,0.9)` + `blur(14px)` (light), border `var(--border-strong)`, `var(--radius-xl)`, `var(--shadow-float) + var(--glow-teal)`.
- Head: grip icon (Lucide `GripVertical`) + "Chat" title (Satoshi 600, 12px) + three 24×24 icon buttons (Expand / Collapse / Close). Drag cursor on head, grab-cursor on active drag.
- Transcript: compact (font 12px, gaps 14px). User turn = mini subtle teal bubble right; assistant turn = compact avatar (22px) + kicker + prose.
- Selection bar (existing): restyled to match main composer's selection-bar rules.
- Composer area: the shared `Composer` component with variant `pip`.

### Selection API (unchanged)

- `useSelectionContext.setArtifacts([...ids])` — set selection (click / marquee / Shift-click).
- `useSelectionContext.setHighlight([id], text)` — "Ask about this" from card hover.
- `useSelectionContext.clear()` — header "Clear" button, ESC, or clicking canvas background.

The main-view `Composer` also reads this store, so a selection made while in Whiteboard is visible as chips on the main composer when toggling back to Chat (confirming the cross-view continuity).

## Component inventory

### New components (`client/src/components/shell/`)

| Component | Purpose | ~LOC |
|---|---|---|
| `AppShell.tsx` | Top-level layout (rail + sidebar + main) | 120 |
| `IconRail.tsx` | Fixed 52px column with logo + nav buttons | 80 |
| `ModeSidebar.tsx` | Header + mode list + footer | 180 |
| `ModeRow.tsx` | Single mode entry | 60 |
| `ConvoRow.tsx` | Nested conversation entry | 40 |
| `CommandMenu.tsx` | ⌘K/Ctrl+K palette | 140 |
| `mode-registry.ts` | Canonical mode metadata (id, label, icon, desc, starters) | 90 |

### New components (`client/src/components/chat/`)

| Component | Purpose | ~LOC |
|---|---|---|
| `ChatView.tsx` | Orchestrates header + column + composer | 140 |
| `ChatBreadcrumb.tsx` | Mode-name / title + Chat/Whiteboard toggle | 60 |
| `MessageColumn.tsx` | Scrollable centred column | 80 |
| `UserTurn.tsx` | Right-aligned bubble | 40 |
| `AssistantTurn.tsx` | Avatar + kicker + body, renders inline artifacts | 140 |
| `InlineArtifactCard.tsx` | Uniform chrome around `ArtifactRenderer` | 90 |
| `KindPill.tsx` | Artifact-kind badge (uppercase Mono) | 40 |
| `Composer.tsx` | Floating K2 composer (shared with PIP) | 200 |
| `EmptyModeState.tsx` | Mode landing with suggested prompts | 70 |

### New components (`client/src/components/ui/`)

| Component | Purpose | ~LOC |
|---|---|---|
| `Kbd.tsx` | Platform-aware keyboard hint | 20 |

### Files updated

- `client/src/index.css` — new tokens, font imports, retire `.glass-heavy`, `.shimmer-effect`, `.pulse-success`, `.float-card` + related keyframes.
- `client/tailwind.config.ts` — Aurora colors + display font + new radius scale.
- `client/src/pages/Chat.tsx` — replace current layout JSX with `<AppShell>` wrapping `<ChatView>` / `<WhiteboardView>`. Keep send logic, SSE wiring, artifact placeholder bridge.
- `client/src/lib/platform.ts` — new util.
- `client/src/components/chat/whiteboard/Whiteboard.tsx` — consume new tokens + selection-ring style.
- `client/src/components/chat/pip/ChatPIP.tsx` — restyle only; behavior unchanged.

### Files deleted

- `client/src/components/ModeDockRibbon.tsx` — modes now live in sidebar.
- `client/src/components/ChatSidebar.tsx` (current) — replaced by `ModeSidebar`.
- `client/src/components/OutputPane.tsx` (if still present) — output lives in whiteboard and inline.
- `client/src/components/ChatInput.tsx` / `ChatInputBox.tsx` — superseded by `Composer`. (Confirm no other callers first; grep before delete.)
- Legacy `.glass-heavy` / `shimmer-effect` / `float-orb` keyframes in `index.css`.

### Flagged (out of scope, keep working)

- `VoiceModeEnhanced.tsx` (1014 LOC) — must keep working against the new `Composer`. Risk: tight coupling to current input component. Mitigation in the migration plan.
- `Hero.tsx`, `Features.tsx`, `Integrations.tsx`, `ModelArchitecture.tsx` on Landing — keep current styling until Phase 2.
- `Settings.tsx`, admin layouts — untouched.

## Migration plan (implementation sequence)

1. **Tokens** — add fonts, Aurora variables, radii, shadow rules, retire dead keyframes. Tailwind config extensions. (`index.css`, `tailwind.config.ts`.)
2. **Platform util + Kbd** — `lib/platform.ts` + `ui/Kbd.tsx`.
3. **Shell scaffolding** — `AppShell`, `IconRail`, `ModeSidebar`, `ModeRow`, `ConvoRow` with a hard-coded mode registry. `CommandMenu` stubbed.
4. **Mode registry wiring** — point `ModeSidebar` at the real server conversation list grouped by `mode`. Conversation-count derived from the grouped list.
5. **Chat view shell** — `ChatView`, `ChatBreadcrumb`, `MessageColumn`. Render existing messages with a placeholder `AssistantTurn`/`UserTurn` (wrap current bubbles, don't replace renderer yet).
6. **Message styling** — swap the existing bubble renderer for `AssistantTurn` / `UserTurn`. Preserve markdown / LaTeX / code highlight / `<artifact-placeholder>` bridge.
7. **Inline artifact card** — wrap `ArtifactRenderer` with `InlineArtifactCard` + `KindPill`. Set `embedded={true}`.
8. **Composer K2** — new `Composer`. Swap into main view first; keep PIP on old input temporarily.
9. **Empty state + starter prompts** — `EmptyModeState`.
10. **Command palette** — activate `CommandMenu` with mode/convo/action sources.
11. **PIP + Whiteboard restyle** — swap PIP to shared `Composer`, update canvas backgrounds + selection-ring via tokens. Touch `ChatPIP.tsx` and `Whiteboard.tsx`; do not alter selection-context flows.
12. **Deletions** — remove `ModeDockRibbon`, legacy `ChatSidebar`, legacy input components, dead keyframes.
13. **Typecheck + smoke test** — build, run, walk every mode, confirm artifact rendering inline + on whiteboard, confirm theme toggle in both directions, confirm ⌘K and Ctrl shortcuts on both platforms (spoof `navigator.platform` in dev to test).

## Verification

End-to-end manual pass on `feat/ui-rethink-aurora` branch. Criteria:

1. **Build** — `npm run build` from repo root succeeds; no new typecheck errors in touched files (pre-existing unrelated errors acceptable).
2. **Shell** — rail + sidebar + main render. Modes list shows all 9 with correct icons and counts reflecting real conversations in DB.
3. **Mode interaction** — clicking a mode expands its conversation list; clicking a conversation loads it in chat view; breadcrumb shows correct mode + title.
4. **Messages** — send a message in each mode. User turn renders as right-bubble; assistant turn renders with avatar + kicker + markdown. Streaming shows a 2px teal bar, no flicker.
5. **Inline artifacts** — a message containing `<artifact-placeholder>` for each kind (chart / checklist / workflow / mindmap / spreadsheet / flowchart / document) renders inline inside `InlineArtifactCard`. Copy / Download / View-in-whiteboard buttons all fire.
6. **Theme toggle** — both dark and light render all surfaces correctly. Numbers switch gold↔amber-deep; composer shadow/glass adapts.
7. **Platform kbd** — load app on mac + windows (spoofing `navigator.platform`); `<Kbd>` renders correct glyphs (`⌘`/`⇧`/`↵` vs `Ctrl`/`Shift`/`Enter`).
8. **Command palette** — `MOD K` opens it; searching a mode / conversation navigates correctly.
9. **Whiteboard PIP** — toggle to whiteboard, artifacts laid out in cards, click to select (ring + badge visible), PIP composer shows chips, send creates a new conversation message correctly attributed to the selected artifacts.
10. **Responsive** — below `md` breakpoint, icon rail collapses; sidebar becomes a drawer over main. No overlap, no broken scroll.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `VoiceModeEnhanced` tightly couples to current `ChatInputBox` API | Hold voice-mode refactor as a Phase 1.5 task; initial `Composer` exposes the same `onSend(text, selection, attachments)` + `isStreaming` + `onStop` signature so VoiceMode keeps working. |
| Inline-artifact chrome duplicates the artifact's own headers (some artifacts ship theirs) | All artifact components already accept `embedded={true}` — `InlineArtifactCard` sets it; audit each artifact type to confirm its embedded mode is clean. |
| Whiteboard + PIP selection state leaks across conversation switches | `useSelectionContext` already scoped by conversation — confirm on conversation change that the store resets (add a `useEffect` clear if missing). |
| Font loading FOUC in dark mode (Satoshi is third-party Fontshare) | Set `font-display: swap` and preload the two critical weights (500, 700). |
| Platform detection false positive on iPad-as-desktop (reports `MacIntel`) | Current heuristic is correct for what we need (iPad users will see `⌘` — same as a Mac — which is what their keyboard actually uses). No action required. |
| Mode registry drift (client list vs server `professionalModes`) | Single source of truth: generate client `mode-registry.ts` from `shared/schema.ts` types where possible; test asserts parity. |

## Deferred (Phase 2)

- Landing, auth, pricing, marketing pages — rebrand to Aurora once shell + chat prove out.
- Settings page restyling.
- Admin / SuperAdmin layouts.
- Analytics dashboard.
- Deep voice mode restyling.
- Error / 404 / offline states.
- Mobile-first responsive layout (current spec handles `md+` well; narrow-mobile deserves its own pass).

---

*Design approved verbally during the 2026-04-21 brainstorming session using the visual companion. Mockups persist in `.superpowers/brainstorm/16992-1776735363/content/` for reference; key frames: `aesthetic-direction.html`, `palette.html`, `typography.html`, `shell-layout-v2.html`, `modes-v2.html`, `message-style.html`, `composer-v2.html`, `full-design.html` (dark), `full-design-light.html` (light), `chat-inline-artifacts.html`, `whiteboard-pip.html`.*

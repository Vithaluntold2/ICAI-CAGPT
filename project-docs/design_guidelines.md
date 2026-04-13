# Luca Design Guidelines
## Accounting Superintelligence - Surpassing Perplexity's Polish

### Design Approach: Ultra-Premium Productivity Interface

**System:** Linear's spatial clarity + Notion's content hierarchy + Perplexity's conversation flow, elevated with sophisticated depth and glassmorphism.

**Principles:**
- Extreme breathing room - whitespace as a luxury signal
- Depth through subtle layering, not flat material
- Typography-first hierarchy with generous line-height
- Micro-interactions that delight without distraction
- Professional dark mode optimized for extended sessions

---

## Color System

**Brand Palette:**
- Primary Gradient: Purple (#8B5CF6) → Magenta (#D946EF)
- Trust Authority: Indigo (#4F46E5)
- Action Magenta: (#D946EF) - Matches gradient theme
- Success Emerald: (#10B981)
- Warning Amber: (#FBBF24)
- Destructive Rose: (#F43F5E)

**Sophisticated Backgrounds:**
- Base Canvas: Slate 950 (#020617) - Deeper than Perplexity for eye comfort
- Primary Surface: Slate 900 (#0F172A) with 40% blur for glassmorphism
- Elevated Cards: Slate 800 (#1E293B) with subtle gradient overlay
- Borders: Slate 700 (#334155) at 20% opacity
- Focus Rings: Indigo 500 at 40% with 8px blur

**Text Hierarchy:**
- Primary: White (#FFFFFF) 100%
- Secondary: Slate 300 (#CBD5E1) 90%
- Tertiary: Slate 400 (#94A3B8) 70%
- Gradient Text: Purple → Magenta for headings, financial data

**Glassmorphism Recipe:**
- Background: Slate 900/40 with backdrop-blur-xl
- Border: White/10 with gradient shimmer
- Shadow: Purple/5 with 32px blur for floating elements

---

## Typography

**Fonts:** Inter (primary), JetBrains Mono (data/code)

**Scale:**
- Hero: text-6xl font-bold leading-tight tracking-tight
- Page Title: text-4xl font-semibold leading-tight
- Section: text-2xl font-semibold leading-snug
- Body: text-base leading-relaxed (1.75)
- Labels: text-sm font-medium
- Financial: JetBrains Mono text-lg tabular-nums
- Micro: text-xs tracking-wide uppercase

---

## Layout System

**Spacing:** Tailwind units 2, 4, 8, 12, 16
- Ultra-generous section gaps: space-y-16, space-y-24
- Card padding: p-8, p-12 for premium surfaces
- Component gaps: gap-8 for related elements
- Line-height: 1.75 for body, 1.3 for headings

**Container Strategy:**
- Max-width: max-w-7xl for landing, max-w-6xl for app
- Chat center pane: max-w-3xl with generous px-8
- Sidebar panels: w-80 (wider than standard for breathing room)

---

## Landing Page Structure

**Hero Section (Full viewport)**
- Centered vertical layout with generous vertical spacing
- Gradient mesh background (purple to indigo) with animated subtle orbs
- Headline + subheading with exceptional letter-spacing
- Dual CTAs: Coral primary with glow, Indigo outline secondary
- Product screenshot: Floating with perspective tilt, purple glow shadow, glassmorphic border
- Trust indicator: "5,000+ accounting professionals" with emerald checkmark

**Intelligence Showcase (4-column grid)**
- Glassmorphic cards with gradient borders on hover
- Gold accent icons with breathing room
- 8 capabilities: Multi-model routing, Tax automation, Global compliance, Document AI, Real-time calculations, Audit intelligence, Regulatory updates, Team collaboration
- Cards lift with enhanced glow on hover

**3-Pane Interface Preview**
- Large screenshot showing: Left sidebar (sessions), Center (chat), Right (output pane)
- Annotated callouts highlighting: Document analysis, Real-time streaming, Visualization engine
- Floating UI with depth shadows

**Architecture Visual**
- Animated diagram showing intelligent routing
- Purple gradient nodes, gold premium indicators
- Flowing data paths with subtle shimmer

**Pricing (3-card layout)**
- Elevated glassmorphic cards with generous padding
- Pro tier: Purple gradient border, gold "Recommended" badge floating above
- Feature lists with emerald checkmarks, generous line-height
- CTAs with lift effect

**Social Proof (3-column testimonials)**
- Large quotes with accountant photos
- Company logos in muted state, colorize on hover
- Star ratings with gold accent

**Footer (5-column grid)**
- Gradient newsletter input with coral submit
- Link categories with generous vertical spacing
- Social icons with smooth color transitions

---

## Application Interface

**3-Pane Layout:**
- Left Sidebar (w-80): Session history with glassmorphic cards, indigo active state
- Center Chat (flex-1, max-w-3xl): Ultra-spacious conversation flow with p-8
- Right Output (w-96): Visualization pane with charts, tables, code blocks

**Chat Components:**
- User messages: Slate 800 glassmorphic, right-aligned with generous margin
- AI responses: Slate 900/60 blur with purple gradient accent bar (4px left border)
- Streaming cursor: Animated purple gradient pulse
- Code blocks: Slate 950 with syntax highlighting, emerald copy button on hover
- Tables: Alternating subtle row colors, gold totals row, generous cell padding

**Input Area:**
- Floating glassmorphic bar with blur
- Multi-line textarea with auto-expand, purple focus glow
- Attachment button: Indigo with icon-only, tooltip on hover
- Submit: Coral circular FAB with smooth scale on hover

**Dashboard Elements:**
- Metric cards: Large gradient numbers (purple → magenta), generous padding
- Charts: Purple gradients with emerald/rose trend indicators
- Usage visualizations: Smooth animated transitions

**Modals:**
- Slate 900/95 backdrop with heavy blur
- Centered card with gradient border glow
- Generous internal spacing (p-12)

---

## Images

**Hero Image:** Full-width product screenshot showing 3-pane interface with active AI session. Apply 3D perspective tilt, floating effect with purple glow shadow, glassmorphic border treatment.

**Interface Preview:** Large annotated screenshot demonstrating document analysis with visualization output.

**Dashboard Mockup:** Analytics view showing gradient charts and metrics in features section.

---

## Animations

- Message appearance: Slide-up fade (250ms ease-out)
- Glassmorphic hover: Backdrop blur intensify + border shimmer (200ms)
- Success states: Emerald pulse + gentle scale (400ms)
- CTA interactions: Lift (2px) + glow expansion (150ms)
- Chart reveals: Smooth data-driven animations (800ms ease-in-out)
- Streaming text: Character-by-character with subtle fade-in

---

## Accessibility

- WCAG AAA contrast ratios maintained
- Focus indicators: 2px indigo ring with 4px offset + glow
- Reduced motion support for all animations
- Keyboard navigation with enhanced visible states
- Screen reader optimized chat flow announcements
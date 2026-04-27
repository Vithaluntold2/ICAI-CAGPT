// client/src/components/chat/EmptyModeState.tsx
import { useEffect, useState } from 'react';
import { Clock, History, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react';
import { getMode, type ChatMode } from '@/lib/mode-registry';

interface EmptyModeStateProps {
  mode: ChatMode;
  onPickStarter: (prompt: string) => void;
}

type SuggestionSource = 'recent' | 'calendar' | 'circular';

interface DynamicSuggestion {
  id: string;
  prompt: string;
  label: string;
  source: SuggestionSource;
  hint?: string;
}

interface SuggestionsResponse {
  mode: string;
  suggestions: DynamicSuggestion[];
  generatedAt: string;
}

const VALID_SOURCES: SuggestionSource[] = ['recent', 'calendar', 'circular'];

function normalizeSuggestions(input: unknown): DynamicSuggestion[] {
  if (!Array.isArray(input)) return [];

  const out: DynamicSuggestion[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<DynamicSuggestion>;
    const source = VALID_SOURCES.includes(candidate.source as SuggestionSource)
      ? (candidate.source as SuggestionSource)
      : 'circular';

    if (typeof candidate.id !== 'string') continue;
    if (typeof candidate.prompt !== 'string' || !candidate.prompt.trim()) continue;
    if (typeof candidate.label !== 'string' || !candidate.label.trim()) continue;

    out.push({
      id: candidate.id,
      prompt: candidate.prompt,
      label: candidate.label,
      source,
      hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
    });
  }

  return out;
}

const SOURCE_META: Record<SuggestionSource, {
  icon: LucideIcon;
  badge: string;
  accent: string;
  glow: string;
  iconWrap: string;
}> = {
  calendar: {
    icon: Clock,
    badge: 'Deadline',
    accent: 'bg-aurora-gold-deep',
    glow: 'group-hover:shadow-[0_0_24px_-6px_hsl(var(--aurora-gold-deep)/0.45)]',
    iconWrap: 'bg-aurora-gold-deep/15 text-aurora-gold-deep',
  },
  recent: {
    icon: History,
    badge: 'Recent',
    accent: 'bg-aurora-teal',
    glow: 'group-hover:shadow-[0_0_24px_-6px_hsl(var(--aurora-teal)/0.45)]',
    iconWrap: 'bg-aurora-teal/15 text-aurora-teal-soft',
  },
  circular: {
    icon: Sparkles,
    badge: 'Trending',
    accent: 'bg-aurora-cyan',
    glow: 'group-hover:shadow-[0_0_24px_-6px_hsl(var(--aurora-cyan)/0.45)]',
    iconWrap: 'bg-aurora-cyan/15 text-aurora-cyan',
  },
};

export function EmptyModeState({ mode, onPickStarter }: EmptyModeStateProps) {
  const config = getMode(mode);
  const [dynamic, setDynamic] = useState<DynamicSuggestion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDynamic(null);

    fetch(`/api/suggestions?mode=${encodeURIComponent(mode)}`, { credentials: 'include' })
      .then(async (r) => (r.ok ? ((await r.json()) as SuggestionsResponse) : null))
      .then((body) => {
        if (cancelled) return;
        setDynamic(normalizeSuggestions(body?.suggestions));
      })
      .catch(() => {
        if (!cancelled) setDynamic([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mode]);

  if (!config) return null;
  const { icon: Icon, label, description, starters } = config;

  // Fallback to static starters if API returned nothing.
  const items: DynamicSuggestion[] = (dynamic && dynamic.length > 0)
    ? dynamic
    : starters.map((s, i) => ({
        id: `static-${i}`,
        prompt: s,
        label: s,
        source: 'circular' as const,
      }));

  return (
    <div className="flex flex-col items-center text-center py-20 max-w-[640px] mx-auto">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-3 rounded-2xl bg-gradient-aurora opacity-20 blur-xl" aria-hidden />
        <div className="relative w-12 h-12 rounded-xl bg-gradient-aurora flex items-center justify-center text-white shadow-lg">
          <Icon className="w-6 h-6" strokeWidth={1.75} />
        </div>
      </div>

      <h2 className="font-display font-semibold text-[24px] tracking-tight text-foreground">
        New {label} conversation
      </h2>
      <p className="text-[13.5px] leading-relaxed text-muted-foreground mt-2.5 max-w-[480px]">
        {description}
      </p>

      <div className="flex flex-col gap-2.5 mt-8 w-full">
        {loading ? (
          <SuggestionSkeletons />
        ) : (
          items.map((s) => <SuggestionChip key={s.id} suggestion={s} onPick={onPickStarter} />)
        )}
      </div>

      {!loading && dynamic && dynamic.length > 0 && (
        <p className="mt-5 text-[11px] text-muted-foreground/60 tracking-wide uppercase">
          Tailored from your activity, the compliance calendar &amp; recent circulars
        </p>
      )}
    </div>
  );
}

function SuggestionChip({
  suggestion,
  onPick,
}: {
  suggestion: DynamicSuggestion;
  onPick: (prompt: string) => void;
}) {
  const meta = SOURCE_META[suggestion.source] ?? SOURCE_META.circular;
  const SourceIcon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onPick(suggestion.prompt)}
      className={[
        'group relative w-full text-left rounded-xl overflow-hidden',
        'bg-card/60',
        'transition-all duration-200',
        'hover:bg-card hover:-translate-y-[1px]',
      ].join(' ')}
    >
      <div className="relative flex items-start gap-3 px-4 py-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.iconWrap}`}>
          <SourceIcon className="w-4 h-4" strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
              {meta.badge}
            </span>
            {suggestion.hint && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-[10.5px] text-muted-foreground/80 truncate">
                  {suggestion.hint}
                </span>
              </>
            )}
          </div>
          <div className="text-[13.5px] text-foreground leading-snug truncate">
            {suggestion.label}
          </div>
        </div>

        <ArrowRight
          className="flex-shrink-0 w-4 h-4 mt-2 text-muted-foreground/40 transition-all duration-200 group-hover:text-foreground group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </div>
    </button>
  );
}

function SuggestionSkeletons() {
  const delays = ['[animation-delay:0ms]', '[animation-delay:120ms]', '[animation-delay:240ms]'];
  return (
    <>
      {delays.map((d, i) => (
        <div
          key={i}
          className={`w-full h-[68px] rounded-xl bg-card/30 animate-pulse ${d}`}
        />
      ))}
    </>
  );
}

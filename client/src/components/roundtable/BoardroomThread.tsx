/**
 * BoardroomThread — live multi-agent boardroom UI.
 *
 * UX rewrite:
 *  - Session header with live timer + transcript volume + Pause/Stop.
 *  - Phase as a clickable horizontal stepper (was a Select).
 *  - Three-column layout: panel rail · thread · open-questions rail.
 *  - Smart composer: first Send auto-creates the thread (no separate
 *    "Start session" button), tag stays as a pill chip inside the composer.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  StopCircle,
  PauseCircle,
  Send,
  AtSign,
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  Receipt,
  ClipboardCheck,
  BookOpen,
  ScanSearch,
  Scale,
  Mic2,
  User,
  Settings2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRoundtablePanel } from '@/hooks/useRoundtablePanel';
import {
  useBoardroomThread,
  type BoardroomTurnDTO,
  type BoardroomQuestionCardDTO,
  type ParticipantState,
} from '@/hooks/useBoardroomThread';

const PHASES = [
  { id: 'opening', label: 'Opening' },
  { id: 'independent-views', label: 'Independent Views' },
  { id: 'cross-examination', label: 'Cross-Examination' },
  { id: 'user-qa', label: 'User Q&A' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'resolution', label: 'Resolution' },
];

// Map agent template id (or name keyword) to a minimalistic Lucide icon.
const AGENT_ICONS: Record<string, LucideIcon> = {
  'tax-bot': Receipt,
  'audit-bot': ClipboardCheck,
  'ifrs-bot': BookOpen,
  'forensic-bot': ScanSearch,
  'compliance-bot': Scale,
  'moderator-bot': Mic2,
};

function resolveAgentIcon(opts: { templateId?: string | null; name?: string | null }): LucideIcon {
  const { templateId, name } = opts;
  if (templateId && AGENT_ICONS[templateId]) return AGENT_ICONS[templateId];
  const n = (name ?? '').toLowerCase();
  if (n.includes('tax')) return Receipt;
  if (n.includes('audit')) return ClipboardCheck;
  if (n.includes('ifrs') || n.includes('ind as') || n.includes('gaap')) return BookOpen;
  if (n.includes('forensic') || n.includes('fraud')) return ScanSearch;
  if (n.includes('compliance') || n.includes('regulator')) return Scale;
  if (n.includes('moderator') || n.includes('chair')) return Mic2;
  return User;
}

interface Props {
  conversationId: string | null;
  onConfigurePanel: () => void;
}

export function BoardroomThread({ conversationId, onConfigurePanel }: Props) {
  const panel = useRoundtablePanel(conversationId);
  const board = useBoardroomThread(panel.panelId);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [chairText, setChairText] = useState('');
  const [taggedAgent, setTaggedAgent] = useState<string>('all');
  const [sendError, setSendError] = useState<string | null>(null);

  // Auto-scroll on new turns / tokens.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [board.turns, board.questionCards]);

  const agents = panel.hydrated?.agents ?? [];
  const agentById = useMemo(() => {
    const m = new Map<string, (typeof agents)[number]>();
    agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [agents]);

  // Phase 3: group child turns under their parent for nested side-thread render.
  const turnGroups = useMemo(() => {
    const childMap = new Map<string, BoardroomTurnDTO[]>();
    for (const t of board.turns) {
      if (t.parentTurnId) {
        const list = childMap.get(t.parentTurnId) ?? [];
        list.push(t);
        childMap.set(t.parentTurnId, list);
      }
    }
    return board.turns
      .filter((t) => !t.parentTurnId)
      .map((parent) => ({
        parent,
        children: (childMap.get(parent.id) ?? []).slice().sort((a, b) => a.position - b.position),
      }));
  }, [board.turns]);

  // -- Empty states ---------------------------------------------------

  if (!conversationId) {
    return (
      <EmptyShell
        title="Start a conversation to launch a boardroom."
        description="Open panel builder to create a roundtable conversation and attach agents."
        action={
          <Button onClick={onConfigurePanel} data-testid="boardroom-empty-open-builder">
            Configure panel
          </Button>
        }
      />
    );
  }
  if (panel.loading && !panel.hydrated) {
    return <EmptyShell title="Loading panel…" spinner />;
  }
  if (!panel.panelId) {
    return (
      <EmptyShell
        title="No panel for this conversation yet"
        description="Build a panel of expert agents and a session knowledge base, then start the boardroom."
        action={
          <Button onClick={onConfigurePanel} data-testid="boardroom-empty-configure">
            Configure panel
          </Button>
        }
      />
    );
  }
  if (agents.length === 0) {
    return (
      <EmptyShell
        title="Panel has no agents yet"
        description="Add at least one expert agent (custom or from a starter template) before starting a session."
        action={<Button onClick={onConfigurePanel}>Open panel builder</Button>}
      />
    );
  }

  // -- Active boardroom UI -------------------------------------------

  const sendChair = async () => {
    const text = chairText.trim();
    if (!text) return;
    setSendError(null);
    setChairText('');
    try {
      let threadId = board.activeThreadId;
      if (!threadId) {
        const t = await board.createThread({ title: text.slice(0, 80), conversationId });
        threadId = t.id;
      }
      if (taggedAgent && taggedAgent !== 'all') {
        await board.tagAgentInThread(threadId, taggedAgent, text);
      } else {
        await board.interjectInThread(threadId, text);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setChairText(text);
    }
  };

  const stopSpeaker = async () => {
    const speaking = board.turns.find((t) => t.status === 'streaming');
    if (speaking) await board.cancelTurn(speaking.id);
  };

  const openCards = board.questionCards.filter((c) => c.status === 'open');
  const isStreaming = board.turns.some((t) => t.status === 'streaming');
  const sessionStartedAt = board.thread?.createdAt ?? null;

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Top session bar */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border/70 bg-gradient-to-r from-aurora-teal/5 to-transparent">
        <Badge
          variant="outline"
          className="gap-1.5 text-[10px] px-2 py-0.5 border-aurora-teal/40 text-aurora-teal bg-aurora-teal/10"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-aurora-teal" />
          Boardroom
        </Badge>
        <div className="font-exo text-sm font-semibold tracking-tight truncate" title={panel.hydrated?.panel?.name ?? ''}>
          {panel.hydrated?.panel?.name ?? 'Panel'}
        </div>
        <SessionTimer startedAt={sessionStartedAt} active={isStreaming} />
        <div className="ml-auto flex items-center gap-1.5">
          <TranscriptVolumeChip turns={board.turns} />
          {isStreaming && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={stopSpeaker}
              data-testid="boardroom-stop"
            >
              <PauseCircle className="w-3.5 h-3.5 mr-1" /> Stop speaker
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onConfigurePanel}
            data-testid="boardroom-configure-panel"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" /> Configure panel
          </Button>
        </div>
      </header>

      {/* Phase stepper */}
      <PhaseStepper
        currentPhase={board.thread?.phase ?? 'opening'}
        disabled={!board.activeThreadId}
        onSetPhase={(p) => board.setPhase(p).catch(() => {})}
      />

      {/* Three-column body */}
      <div className="flex-1 min-h-0 grid grid-cols-[232px_1fr_312px]">
        {/* Left: panel rail */}
        <aside className="border-r border-border/70 bg-muted/15 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-border/70 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Panel
            </span>
            <span className="font-mono text-[11px] text-foreground/80">
              {agents.length.toString().padStart(2, '0')}
            </span>
          </div>
          <ScrollArea className="flex-1">
            <ul className="px-2 py-2 space-y-0.5">
              {agents.map((a) => {
                const state: ParticipantState = board.participantStates[a.id] ?? 'listening';
                const Icon = resolveAgentIcon({ templateId: a.createdFromTemplate, name: a.name });
                const isSpeaking = state === 'speaking';
                return (
                  <li
                    key={a.id}
                    className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      isSpeaking ? 'bg-aurora-teal/10' : 'hover:bg-accent/40'
                    }`}
                    data-testid={`boardroom-participant-${a.id}`}
                  >
                    {isSpeaking && (
                      <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-aurora-teal shadow-glow-teal" />
                    )}
                    <span className="w-7 h-7 rounded-md flex items-center justify-center bg-aurora-teal/10 text-aurora-teal-soft shrink-0">
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-[12.5px]">{a.name}</div>
                      <ParticipantBadge state={state} useBaseKnowledge={a.useBaseKnowledge} />
                    </div>
                    {isSpeaking ? (
                      <SpeakingWave />
                    ) : state === 'thinking' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </aside>

        {/* Center: thread */}
        <section className="flex flex-col min-h-0 min-w-0">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {board.turns.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center max-w-md mx-auto">
                {board.activeThreadId
                  ? 'Boardroom is open. Post your opening prompt below to kick off.'
                  : 'No session yet. Type your opening question below — sending will start the boardroom.'}
              </div>
            )}
            {turnGroups.map(({ parent, children }) => (
              <TurnGroup key={parent.id} parent={parent} children={children} agentById={agentById} />
            ))}
          </div>

          {/* Composer */}
          <footer className="flex-shrink-0 border-t border-border/70 bg-background px-4 py-3">
            <div className="rounded-lg border border-input bg-background p-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15 transition-shadow">
              <Textarea
                value={chairText}
                onChange={(e) => setChairText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendChair().catch(() => {});
                  }
                }}
                placeholder={
                  board.activeThreadId
                    ? taggedAgent === 'all'
                      ? 'Pose a question to the panel… (⌘+Enter to send)'
                      : `Address ${agentById.get(taggedAgent)?.name ?? 'agent'} directly… (⌘+Enter to send)`
                    : 'Type your opening question — sending will start the boardroom.'
                }
                className="min-h-[44px] resize-none border-0 focus-visible:ring-0 px-1 text-sm"
                data-testid="boardroom-compose"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium transition-colors ${
                        taggedAgent === 'all'
                          ? 'bg-muted text-muted-foreground hover:bg-muted/70'
                          : 'bg-aurora-teal/15 text-aurora-teal border border-aurora-teal/30'
                      }`}
                      data-testid="boardroom-tag-trigger"
                    >
                      <AtSign className="w-3 h-3" />
                      {taggedAgent === 'all'
                        ? 'Open floor'
                        : agentById.get(taggedAgent)?.name ?? 'Agent'}
                      {taggedAgent !== 'all' && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTaggedAgent('all');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setTaggedAgent('all');
                            }
                          }}
                          className="ml-0.5 hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setTaggedAgent('all')}>
                      Open floor (relevance loop)
                    </DropdownMenuItem>
                    {agents.map((a) => (
                      <DropdownMenuItem key={a.id} onSelect={() => setTaggedAgent(a.id)}>
                        {a.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">⌘ ↵</span>
                <Button
                  size="sm"
                  className={`h-7 px-3 ml-1 ${
                    !board.activeThreadId
                      ? 'bg-gradient-aurora text-white border-transparent shadow-glow-teal hover:opacity-95'
                      : ''
                  }`}
                  onClick={() => sendChair().catch(() => {})}
                  disabled={!chairText.trim()}
                  data-testid="boardroom-send"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {board.activeThreadId ? 'Send' : 'Open boardroom'}
                </Button>
              </div>
            </div>
            {(sendError || board.error) && (
              <div className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {sendError ?? board.error}
              </div>
            )}
          </footer>
        </section>

        {/* Right: open question rail + participation summary */}
        <aside className="border-l border-border/70 bg-muted/15 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-border/70 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Open questions
            </span>
            {openCards.length > 0 ? (
              <Badge
                variant="outline"
                className="text-[9.5px] px-1.5 py-0 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                {openCards.length}
              </Badge>
            ) : (
              <span className="font-mono text-[11px] text-foreground/60">00</span>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {openCards.length === 0 ? (
                <div className="text-xs text-muted-foreground/80 py-6 px-2 text-center">
                  No open questions yet. Agent-to-agent questions will appear here.
                </div>
              ) : (
                openCards.map((card) => (
                  <QuestionCard
                    key={card.id}
                    card={card}
                    agents={agents}
                    agentById={agentById}
                    onAnswer={(answer) => board.answerQuestion(card.id, answer)}
                    onRedirect={(toAgentId) => board.redirectQuestion(card.id, toAgentId)}
                    onSkip={() => board.skipQuestion(card.id)}
                  />
                ))
              )}

              <ParticipationSummary turns={board.turns} agents={agents} />
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

function EmptyShell({
  title,
  description,
  action,
  spinner,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  spinner?: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="text-center max-w-md space-y-3">
        {spinner ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /> : null}
        <div className="text-base font-medium">{title}</div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

function SessionTimer({ startedAt, active }: { startedAt: string | null; active: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-mono text-[10.5px] px-2 py-0.5 ${
        active ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'
        }`}
      />
      {formatted}
    </Badge>
  );
}

function TranscriptVolumeChip({ turns }: { turns: BoardroomTurnDTO[] }) {
  const chars = turns.reduce((acc, t) => acc + t.content.length, 0);
  if (chars === 0) return null;
  const display = chars >= 1000 ? `${(chars / 1000).toFixed(1)}K chars` : `${chars} chars`;
  return (
    <Badge variant="outline" className="gap-1.5 font-mono text-[10.5px] px-2 py-0.5">
      {turns.length} turn{turns.length === 1 ? '' : 's'} · {display}
    </Badge>
  );
}

function PhaseStepper({
  currentPhase,
  disabled,
  onSetPhase,
}: {
  currentPhase: string;
  disabled: boolean;
  onSetPhase: (phase: string) => void;
}) {
  const currentIdx = Math.max(0, PHASES.findIndex((p) => p.id === currentPhase));
  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border/70 bg-card/40 overflow-x-auto">
      {PHASES.map((p, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={p.id} className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetPhase(p.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] transition-colors ${
                active
                  ? 'bg-aurora-teal/15 text-foreground font-medium border border-aurora-teal/40 shadow-glow-teal'
                  : done
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-muted/70'
                  : 'text-muted-foreground hover:bg-muted/70'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              data-testid={`boardroom-phase-${p.id}`}
            >
              <span
                className={`font-mono text-[10px] font-semibold ${
                  active ? 'text-aurora-teal' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}
              >
                {done ? '✓' : (i + 1).toString().padStart(2, '0')}
              </span>
              {p.label}
            </button>
            {i < PHASES.length - 1 && (
              <span className="text-muted-foreground/40 text-xs">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SpeakingWave() {
  return (
    <div className="flex items-end gap-[1.5px] h-3" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-aurora-teal animate-pulse"
          style={{
            height: `${[3, 8, 11, 6, 9][i]}px`,
            animationDelay: `${i * 120}ms`,
            animationDuration: '900ms',
          }}
        />
      ))}
    </div>
  );
}

function ParticipationSummary({
  turns,
  agents,
}: {
  turns: BoardroomTurnDTO[];
  agents: Array<{ id: string; name: string; createdFromTemplate?: string | null }>;
}) {
  const agentTurns = turns.filter((t) => t.speakerKind === 'agent' && t.agentId);
  if (agentTurns.length < 2) return null;
  const counts = new Map<string, number>();
  for (const t of agentTurns) {
    if (!t.agentId) continue;
    counts.set(t.agentId, (counts.get(t.agentId) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  const rows = agents
    .map((a) => ({ a, n: counts.get(a.id) ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-3 mt-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
        Participation
      </div>
      <div className="space-y-1.5">
        {rows.map(({ a, n }) => (
          <div key={a.id} className="flex items-center gap-2">
            <span className="text-[11.5px] truncate flex-1 min-w-0">{a.name}</span>
            <div className="flex-1 max-w-[80px] h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-aurora"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums w-5 text-right">
              {n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type AgentLite = {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string | null;
  useBaseKnowledge?: boolean;
  createdFromTemplate?: string | null;
};

function TurnGroup({
  parent,
  children,
  agentById,
}: {
  parent: BoardroomTurnDTO;
  children: BoardroomTurnDTO[];
  agentById: Map<string, AgentLite>;
}) {
  const [open, setOpen] = useState(true);
  const renderBubble = (t: BoardroomTurnDTO) => {
    const a = t.agentId ? agentById.get(t.agentId) : null;
    return (
      <TurnBubble
        key={t.id}
        turn={t}
        agentName={a?.name ?? null}
        agentTemplateId={a?.createdFromTemplate ?? null}
      />
    );
  };
  return (
    <div className="space-y-3" data-testid={`boardroom-turn-group-${parent.id}`}>
      {renderBubble(parent)}
      {children.length > 0 && (
        <div className="ml-10 border-l-2 border-amber-300/60 dark:border-amber-700/60 pl-3 space-y-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
            data-testid={`boardroom-side-thread-toggle-${parent.id}`}
          >
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <CornerDownRight className="w-3 h-3" />
            Side-thread · {children.length} {children.length === 1 ? 'reply' : 'replies'}
          </button>
          {open && <div className="space-y-3 pt-1">{children.map(renderBubble)}</div>}
        </div>
      )}
    </div>
  );
}

function ParticipantBadge({
  state,
  useBaseKnowledge,
}: {
  state: ParticipantState;
  useBaseKnowledge: boolean;
}) {
  const colorMap: Record<ParticipantState, string> = {
    speaking: 'text-aurora-teal',
    thinking: 'text-amber-600 dark:text-amber-400',
    listening: 'text-muted-foreground',
  };
  return (
    <div className={`text-[10px] flex items-center gap-1 ${colorMap[state]}`}>
      <span className="capitalize">{state}</span>
      {!useBaseKnowledge && <span className="ml-1 px-1 rounded bg-muted text-[9px]">KB-only</span>}
    </div>
  );
}

function TurnBubble({
  turn,
  agentName,
  agentTemplateId,
}: {
  turn: BoardroomTurnDTO;
  agentName: string | null | undefined;
  agentTemplateId: string | null | undefined;
}) {
  const isUser = turn.speakerKind === 'user';
  const isStreaming = turn.status === 'streaming';
  const isCancelled = turn.status === 'cancelled';
  const isFailed = turn.status === 'failed';
  const Icon = isUser ? User : resolveAgentIcon({ templateId: agentTemplateId, name: agentName });
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`} data-testid={`boardroom-turn-${turn.id}`}>
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
          isUser ? 'bg-aurora-cyan/15 text-aurora-cyan' : 'bg-aurora-teal/10 text-aurora-teal-soft'
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className={`max-w-[78%] ${isUser ? 'text-right' : ''}`}>
        <div className="text-xs text-muted-foreground mb-0.5">
          {isUser ? 'You (chair)' : agentName ?? 'Agent'}
          {isStreaming && (
            <span className="ml-2 inline-flex items-center gap-1 text-aurora-teal">
              <Loader2 className="w-3 h-3 animate-spin" /> streaming
            </span>
          )}
          {isCancelled && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
              <XCircle className="w-3 h-3" /> cancelled
            </span>
          )}
          {isFailed && (
            <span className="ml-2 inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" /> failed
            </span>
          )}
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser ? 'bg-aurora-cyan/10 text-foreground' : 'bg-muted'
          }`}
        >
          {turn.content || (isStreaming ? <span className="opacity-60">…</span> : '(no content)')}
        </div>
        {turn.citations && turn.citations.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {turn.citations.map((c, i) => (
              <Badge key={`${c.docId}-${c.chunkIndex}`} variant="outline" className="text-[10px]">
                KB#{i + 1}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  card,
  agents,
  agentById,
  onAnswer,
  onRedirect,
  onSkip,
}: {
  card: BoardroomQuestionCardDTO;
  agents: Array<{ id: string; name: string }>;
  agentById: Map<string, { id: string; name: string }>;
  onAnswer: (answer: string) => Promise<void> | void;
  onRedirect: (toAgentId: string) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
}) {
  const [answer, setAnswer] = useState('');
  const [redirectTo, setRedirectTo] = useState<string>('');
  const fromName = card.fromAgentId ? agentById.get(card.fromAgentId)?.name ?? 'Agent' : 'Agent';
  const toName = card.toUser
    ? 'You (chair)'
    : card.toAgentId
    ? agentById.get(card.toAgentId)?.name ?? 'Someone'
    : 'Open';
  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-3"
      data-testid={`boardroom-qcard-${card.id}`}
    >
      <div className="text-xs flex items-center gap-2 mb-2">
        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">{fromName}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{toName}</span>
      </div>
      <div className="text-sm mb-2 leading-snug">{card.text}</div>
      {card.toUser ? (
        <div className="flex gap-2 mb-2">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => answer.trim() && onAnswer(answer.trim())}
            disabled={!answer.trim()}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Answer
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-[11px] px-2">
              {redirectTo ? `→ ${agentById.get(redirectTo)?.name ?? 'Agent'}` : 'Redirect to…'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {agents
              .filter((a) => a.id !== card.toAgentId)
              .map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onSelect={() => {
                    setRedirectTo(a.id);
                    onRedirect(a.id);
                  }}
                >
                  {a.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => onSkip()}>
          Skip
        </Button>
      </div>
    </div>
  );
}

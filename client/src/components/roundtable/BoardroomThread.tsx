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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
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
  PauseCircle,
  PlayCircle,
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
  Copy,
  Download,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useRoundtablePanel } from '@/hooks/useRoundtablePanel';
import { useToast } from '@/hooks/use-toast';
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
        <SessionTimer startedAt={sessionStartedAt} active={isStreaming && !board.paused} />
        <div className="ml-auto flex items-center gap-1.5">
          <TranscriptVolumeChip turns={board.turns} />
          {board.activeThreadId && (
            board.paused ? (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs bg-aurora-teal hover:bg-aurora-teal/90 text-white border-transparent"
                onClick={() => board.resume().catch(() => {})}
                data-testid="boardroom-resume"
              >
                <PlayCircle className="w-3.5 h-3.5 mr-1" /> Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => board.pause().catch(() => {})}
                data-testid="boardroom-pause"
              >
                <PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause
              </Button>
            )
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

      {/* Pause / chair-waiting / degraded-providers banner — visible signal
       *  when the loop has stopped so the user knows what's happening and
       *  what (if anything) they need to do. */}
      {(board.paused || board.awaitingChairCardId) && (
        <div
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/70 text-xs ${
            board.pauseReason === 'providers-degraded'
              ? 'bg-destructive/10'
              : 'bg-amber-500/10'
          }`}
        >
          {board.paused && board.pauseReason === 'providers-degraded' ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="font-medium text-destructive">
                AI providers degraded.
              </span>
              <span className="text-destructive/80">
                Three turns failed in a row (likely rate-limit or quota). Wait a minute, then click Resume to retry — or check provider keys / fallback configuration.
              </span>
            </>
          ) : board.paused ? (
            <>
              <PauseCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-900 dark:text-amber-200">
                Boardroom paused.
              </span>
              <span className="text-amber-800/80 dark:text-amber-300/80">
                No agents will speak until you click Resume.
              </span>
            </>
          ) : (
            <>
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-900 dark:text-amber-200">
                Waiting on you.
              </span>
              <span className="text-amber-800/80 dark:text-amber-300/80">
                A panelist asked you a question — answer it in the right rail to let the discussion continue.
              </span>
            </>
          )}
        </div>
      )}

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
            {/* Final memo: rendered when the Moderator has produced a
             *  completed turn while the thread is in resolution phase.
             *  The memo IS the deliverable — surfaced as a downloadable
             *  card so the chair doesn't have to copy/paste from chat. */}
            <FinalMemoCard
              turns={board.turns}
              phase={board.thread?.phase ?? 'opening'}
              agents={agents}
              threadTitle={panel.hydrated?.panel?.name ?? 'Boardroom'}
            />
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
                    onAcceptPhase={async (toPhase) => {
                      // Order matters: advance the phase first so the
                      // post-card-answer relevance loop runs in the new phase.
                      await board.setPhase(toPhase);
                      await board.answerQuestion(card.id, `accepted: advanced to ${toPhase}`);
                    }}
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
  // Distinguish a polite cede ("ceded: <reason>") from an aborted/stopped
  // turn. A cede is the agent intentionally yielding the floor (e.g. in
  // synthesis phase a specialist defers to the Moderator) — render it as
  // a faded inline note instead of an empty "(no content)" bubble that
  // looks like a bug.
  const cancelReason = turn.cancelReason ?? '';
  const isCeded = isCancelled && cancelReason.startsWith('ceded:');
  const Icon = isUser ? User : resolveAgentIcon({ templateId: agentTemplateId, name: agentName });

  if (isCeded) {
    const reasonText = cancelReason.slice('ceded:'.length).trim();
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground/80 italic"
        data-testid={`boardroom-turn-${turn.id}`}
      >
        <Icon className="w-3 h-3 shrink-0 opacity-60" strokeWidth={1.75} />
        <span>
          <span className="font-medium not-italic">{agentName ?? 'Agent'}</span> yielded the floor
          {reasonText ? <span> — {reasonText}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`} data-testid={`boardroom-turn-${turn.id}`}>
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
          isUser ? 'bg-aurora-cyan/15 text-aurora-cyan' : 'bg-aurora-teal/10 text-aurora-teal-soft'
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      {/* The bubble wrapper sits on the right for user turns via the
       *  parent's flex-row-reverse — we DO NOT also right-align the text
       *  inside, because multi-line right-aligned prose has a ragged
       *  left edge that looks broken. Text reads left-to-right. The
       *  agent label / timestamp row gets text-right so it lines up
       *  with the bubble's right edge instead of starting under the
       *  avatar. */}
      <div className="max-w-[78%]">
        <div className={`text-xs text-muted-foreground mb-0.5 ${isUser ? 'text-right' : ''}`}>
          {isUser ? 'You (chair)' : agentName ?? 'Agent'}
          {isStreaming && (
            <span className="ml-2 inline-flex items-center gap-1 text-aurora-teal">
              <Loader2 className="w-3 h-3 animate-spin" /> streaming
            </span>
          )}
          {isCancelled && !isCeded && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
              <XCircle className="w-3 h-3" /> stopped
            </span>
          )}
          {isFailed && (
            <span className="ml-2 inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" /> failed
            </span>
          )}
        </div>
        <div
          className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser ? 'bg-aurora-cyan/10 text-foreground' : 'bg-muted'
          }`}
        >
          {turn.content ? (
            <TurnMarkdown content={turn.content} />
          ) : isStreaming ? (
            <span className="opacity-60">…</span>
          ) : (
            <span className="opacity-60 italic">(no response generated)</span>
          )}
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

// Sentinel from server's roundtableRuntime.ts. When a question card's text
// starts with this prefix, it represents a propose_phase_transition tool
// call rather than a freeform question — and gets a different UI affordance.
const PHASE_PROPOSAL_PREFIX = '[PROPOSAL:phase=';
const PHASE_LABELS: Record<string, string> = {
  opening: 'Opening',
  'independent-views': 'Independent Views',
  'cross-examination': 'Cross-Examination',
  'user-qa': 'User Q&A',
  synthesis: 'Synthesis',
  resolution: 'Resolution',
};

function parsePhaseProposal(text: string): { toPhase: string; rationale: string } | null {
  if (!text.startsWith(PHASE_PROPOSAL_PREFIX)) return null;
  const closeIdx = text.indexOf(']', PHASE_PROPOSAL_PREFIX.length);
  if (closeIdx < 0) return null;
  const toPhase = text.slice(PHASE_PROPOSAL_PREFIX.length, closeIdx).trim();
  const rationale = text.slice(closeIdx + 1).trim();
  if (!PHASE_LABELS[toPhase]) return null;
  return { toPhase, rationale };
}


function QuestionCard({
  card,
  agents,
  agentById,
  onAnswer,
  onRedirect,
  onSkip,
  onAcceptPhase,
}: {
  card: BoardroomQuestionCardDTO;
  agents: Array<{ id: string; name: string }>;
  agentById: Map<string, { id: string; name: string }>;
  onAnswer: (answer: string) => Promise<void> | void;
  onRedirect: (toAgentId: string) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onAcceptPhase?: (toPhase: string) => Promise<void> | void;
}) {
  const [answer, setAnswer] = useState('');
  const [redirectTo, setRedirectTo] = useState<string>('');
  const fromName = card.fromAgentId ? agentById.get(card.fromAgentId)?.name ?? 'Agent' : 'Agent';
  const toName = card.toUser
    ? 'You (chair)'
    : card.toAgentId
    ? agentById.get(card.toAgentId)?.name ?? 'Someone'
    : 'Open';

  // Phase-proposal cards get a distinct treatment: stronger visual weight,
  // Accept/Reject buttons (no freeform answer). Detected by prefix.
  const proposal = parsePhaseProposal(card.text);
  if (proposal && onAcceptPhase) {
    return (
      <div
        className="rounded-lg border-2 border-aurora-teal/50 bg-aurora-teal/8 dark:bg-aurora-teal/10 p-3 shadow-glow-teal"
        data-testid={`boardroom-qcard-proposal-${card.id}`}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-aurora-teal mb-1.5">
          Phase proposal
        </div>
        <div className="text-xs flex items-center gap-2 mb-2">
          <span className="font-medium">{fromName}</span>
          <span className="text-muted-foreground">proposes →</span>
          <span className="font-semibold text-foreground">{PHASE_LABELS[proposal.toPhase]}</span>
        </div>
        {proposal.rationale && (
          <div className="text-sm mb-3 leading-snug text-foreground/90">{proposal.rationale}</div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-aurora-teal hover:bg-aurora-teal/90 text-white border-transparent flex-1"
            onClick={() => onAcceptPhase(proposal.toPhase)}
            data-testid={`boardroom-qcard-proposal-accept-${card.id}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Accept · advance to {PHASE_LABELS[proposal.toPhase]}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSkip()}
            data-testid={`boardroom-qcard-proposal-reject-${card.id}`}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

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

// ----------------------------------------------------------------------
// TurnMarkdown — rich rendering for in-thread turn content.
// Mirrors the standard chat's ChatMessageBody pipeline (markdown + GFM
// tables + math + syntax-highlighted code) but in a leaner package
// suited to the boardroom's tighter bubbles. Lets agents emit headings,
// bold, lists, journal-entry tables, math formulas, and code blocks
// without the chair seeing raw markdown syntax.
// ----------------------------------------------------------------------

const TurnMarkdown = React.memo(function TurnMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-headings:font-exo prose-headings:tracking-tight prose-headings:mt-2.5 prose-headings:mb-1
      prose-h1:text-base prose-h2:text-[15px] prose-h3:text-[13.5px] prose-h4:text-[13px]
      prose-strong:text-foreground prose-strong:font-semibold
      prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:leading-relaxed
      prose-code:text-[12px] prose-code:font-mono prose-code:bg-foreground/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-border prose-pre:p-3 prose-pre:rounded-md prose-pre:my-2
      prose-table:my-2 prose-table:text-[12.5px]
      prose-th:font-semibold prose-th:text-foreground prose-th:bg-foreground/5
      prose-blockquote:border-l-2 prose-blockquote:border-aurora-teal/40 prose-blockquote:pl-3 prose-blockquote:not-italic prose-blockquote:text-foreground/85
      prose-hr:my-3"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

// ----------------------------------------------------------------------
// FinalMemoCard — surfaces the Moderator's resolution-phase output as
// the boardroom's deliverable, with copy + download actions. The
// resolution-phase prompt enforces a structured Markdown format
// (## Background / ## Issue / ## Analysis / ## Recommendation / etc.)
// so this is just rendering, not parsing.
// ----------------------------------------------------------------------

function FinalMemoCard({
  turns,
  phase,
  agents,
  threadTitle,
}: {
  turns: BoardroomTurnDTO[];
  phase: string;
  agents: Array<{ id: string; name: string; createdFromTemplate?: string | null }>;
  threadTitle: string;
}) {
  const memoBodyRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { toast } = useToast();
  const memo = useMemo(() => {
    if (phase !== 'resolution') return null;
    // Find the latest completed Moderator turn. Walk in reverse for cheap
    // first-match.
    const moderatorIds = new Set(
      agents
        .filter((a) => (a.createdFromTemplate ?? '') === 'moderator-bot' || /moderator/i.test(a.name))
        .map((a) => a.id),
    );
    if (moderatorIds.size === 0) return null;
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (
        t.status === 'completed'
        && t.speakerKind === 'agent'
        && t.agentId
        && moderatorIds.has(t.agentId)
        && t.content
        && t.content.includes('## ')
      ) {
        return t.content;
      }
    }
    return null;
  }, [turns, phase, agents]);

  if (!memo) return null;

  const safeTitle = threadTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'Boardroom';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filenameMd = `${safeTitle}-memo-${dateStamp}.md`;
  const filenamePdf = `${safeTitle}-memo-${dateStamp}.pdf`;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(memo); } catch { /* clipboard may be unavailable */ }
  };

  const handleDownloadMd = () => {
    const blob = new Blob([memo], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameMd;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF generation — mirrors DocumentArtifact's pattern exactly:
  // 1. PRIMARY: server route POST /export-memo → puppeteer + KaTeX
  //    pipeline (buildDocumentPdfBuffer) produces a real vector PDF
  //    with proper text, tables, and math rendering.
  // 2. FALLBACK: client-side pdfmake + html-to-pdfmake. Vector PDF
  //    too (not html2canvas raster) so output quality is acceptable
  //    even without the server route.
  const downloadPdfClientSide = async () => {
    if (!memoBodyRef.current) {
      throw new Error('Memo body not rendered');
    }
    const [{ default: htmlToPdfmake }, pdfmakeMod, vfsMod] = await Promise.all([
      import('html-to-pdfmake'),
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);

    const pdfmake: any = (pdfmakeMod as any).default ?? pdfmakeMod;
    const vfs: any = (vfsMod as any).default ?? vfsMod;
    pdfmake.vfs = vfs.pdfMake?.vfs ?? vfs.vfs ?? vfs;

    const html = memoBodyRef.current.innerHTML;
    const body = htmlToPdfmake(html, {
      defaultStyles: {
        h1: { fontSize: 18, bold: true, marginTop: 14, marginBottom: 6 },
        h2: { fontSize: 15, bold: true, marginTop: 12, marginBottom: 5 },
        h3: { fontSize: 13, bold: true, marginTop: 10, marginBottom: 4 },
        p: { marginBottom: 6, lineHeight: 1.35 },
        ul: { marginBottom: 6 },
        ol: { marginBottom: 6 },
        li: { marginBottom: 2 },
        table: { marginTop: 6, marginBottom: 6 },
        th: { bold: true, fillColor: '#f4f4f4' },
        code: { font: 'Courier', fontSize: 10 },
        pre: { font: 'Courier', fontSize: 10, background: '#f6f8fa' },
        blockquote: { italics: true, color: '#374151', marginLeft: 8 },
        a: { color: '#1a56db', decoration: 'underline' },
      },
    });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [48, 56, 48, 56] as [number, number, number, number],
      info: { title: threadTitle, creator: 'CA-GPT' },
      content: [
        { text: threadTitle, fontSize: 20, bold: true, marginBottom: 4 },
        {
          text: [
            { text: 'Final Board Memo · CA-GPT Roundtable · ', color: '#666' },
            { text: `Generated ${new Date().toLocaleDateString()}`, color: '#666' },
          ],
          fontSize: 9,
          marginBottom: 14,
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], marginBottom: 10 },
        body,
      ],
      defaultStyle: { fontSize: 11, lineHeight: 1.35, color: '#111' },
    };

    pdfmake.createPdf(docDefinition).download(filenamePdf);
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    let serverError: string | null = null;
    try {
      // Server pipeline first — buildDocumentPdfBuffer renders via
      // headless Chrome for a true vector PDF with KaTeX-rendered math
      // and proper table layout. Same pipeline as DocumentArtifact.
      const res = await fetch('/api/roundtable/boardroom/export-memo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: threadTitle, content: memo }),
      });
      const contentType = res.headers.get('content-type') ?? '';

      // Defensive: only treat as PDF if both status and content-type
      // confirm it. Without this check, a stale server (route not yet
      // mounted) returns Vite's index.html with status 200, and we
      // happily download HTML as a .pdf file.
      if (res.ok && contentType.startsWith('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filenamePdf;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      if (res.ok && !contentType.startsWith('application/pdf')) {
        serverError = `Server returned ${contentType || 'unknown content type'} instead of PDF — has the dev server been restarted since this route was added?`;
      } else {
        // Try to read JSON error body if any.
        let body = '';
        try { body = await res.text(); } catch { /* noop */ }
        serverError = `Server returned ${res.status}: ${body.slice(0, 200) || res.statusText}`;
      }
      console.warn('[BoardroomMemo] Server PDF export failed:', serverError, '— falling back to client-side');
      await downloadPdfClientSide();
    } catch (err) {
      console.error('[BoardroomMemo] PDF export error:', err);
      // Last-ditch attempt with client-side pipeline.
      try {
        await downloadPdfClientSide();
      } catch (fallbackErr) {
        console.error('[BoardroomMemo] Client-side fallback also failed:', fallbackErr);
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        toast({
          title: 'PDF download failed',
          description: serverError
            ? `${serverError} (Client fallback: ${msg})`
            : `Both server and client pipelines failed. ${msg}`,
          variant: 'destructive',
        });
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      className="mt-6 rounded-lg border-2 border-aurora-teal/40 bg-card shadow-glow-teal overflow-hidden"
      data-testid="boardroom-final-memo"
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/70 bg-gradient-to-r from-aurora-teal/8 via-transparent to-transparent">
        <div className="w-7 h-7 rounded-md bg-gradient-aurora text-white flex items-center justify-center shadow-glow-teal">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-aurora-teal">
            Final board memo
          </span>
          <span className="font-exo text-sm font-semibold tracking-tight">{threadTitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleCopy}
            data-testid="boardroom-final-memo-copy"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleDownloadMd}
            data-testid="boardroom-final-memo-download-md"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> .md
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-xs bg-aurora-teal hover:bg-aurora-teal/90 text-white border-transparent"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            data-testid="boardroom-final-memo-download-pdf"
          >
            {downloadingPdf ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> .pdf</>
            ) : (
              <><Download className="w-3.5 h-3.5 mr-1" /> .pdf</>
            )}
          </Button>
        </div>
      </header>
      <div
        ref={memoBodyRef}
        className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none prose-headings:font-exo prose-headings:tracking-tight prose-h2:text-base prose-h2:mt-4 prose-h2:mb-1.5 prose-h2:text-aurora-teal prose-h2:font-semibold prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1 prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-strong:text-foreground"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo}</ReactMarkdown>
      </div>
    </div>
  );
}

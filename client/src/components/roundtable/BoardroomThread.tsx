/**
 * BoardroomThread — live multi-agent boardroom UI.
 *
 * Renders the active panel as a left rail (agents + per-agent state),
 * a phase bar, the running thread (turns + question cards), and a
 * compose box that lets the chair interject / @-tag a specific agent.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  StopCircle,
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
        action={
          <Button onClick={onConfigurePanel}>Open panel builder</Button>
        }
      />
    );
  }

  // -- Active boardroom UI -------------------------------------------

  const startSession = async () => {
    if (!board.activeThreadId) {
      const first = chairText.trim() || 'Open the floor.';
      const t = await board.createThread({ title: first.slice(0, 80), conversationId });
      // Send the chair's opening prompt.
      if (chairText.trim()) {
        setChairText('');
        await board.interject(first);
      } else {
        await board.kickoff();
      }
      return t;
    }
  };

  const sendChair = async () => {
    const text = chairText.trim();
    if (!text) return;
    setChairText('');
    if (!board.activeThreadId) {
      await board.createThread({ title: text.slice(0, 80), conversationId });
      // The newly created thread is loaded by createThread — fire interject after a tick.
      setTimeout(() => board.interject(text).catch(() => {}), 50);
      return;
    }
    if (taggedAgent && taggedAgent !== 'all') {
      await board.tagAgent(taggedAgent, text);
    } else {
      await board.interject(text);
    }
  };

  const stopSpeaker = async () => {
    const speaking = board.turns.find((t) => t.status === 'streaming');
    if (speaking) await board.cancelTurn(speaking.id);
  };

  const openCards = board.questionCards.filter((c) => c.status === 'open');

  // Phase 3: group child turns (parentTurnId set) under their parent so
  // side-threads opened by `start_side_thread` render as a nested,
  // collapsible block beneath the originating turn.
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

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left rail */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col">
        <div className="px-4 py-3 border-b">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Panel</div>
          <div className="text-sm font-semibold truncate" title={panel.hydrated?.panel?.name ?? ''}>
            {panel.hydrated?.panel?.name ?? 'Panel'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs mt-2"
            onClick={onConfigurePanel}
            data-testid="boardroom-configure-panel"
          >
            Configure
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <ul className="px-2 py-2 space-y-1">
            {agents.map((a) => {
              const state: ParticipantState = board.participantStates[a.id] ?? 'listening';
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 text-sm"
                  data-testid={`boardroom-participant-${a.id}`}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-base"
                    style={{ background: a.color ?? '#e5e7eb' }}
                  >
                    {a.avatar ?? '🧑'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <ParticipantBadge state={state} useBaseKnowledge={a.useBaseKnowledge} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </aside>

      {/* Main column */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Phase bar */}
        <header className="px-4 py-2 border-b flex items-center gap-3">
          <div className="text-xs text-muted-foreground">Phase</div>
          <Select
            value={board.thread?.phase ?? 'opening'}
            onValueChange={(v) => board.setPhase(v).catch(() => {})}
            disabled={!board.activeThreadId}
          >
            <SelectTrigger className="h-8 w-[200px] text-sm" data-testid="boardroom-phase-select">
              <SelectValue placeholder="Phase" />
            </SelectTrigger>
            <SelectContent>
              {PHASES.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {board.turns.some((t) => t.status === 'streaming') ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={stopSpeaker}
              data-testid="boardroom-stop"
            >
              <StopCircle className="w-4 h-4 mr-1" /> Stop speaker
            </Button>
          ) : null}
          {!board.activeThreadId ? (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => startSession().catch(() => {})}
              data-testid="boardroom-start"
            >
              <PlayCircle className="w-4 h-4 mr-1" /> Start session
            </Button>
          ) : null}
        </header>

        {/* Thread */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {board.turns.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {board.activeThreadId
                ? 'Boardroom is open. Post your opening prompt below.'
                : 'No session yet. Type below and press Start.'}
            </div>
          ) : null}

          {turnGroups.map(({ parent, children }) => (
            <TurnGroup
              key={parent.id}
              parent={parent}
              children={children}
              agentById={agentById}
            />
          ))}

          {openCards.length > 0 && (
            <div className="border-t pt-3 mt-2 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Open question cards
              </div>
              {openCards.map((card) => (
                <QuestionCard
                  key={card.id}
                  card={card}
                  agents={agents}
                  agentById={agentById}
                  onAnswer={(answer) => board.answerQuestion(card.id, answer)}
                  onRedirect={(toAgentId) => board.redirectQuestion(card.id, toAgentId)}
                  onSkip={() => board.skipQuestion(card.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Compose */}
        <footer className="border-t p-3 bg-background">
          <div className="flex items-center gap-2 mb-2">
            <AtSign className="w-4 h-4 text-muted-foreground" />
            <Select value={taggedAgent} onValueChange={setTaggedAgent}>
              <SelectTrigger className="h-7 w-[200px] text-xs" data-testid="boardroom-tag-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Open floor (relevance loop)</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
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
                taggedAgent === 'all'
                  ? 'Pose a question to the panel… (Cmd/Ctrl+Enter to send)'
                  : `Address ${agentById.get(taggedAgent)?.name ?? 'agent'} directly…`
              }
              className="min-h-[60px] resize-none text-sm"
              data-testid="boardroom-compose"
            />
            <Button
              onClick={() => sendChair().catch(() => {})}
              disabled={!chairText.trim()}
              className="self-end"
              data-testid="boardroom-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {board.error && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {board.error}
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}

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
        {spinner ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        ) : null}
        <div className="text-base font-medium">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="pt-2">{action}</div> : null}
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
        agentAvatar={a?.avatar ?? null}
        agentColor={a?.color ?? null}
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
          {open && (
            <div className="space-y-3 pt-1">
              {children.map(renderBubble)}
            </div>
          )}
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
    speaking: 'text-emerald-600',
    thinking: 'text-amber-600',
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
  agentAvatar,
  agentColor,
}: {
  turn: BoardroomTurnDTO;
  agentName: string | null | undefined;
  agentAvatar: string | null | undefined;
  agentColor: string | null | undefined;
}) {
  const isUser = turn.speakerKind === 'user';
  const isStreaming = turn.status === 'streaming';
  const isCancelled = turn.status === 'cancelled';
  const isFailed = turn.status === 'failed';
  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      data-testid={`boardroom-turn-${turn.id}`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
        style={{ background: isUser ? '#0ea5e9' : (agentColor ?? '#e5e7eb') }}
      >
        {isUser ? '👤' : (agentAvatar ?? '🧑')}
      </div>
      <div className={`max-w-[78%] ${isUser ? 'text-right' : ''}`}>
        <div className="text-xs text-muted-foreground mb-0.5">
          {isUser ? 'You (chair)' : (agentName ?? 'Agent')}
          {isStreaming && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
              <Loader2 className="w-3 h-3 animate-spin" /> streaming
            </span>
          )}
          {isCancelled && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
              <XCircle className="w-3 h-3" /> cancelled
            </span>
          )}
          {isFailed && (
            <span className="ml-2 inline-flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-3 h-3" /> failed
            </span>
          )}
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser ? 'bg-sky-100 dark:bg-sky-950' : 'bg-muted'
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
  const toName = card.toUser ? 'You (chair)' : card.toAgentId ? agentById.get(card.toAgentId)?.name ?? 'Someone' : 'Open';
  return (
    <div
      className="border rounded-md p-3 bg-amber-50/60 dark:bg-amber-950/30"
      data-testid={`boardroom-qcard-${card.id}`}
    >
      <div className="text-xs flex items-center gap-2 mb-1">
        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">{fromName}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{toName}</span>
      </div>
      <div className="text-sm mb-2">{card.text}</div>
      {card.toUser ? (
        <div className="flex gap-2">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8"
            onClick={() => answer.trim() && onAnswer(answer.trim())}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Answer
          </Button>
        </div>
      ) : null}
      <div className="flex gap-2 mt-2">
        <Select value={redirectTo} onValueChange={setRedirectTo}>
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue placeholder="Redirect to…" />
          </SelectTrigger>
          <SelectContent>
            {agents
              .filter((a) => a.id !== card.toAgentId)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!redirectTo}
          onClick={() => redirectTo && onRedirect(redirectTo)}
        >
          Redirect
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSkip()}>
          Skip
        </Button>
      </div>
    </div>
  );
}

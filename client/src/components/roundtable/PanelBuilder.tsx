/**
 * PanelBuilder — drawer UI for curating a roundtable panel.
 *
 * UX rewrite: visible progress during panel creation (3-step card),
 * always-visible sticky footer with Cancel/Done so users can exit at
 * any point, live KB ingest status (polled by useRoundtablePanel),
 * and a clearer header Close affordance.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  fetchRoundtableTemplates,
  useRoundtablePanel,
  type AgentTemplateDTO,
  type HydratedAgentDTO,
} from '@/hooks/useRoundtablePanel';
import {
  Plus,
  Sparkles,
  Trash2,
  Copy,
  FileText,
  UploadCloud,
  AlertCircle,
  Loader2,
  UserRound,
  Gavel,
  ShieldCheck,
  Landmark,
  Search,
  ClipboardCheck,
  X,
  Check,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface PanelBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

type CreatePhase = 'idle' | 'conversation' | 'panel' | 'hydrate' | 'done';

const STEP_ORDER: Exclude<CreatePhase, 'idle'>[] = ['conversation', 'panel', 'hydrate', 'done'];
const STEP_LABEL: Record<Exclude<CreatePhase, 'idle'>, string> = {
  conversation: 'Roundtable conversation',
  panel: 'Panel container',
  hydrate: 'Hydrating agents & KB',
  done: 'Open boardroom',
};

export function PanelBuilder({ open, onOpenChange, conversationId, onConversationCreated }: PanelBuilderProps) {
  const { toast } = useToast();
  const panel = useRoundtablePanel(conversationId);
  const [templates, setTemplates] = useState<AgentTemplateDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [createPhase, setCreatePhase] = useState<CreatePhase>('idle');
  const stepStartedAtRef = useRef<Record<string, number>>({});
  const [stepDurations, setStepDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    fetchRoundtableTemplates()
      .then(setTemplates)
      .catch((err) => {
        console.warn('[PanelBuilder] template load failed', err);
      });
  }, [open]);

  // Auto-select the first agent when the panel hydrates.
  useEffect(() => {
    if (!selectedAgentId && panel.hydrated?.agents.length) {
      setSelectedAgentId(panel.hydrated.agents[0].id);
    }
    if (selectedAgentId && panel.hydrated && !panel.hydrated.agents.find((a) => a.id === selectedAgentId)) {
      setSelectedAgentId(panel.hydrated.agents[0]?.id ?? null);
    }
  }, [panel.hydrated, selectedAgentId]);

  const selectedAgent: HydratedAgentDTO | null = useMemo(() => {
    if (!selectedAgentId || !panel.hydrated) return null;
    return panel.hydrated.agents.find((a) => a.id === selectedAgentId) ?? null;
  }, [selectedAgentId, panel.hydrated]);

  const beginStep = (s: CreatePhase) => {
    setCreatePhase(s);
    stepStartedAtRef.current[s] = performance.now();
  };
  const completeStep = (s: CreatePhase) => {
    const start = stepStartedAtRef.current[s];
    if (start) {
      setStepDurations((d) => ({ ...d, [s]: Math.round(performance.now() - start) }));
    }
  };

  async function handleCreatePanel() {
    setStepDurations({});
    try {
      let targetConversationId = conversationId;
      if (!targetConversationId) {
        beginStep('conversation');
        const res = await fetch('/api/conversations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Roundtable conversation',
            preview: 'New roundtable conversation',
            chatMode: 'roundtable',
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}: Failed to create conversation`);
        }
        const payload = (await res.json()) as { conversation?: { id?: string } };
        const createdId = payload.conversation?.id;
        if (!createdId) throw new Error('Conversation created without id');
        targetConversationId = createdId;
        completeStep('conversation');
        onConversationCreated?.(createdId);
      } else {
        // existing conversation — record the step as already-done
        setStepDurations((d) => ({ ...d, conversation: 0 }));
      }

      beginStep('panel');
      await panel.createPanelForConversation('Roundtable panel', targetConversationId);
      completeStep('panel');

      // The hook auto-refreshes when panelId is set; show "hydrate" while we
      // wait for `panel.hydrated` to populate, then mark done.
      beginStep('hydrate');
    } catch (err) {
      setCreatePhase('idle');
      toast({
        title: 'Failed to create panel',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  }

  // When panel.hydrated arrives and we're in `hydrate` phase, complete it.
  useEffect(() => {
    if (createPhase !== 'hydrate' || !panel.hydrated) return;
    completeStep('hydrate');
    setCreatePhase('done');
    toast({
      title: 'Panel ready',
      description: 'Add experts to convene the boardroom.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPhase, panel.hydrated]);

  async function handleSpawnTemplate(t: AgentTemplateDTO) {
    try {
      await panel.spawnFromTemplate(t.id);
      toast({ title: `Added ${t.name}`, description: t.description });
    } catch (err) {
      toast({
        title: 'Could not spawn agent',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  }

  async function handleCreateCustom() {
    try {
      await panel.createCustomAgent({
        name: 'Custom Agent',
        systemPrompt: 'You are a domain expert in a roundtable. Stay focused on your area.',
        avatar: '🧠',
        color: 'text-slate-500',
      });
    } catch (err) {
      toast({
        title: 'Could not create agent',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  }

  // --- footer summary counters ---
  const docs = panel.hydrated?.docs ?? [];
  const ready = docs.filter((d) => d.ingestStatus === 'ready').length;
  const ingesting = docs.filter((d) => d.ingestStatus === 'pending').length;
  const failed = docs.filter((d) => d.ingestStatus === 'failed').length;
  const agentCount = panel.hydrated?.agents.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 flex flex-col bg-background border-l border-border/70 font-exo"
      >
        <SheetHeader className="px-6 py-4 border-b border-border/70 bg-gradient-to-r from-aurora-teal/8 via-transparent to-transparent relative shrink-0">
          <span aria-hidden className="absolute left-0 top-3 bottom-3 w-0.5 rounded bg-aurora-teal shadow-glow-teal" />
          <div className="flex items-start gap-3 pr-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-aurora text-white flex items-center justify-center shrink-0 shadow-glow-teal">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-exo font-semibold tracking-tight text-base">
                {panel.panelId
                  ? panel.hydrated?.panel?.name
                    ? `Panel · ${panel.hydrated.panel.name}`
                    : 'Panel Builder'
                  : 'Building your panel'}
              </SheetTitle>
              <SheetDescription className="text-foreground/75 text-sm">
                Curate the expert agents and reference material for this roundtable. Changes save automatically.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {panel.hydrated && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                  <Check className="w-3 h-3 mr-1" /> Saved
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => onOpenChange(false)}
                data-testid="panel-builder-close"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Close
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        {!panel.panelId && createPhase === 'idle' && (
          <EmptyCreate
            onCreate={handleCreatePanel}
            hasConversation={!!conversationId}
            templates={templates}
          />
        )}

        {!panel.panelId && createPhase !== 'idle' && (
          <ProgressCard phase={createPhase} durations={stepDurations} templates={templates} />
        )}

        {panel.panelId && panel.hydrated && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left column: agent list + spawn templates */}
            <div className="w-80 border-r border-border/70 flex flex-col bg-muted/10 shrink-0">
              <div className="p-4 border-b border-border/70 flex items-baseline justify-between">
                <p className="font-exo text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Roster
                </p>
                <span className="font-mono text-[11px] text-foreground/70">
                  {agentCount.toString().padStart(2, '0')}
                </span>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2.5 space-y-1.5">
                  {panel.hydrated.agents.length === 0 && (
                    <div className="px-2 py-3 text-xs text-foreground/65">
                      No agents yet. Spawn one below.
                    </div>
                  )}
                  {panel.hydrated.agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAgentId(a.id)}
                      className={`relative w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        selectedAgentId === a.id
                          ? 'bg-gradient-to-r from-aurora-teal/12 to-transparent border-aurora-teal/40 text-foreground'
                          : 'border-border/70 bg-background/50 hover:bg-muted/50 hover:border-border'
                      }`}
                    >
                      {selectedAgentId === a.id && (
                        <span
                          aria-hidden
                          className="absolute left-0.5 top-2 bottom-2 w-0.5 rounded bg-aurora-teal shadow-glow-teal"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                          {renderAgentIcon(a.name)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-foreground/65 flex items-center gap-1.5">
                            {!a.useBaseKnowledge && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-none">
                                KB-only
                              </Badge>
                            )}
                            <span>
                              {a.kbDocIds.length} doc{a.kbDocIds.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />
                <div className="p-3 space-y-2.5">
                  <p className="font-exo text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Spawn from template
                  </p>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSpawnTemplate(t)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border/70 bg-background/60 hover:bg-gradient-to-r hover:from-aurora-teal/8 hover:to-transparent hover:border-aurora-teal/30 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                          {renderAgentIcon(t.name)}
                        </span>
                        <span className="font-medium">{t.name}</span>
                      </div>
                      <p className="text-foreground/70 mt-1 leading-snug">{t.description}</p>
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-border/70 bg-background/40 hover:bg-muted/40"
                    onClick={handleCreateCustom}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Custom agent
                  </Button>
                </div>
              </ScrollArea>
            </div>

            {/* Right column: agent editor + KB panel */}
            <div className="flex-1 overflow-hidden flex flex-col bg-background min-w-0">
              {selectedAgent ? (
                <AgentEditor
                  key={selectedAgent.id}
                  agent={selectedAgent}
                  panelDocs={panel.hydrated.docs}
                  onUpdate={(patch) => panel.updateAgent(selectedAgent.id, patch)}
                  onDelete={() => panel.deleteAgent(selectedAgent.id)}
                  onClone={() => panel.cloneAgent(selectedAgent.id)}
                  onAttachDoc={(docId) => panel.attachDocToAgent(selectedAgent.id, docId)}
                  onDetachDoc={(docId) => panel.detachDocFromAgent(selectedAgent.id, docId)}
                  onUploadFile={panel.uploadKbFile}
                  onAddText={panel.addKbText}
                  onDeleteDoc={panel.deleteKbDoc}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Select or spawn an agent to configure it.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky bottom action bar — always visible regardless of state */}
        <div className="border-t border-border/70 bg-card/40 px-5 py-3 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {panel.hydrated ? (
              <>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/60" />
                  {agentCount} agent{agentCount === 1 ? '' : 's'}
                </Badge>
                {ready > 0 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {ready} doc{ready === 1 ? '' : 's'} ready
                  </Badge>
                )}
                {ingesting > 0 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1.5 border-aurora-teal/40 text-aurora-teal bg-aurora-teal/10">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    {ingesting} ingesting
                  </Badge>
                )}
                {failed > 0 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1.5 border-destructive/40 text-destructive bg-destructive/10">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive" />
                    {failed} failed
                  </Badge>
                )}
              </>
            ) : createPhase !== 'idle' ? (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1.5 border-aurora-teal/40 text-aurora-teal bg-aurora-teal/10">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Initialising
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                Not yet created
              </Badge>
            )}
          </div>
          <div className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
            {panel.hydrated ? 'Saved on blur · ' : ''}
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/70 text-foreground/80 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            to {panel.hydrated ? 'exit' : 'cancel'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {panel.hydrated ? 'Cancel' : 'Close'}
            </Button>
            <Button
              size="sm"
              className="bg-gradient-aurora text-white border-transparent shadow-glow-teal hover:opacity-95"
              onClick={() => onOpenChange(false)}
              disabled={!panel.hydrated}
              data-testid="panel-builder-done"
            >
              Done <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------------
// EmptyCreate — shown when no panel exists yet (idle state)
// ----------------------------------------------------------------------

function EmptyCreate({
  onCreate,
  hasConversation,
  templates,
}: {
  onCreate: () => void | Promise<void>;
  hasConversation: boolean;
  templates: AgentTemplateDTO[];
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center bg-gradient-to-b from-background to-muted/15">
      <div className="w-12 h-12 rounded-xl bg-gradient-aurora text-white flex items-center justify-center shadow-glow-teal">
        <Sparkles className="w-6 h-6" />
      </div>
      <div className="space-y-1 max-w-md">
        <p className="font-exo font-semibold text-base tracking-tight">No panel for this chat yet</p>
        <p className="text-sm text-foreground/75">
          Create a panel to start adding expert agents and uploading reference material.
        </p>
      </div>
      <Button
        onClick={onCreate}
        className="bg-gradient-aurora text-white border-transparent shadow-glow-teal hover:opacity-95"
        data-testid="panel-builder-create"
      >
        <Plus className="w-4 h-4 mr-2" /> Create panel
      </Button>
      {!hasConversation && (
        <p className="text-xs text-foreground/70 max-w-md flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          A new roundtable conversation will be created automatically.
        </p>
      )}

      {/* Skeleton preview of what comes next so the user knows they're not stuck. */}
      {templates.length > 0 && (
        <div className="mt-4 w-full max-w-xl opacity-60 pointer-events-none">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3 text-left">
            Next · You'll add experts like these
          </p>
          <div className="grid grid-cols-3 gap-2">
            {templates.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/70 bg-background text-xs"
              >
                <span className="w-6 h-6 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                  {renderAgentIcon(t.name)}
                </span>
                <span className="truncate">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// ProgressCard — visible 3-step progress while panel is being created
// ----------------------------------------------------------------------

function ProgressCard({
  phase,
  durations,
  templates,
}: {
  phase: CreatePhase;
  durations: Record<string, number>;
  templates: AgentTemplateDTO[];
}) {
  const order = STEP_ORDER;
  const activeIdx = order.indexOf(phase as Exclude<CreatePhase, 'idle'>);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-background to-muted/10">
      <div className="rounded-xl border border-aurora-teal/25 bg-gradient-to-br from-aurora-teal/5 to-aurora-cyan/5 p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-aurora-teal shadow-glow-teal animate-pulse" />
          <h3 className="font-exo font-semibold text-base tracking-tight">
            Convening the boardroom…
          </h3>
          <span className="ml-auto text-[11px] font-mono text-muted-foreground">
            {phase === 'done' ? 'complete' : 'running'}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center">
          {order.map((step, i) => {
            const isDone = i < activeIdx || phase === 'done';
            const isActive = i === activeIdx && phase !== 'done';
            return (
              <Fragment key={step}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-mono font-semibold ${
                      isDone
                        ? 'bg-emerald-500 border-transparent text-white'
                        : isActive
                        ? 'border-aurora-teal text-aurora-teal animate-pulse'
                        : 'border-border text-muted-foreground bg-background'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-[13px] font-medium truncate ${
                        isDone || isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {STEP_LABEL[step]}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        isActive ? 'text-aurora-teal' : 'text-muted-foreground'
                      }`}
                    >
                      {isDone
                        ? `${durations[step] ?? 0}ms · ✓`
                        : isActive
                        ? 'running…'
                        : 'queued'}
                    </span>
                  </div>
                </div>
                {i < order.length - 1 && (
                  <div
                    className={`h-0.5 w-12 mx-2 rounded ${
                      isDone
                        ? 'bg-gradient-to-r from-emerald-500 to-aurora-teal'
                        : isActive
                        ? 'bg-gradient-to-r from-aurora-teal to-border'
                        : 'bg-border'
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-dashed border-border/70 text-xs text-foreground/70 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-aurora-teal" />
          You can keep working in another tab — we'll notify you when it's ready.
        </div>
      </div>

      {/* Skeleton preview of templates for visual continuity */}
      {templates.length > 0 && (
        <div className="mt-6 opacity-50 pointer-events-none">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Next · Add experts to your panel
          </p>
          <div className="grid grid-cols-3 gap-2">
            {templates.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/70 bg-background text-xs"
              >
                <span className="w-6 h-6 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                  {renderAgentIcon(t.name)}
                </span>
                <span className="truncate">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Agent editor sub-component
// ----------------------------------------------------------------------

interface AgentEditorProps {
  agent: HydratedAgentDTO;
  panelDocs: { id: string; filename: string; ingestStatus: string }[];
  onUpdate: (patch: Partial<HydratedAgentDTO>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClone: () => Promise<void>;
  onAttachDoc: (docId: string) => Promise<void>;
  onDetachDoc: (docId: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onAddText: (filename: string, content: string) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
}

function AgentEditor({
  agent,
  panelDocs,
  onUpdate,
  onDelete,
  onClone,
  onAttachDoc,
  onDetachDoc,
  onUploadFile,
  onAddText,
  onDeleteDoc,
}: AgentEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState(agent.name);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [useBase, setUseBase] = useState(agent.useBaseKnowledge);
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync form when agent changes (e.g. after clone/delete).
  useEffect(() => {
    setName(agent.name);
    setSystemPrompt(agent.systemPrompt);
    setUseBase(agent.useBaseKnowledge);
  }, [agent.id]);

  async function persist(patch: Partial<HydratedAgentDTO>) {
    setBusy(true);
    try {
      await onUpdate(patch);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      await onUploadFile(file);
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/60">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                {renderAgentIcon(agent.name)}
              </span>
              <h3 className="font-exo text-lg font-semibold tracking-tight">{agent.name}</h3>
            </div>
            <p className="text-xs text-foreground/65">
              {agent.createdFromTemplate
                ? `Spawned from "${agent.createdFromTemplate}" template`
                : 'Custom agent'}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onClone} title="Clone agent" className="hover:bg-muted/70">
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              title="Delete agent"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== agent.name && persist({ name })}
            />
          </div>

          <div>
            <Label htmlFor="agent-prompt">System prompt</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={() => systemPrompt !== agent.systemPrompt && persist({ systemPrompt })}
              className="min-h-[140px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Defines the agent&apos;s behaviour. Edit freely; saved on blur.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-3.5">
            <div className="space-y-0.5">
              <Label className="text-sm">Use base training knowledge</Label>
              <p className="text-xs text-muted-foreground">
                When off, the agent must answer only from attached KB docs and will refuse otherwise.
              </p>
            </div>
            <Switch
              checked={useBase}
              onCheckedChange={(v) => {
                setUseBase(v);
                persist({ useBaseKnowledge: v });
              }}
              disabled={busy}
            />
          </div>
        </div>

        <Separator />

        {/* Knowledge base section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-exo text-sm font-semibold tracking-tight">Knowledge base</h4>
            <span className="text-xs text-muted-foreground">
              {agent.kbDocIds.length} attached · {panelDocs.length} in panel
            </span>
          </div>

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 px-4 py-5 rounded-lg border border-dashed border-border-strong/70 bg-muted/30 hover:border-aurora-teal/50 hover:bg-aurora-teal/5 transition-colors"
          >
            <UploadCloud className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Drop a file or click to upload</span>
            <span className="text-[11px] text-muted-foreground">
              TXT, CSV, JSON, MD, HTML · ≤ 5 MB · embeddings start automatically
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload knowledge base file"
            title="Upload knowledge base file"
            accept=".txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,text/*,application/json,application/xml"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) await handleFile(file);
            }}
          />

          {/* Quick paste */}
          <div className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <p className="text-xs font-medium">Paste text instead</p>
            <Input
              placeholder="Title (e.g. UAE Free Zone Manual.txt)"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste literature, notes, or source text…"
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              className="min-h-[80px] text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              className="bg-aurora-teal/20 hover:bg-aurora-teal/30 text-foreground border border-aurora-teal/30"
              disabled={!textTitle.trim() || !textBody.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onAddText(textTitle, textBody);
                  setTextTitle('');
                  setTextBody('');
                } catch (err) {
                  toast({
                    title: 'Upload failed',
                    description: err instanceof Error ? err.message : String(err),
                    variant: 'destructive',
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FileText className="w-4 h-4 mr-1" /> Add as KB doc
            </Button>
          </div>

          {/* Panel docs list with attach toggles + live status */}
          <div className="rounded-lg border border-border/70 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60 text-xs font-medium bg-muted/25 flex items-center justify-between">
              <span>Panel documents</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {panelDocs.length}
              </span>
            </div>
            {panelDocs.length === 0 && (
              <div className="px-3 py-4 text-xs text-foreground/65">No docs uploaded yet.</div>
            )}
            <ul className="divide-y divide-border/60">
              {panelDocs.map((d) => {
                const attached = agent.kbDocIds.includes(d.id);
                return (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 min-w-0">{d.filename}</span>
                    <DocStatusBadge status={d.ingestStatus} />
                    <Button
                      size="sm"
                      variant={attached ? 'default' : 'outline'}
                      className={`h-6 px-2 text-[11px] ${
                        attached
                          ? 'bg-aurora-teal hover:bg-aurora-teal/90 text-white border-transparent'
                          : ''
                      }`}
                      onClick={() => (attached ? onDetachDoc(d.id) : onAttachDoc(d.id))}
                      disabled={d.ingestStatus !== 'ready'}
                    >
                      {attached ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}
                      {attached ? 'Attached' : 'Attach'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDeleteDoc(d.id)}
                      title="Delete from panel"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === 'ready') {
    return (
      <Badge
        variant="outline"
        className="text-[9.5px] px-1.5 py-0 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        ready
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge
        variant="outline"
        className="text-[9.5px] px-1.5 py-0 gap-1 border-destructive/40 text-destructive bg-destructive/10"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive" />
        failed
      </Badge>
    );
  }
  // pending
  return (
    <Badge
      variant="outline"
      className="text-[9.5px] px-1.5 py-0 gap-1 border-aurora-teal/40 text-aurora-teal bg-aurora-teal/10"
    >
      <Loader2 className="w-2.5 h-2.5 animate-spin" />
      embedding
    </Badge>
  );
}

function renderAgentIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('moderator')) return <UserRound className="w-4 h-4 text-aurora-teal-soft" />;
  if (lower.includes('tax')) return <Landmark className="w-4 h-4 text-foreground/80" />;
  if (lower.includes('audit')) return <ShieldCheck className="w-4 h-4 text-foreground/80" />;
  if (lower.includes('ifrs')) return <Gavel className="w-4 h-4 text-foreground/80" />;
  if (lower.includes('forensic')) return <Search className="w-4 h-4 text-foreground/80" />;
  if (lower.includes('compliance')) return <ClipboardCheck className="w-4 h-4 text-foreground/80" />;
  return <UserRound className="w-4 h-4 text-foreground/80" />;
}

/**
 * PanelBuilder — drawer UI for curating a roundtable panel.
 *
 * Phase-1 scope: agent CRUD (spawn from template OR write custom),
 * KB upload (text/file), per-agent KB attachment, base-knowledge toggle.
 * Phase-2 will add the live boardroom thread.
 *
 * Design:
 * - A right-side <Sheet> drawer so it doesn't overlap the chat composer.
 * - Two columns: agent list (left), agent detail / KB management (right).
 * - All mutations go through useRoundtablePanel; component is otherwise
 *   stateless to keep complexity low.
 */

import { useEffect, useMemo, useState } from 'react';
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
  Upload,
  AlertCircle,
  Loader2,
  UserRound,
  Gavel,
  ShieldCheck,
  Landmark,
  Search,
  ClipboardCheck,
} from 'lucide-react';

interface PanelBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

export function PanelBuilder({ open, onOpenChange, conversationId, onConversationCreated }: PanelBuilderProps) {
  const { toast } = useToast();
  const panel = useRoundtablePanel(conversationId);
  const [templates, setTemplates] = useState<AgentTemplateDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [creatingPanel, setCreatingPanel] = useState(false);

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

  async function handleCreatePanel() {
    setCreatingPanel(true);
    try {
      let targetConversationId = conversationId;
      if (!targetConversationId) {
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
        const payload = await res.json() as { conversation?: { id?: string } };
        const createdId = payload.conversation?.id;
        if (!createdId) {
          throw new Error('Conversation created without id');
        }
        targetConversationId = createdId;
        onConversationCreated?.(createdId);
      }

      await panel.createPanelForConversation('Roundtable panel', targetConversationId);
    } catch (err) {
      toast({
        title: 'Failed to create panel',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setCreatingPanel(false);
    }
  }

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col bg-background border-l border-border/70 font-exo">
        <SheetHeader className="px-6 py-4 border-b border-border/70 bg-gradient-to-r from-aurora-teal/8 via-transparent to-transparent relative">
          <span aria-hidden className="absolute left-0 top-3 bottom-3 w-0.5 rounded bg-aurora-teal shadow-glow-teal" />
          <SheetTitle className="font-exo font-semibold tracking-tight">Panel Builder</SheetTitle>
          <SheetDescription className="text-foreground/75">
            Curate the expert agents for this roundtable. Spawn from a template or build a custom expert.
            Each agent runs independently with its own system prompt and attached knowledge.
          </SheetDescription>
        </SheetHeader>

        {!panel.panelId && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center bg-gradient-to-b from-background to-muted/15">
            <div className="w-12 h-12 rounded-xl bg-gradient-aurora/80 text-white flex items-center justify-center shadow-glow-teal">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-exo font-semibold text-base tracking-tight">No panel for this chat yet</p>
              <p className="text-sm text-foreground/75">
                Create a panel to start adding expert agents and uploading reference material.
              </p>
            </div>
            <Button
              onClick={handleCreatePanel}
              disabled={creatingPanel}
              className="!bg-gradient-aurora !text-white !border-transparent shadow-glow-teal hover:opacity-95"
            >
              {creatingPanel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create panel
            </Button>
            {!conversationId && (
              <p className="text-xs text-foreground/70 max-w-md flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                A new roundtable conversation will be created automatically.
              </p>
            )}
          </div>
        )}

        {panel.panelId && panel.hydrated && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left column: agent list + spawn templates */}
            <div className="w-80 border-r border-border/70 flex flex-col bg-muted/10">
              <div className="p-4 border-b border-border/70 space-y-2">
                <p className="font-exo text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Roster</p>
                {panel.hydrated.agents.length === 0 && (
                  <p className="text-xs text-foreground/70">No agents yet. Spawn one below.</p>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2.5 space-y-1.5">
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
                        <span aria-hidden className="absolute left-0.5 top-2 bottom-2 w-0.5 rounded bg-aurora-teal shadow-glow-teal" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                          {renderAgentIcon(a.name)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-foreground/65 flex items-center gap-1">
                            {!a.useBaseKnowledge && <Badge variant="secondary" className="text-[10px] px-1 py-0">KB-only</Badge>}
                            <span>{a.kbDocIds.length} doc{a.kbDocIds.length === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />
                <div className="p-3 space-y-2.5">
                  <p className="font-exo text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Spawn from template</p>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSpawnTemplate(t)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border/70 bg-background/60 hover:bg-gradient-to-r hover:from-aurora-teal/8 hover:to-transparent hover:border-aurora-teal/30 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center">
                          {renderTemplateIcon(t.name)}
                        </span>
                        <span className="font-medium">{t.name}</span>
                      </div>
                      <p className="text-foreground/70 mt-1 leading-snug">{t.description}</p>
                    </button>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-border/70 bg-background/40 hover:bg-muted/40" onClick={handleCreateCustom}>
                    <Plus className="w-4 h-4 mr-1" /> Custom agent
                  </Button>
                </div>
              </ScrollArea>
            </div>

            {/* Right column: agent editor + KB panel */}
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
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
      </SheetContent>
    </Sheet>
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
              {agent.createdFromTemplate ? `Spawned from “${agent.createdFromTemplate}” template` : 'Custom agent'}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onClone} title="Clone agent" className="hover:bg-muted/70">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete agent" className="hover:bg-destructive/10 hover:text-destructive">
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

          {/* Quick paste */}
          <div className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <p className="text-xs font-medium">Paste text</p>
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

          {/* File upload */}
          <div className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
            <p className="text-xs font-medium">Upload file (text/csv/json/md/html, ≤ 5 MB)</p>
            <input
              type="file"
              aria-label="Upload knowledge base file"
              title="Upload knowledge base file"
              accept=".txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,text/*,application/json,application/xml"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
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
              }}
            />
            <p className="text-xs text-muted-foreground">
              <Upload className="w-3 h-3 inline mr-1" />
              PDF/DOCX support arrives in the next phase.
            </p>
          </div>

          {/* Panel docs list with attach toggles */}
          <div className="rounded-lg border border-border/70 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60 text-xs font-medium bg-muted/25">Panel documents</div>
            {panelDocs.length === 0 && (
              <div className="px-3 py-4 text-xs text-foreground/65">No docs uploaded yet.</div>
            )}
            <ul className="divide-y">
              {panelDocs.map((d) => {
                const attached = agent.kbDocIds.includes(d.id);
                return (
                  <li key={d.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{d.filename}</span>
                      <Badge
                        variant={
                          d.ingestStatus === 'ready'
                            ? 'default'
                            : d.ingestStatus === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-[10px] px-1 py-0"
                      >
                        {d.ingestStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={attached ? 'default' : 'outline'}
                        className="h-6 px-2 text-xs"
                        onClick={() => (attached ? onDetachDoc(d.id) : onAttachDoc(d.id))}
                      >
                        {attached ? 'Attached' : 'Attach'}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onDeleteDoc(d.id)}
                        title="Delete from panel"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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

function renderTemplateIcon(name: string) {
  return renderAgentIcon(name);
}

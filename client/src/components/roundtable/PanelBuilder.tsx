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
} from 'lucide-react';

interface PanelBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
}

export function PanelBuilder({ open, onOpenChange, conversationId }: PanelBuilderProps) {
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
    if (!conversationId) {
      toast({
        title: 'Open a chat first',
        description: 'Roundtable panels are scoped to a conversation. Start a chat in roundtable mode and try again.',
        variant: 'destructive',
      });
      return;
    }
    setCreatingPanel(true);
    try {
      await panel.createPanelForConversation('Roundtable panel');
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
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Panel Builder</SheetTitle>
          <SheetDescription>
            Curate the expert agents for this roundtable. Spawn from a template or build a custom expert.
            Each agent runs independently with its own system prompt and attached knowledge.
          </SheetDescription>
        </SheetHeader>

        {!panel.panelId && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No panel for this chat yet</p>
              <p className="text-sm text-muted-foreground">
                Create a panel to start adding expert agents and uploading reference material.
              </p>
            </div>
            <Button onClick={handleCreatePanel} disabled={creatingPanel || !conversationId}>
              {creatingPanel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create panel
            </Button>
            {!conversationId && (
              <p className="text-xs text-muted-foreground max-w-md flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Start a chat in Roundtable mode first; the panel will attach to that conversation.
              </p>
            )}
          </div>
        )}

        {panel.panelId && panel.hydrated && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left column: agent list + spawn templates */}
            <div className="w-72 border-r flex flex-col">
              <div className="p-4 border-b space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Roster</p>
                {panel.hydrated.agents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No agents yet. Spawn one below.</p>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {panel.hydrated.agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAgentId(a.id)}
                      className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors ${
                        selectedAgentId === a.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{a.avatar ?? '🤖'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {!a.useBaseKnowledge && <Badge variant="secondary" className="text-[10px] px-1 py-0">KB-only</Badge>}
                            <span>{a.kbDocIds.length} doc{a.kbDocIds.length === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />
                <div className="p-3 space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Spawn from template</p>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSpawnTemplate(t)}
                      className="w-full text-left px-3 py-2 rounded-md border hover:bg-muted text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.avatar}</span>
                        <span className="font-medium">{t.name}</span>
                      </div>
                      <p className="text-muted-foreground mt-1 leading-snug">{t.description}</p>
                    </button>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCreateCustom}>
                    <Plus className="w-4 h-4 mr-1" /> Custom agent
                  </Button>
                </div>
              </ScrollArea>
            </div>

            {/* Right column: agent editor + KB panel */}
            <div className="flex-1 overflow-hidden flex flex-col">
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
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{agent.avatar ?? '🤖'}</span>
              <h3 className="text-lg font-semibold">{agent.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {agent.createdFromTemplate ? `Spawned from “${agent.createdFromTemplate}” template` : 'Custom agent'}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onClone} title="Clone agent">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete agent">
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

          <div className="flex items-center justify-between rounded-md border p-3">
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
            <h4 className="text-sm font-semibold">Knowledge base</h4>
            <span className="text-xs text-muted-foreground">
              {agent.kbDocIds.length} attached · {panelDocs.length} in panel
            </span>
          </div>

          {/* Quick paste */}
          <div className="rounded-md border p-3 space-y-2">
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
          <div className="rounded-md border p-3 space-y-2">
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
          <div className="rounded-md border">
            <div className="px-3 py-2 border-b text-xs font-medium">Panel documents</div>
            {panelDocs.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">No docs uploaded yet.</div>
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

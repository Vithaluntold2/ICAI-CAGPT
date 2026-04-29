import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAuth } from "@/lib/auth";
import { chatApi, conversationApi } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import OutputPane from "@/components/OutputPane";
import type { ChartData } from "@/components/visualizations/VisualizationRenderer";

import ChatOverlay from "@/components/ChatOverlay";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { rehypeArtifactPlaceholder } from "@/components/chat/rehypeArtifactPlaceholder";
import { normalizeMath } from "@/lib/mathNormalizer";
import { normalizeArtifactPlaceholders } from "@/lib/normalizeArtifactPlaceholders";
import { ArtifactRenderer } from "@/components/chat/artifacts/ArtifactRenderer";
import { FlowchartArtifact } from "@/components/chat/artifacts/FlowchartArtifact";
import { MindmapArtifact } from "@/components/chat/artifacts/MindmapArtifact";
import { CodeBlockWithCopy } from "@/components/chat/CodeBlockWithCopy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import cagptLogoUrl from "@assets/icai-ca-india-logo.png";
import {
  Plus,
  Send,
  MessageSquare,
  Settings,
  LogOut,
  Maximize2,
  Search,
  Building2,
  MoreVertical,
  Pin,
  PinOff,
  Edit3,
  Share2,
  Trash2,
  Check,
  Paperclip,
  X,
  FileText,
  Moon,
  Sun,
  Sparkles,
  ListChecks,
  Network,
  FileBarChart,
  Calculator,
  Star,
  TrendingUp,
  FileEdit,
  Search as SearchIcon,
  Users as UsersIcon,
  BookOpen,
  ChevronRight,
  Loader2,
  Bot,
  Monitor,
} from "lucide-react";
import { ConversationFeedback } from "@/components/ConversationFeedback";
import MessageFeedback from "@/components/MessageFeedback";
import { ConversationListSkeleton } from "@/components/ui/LoadingSkeleton";
import { VoiceModeEnhanced, MessageSpeakButton } from "@/components/voice/VoiceModeEnhanced";
import type { SpeakControls } from "@/components/voice/VoiceModeEnhanced";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import { useFeatureFlags } from "@/lib/featureFlags";
import { ChatViewSwitcher, useChatView } from "@/components/chat/ChatViewSwitcher";
import { ChatMessageRich } from "@/components/chat/ChatMessageRich";
import { Whiteboard } from "@/components/chat/whiteboard/Whiteboard";
import { ChatPIP } from "@/components/chat/pip/ChatPIP";
import { Composer } from "@/components/chat/Composer";
import { ChatInputBox } from "@/components/chat/ChatInputBox";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import type { ComposerSelection } from "@/components/chat/Composer";
// New AppShell + chat primitives (UI rethink, Task 17).
import { AppShell } from "@/components/shell/AppShell";
import { CommandMenu } from "@/components/shell/CommandMenu";
import { ChatBreadcrumb } from "@/components/chat/ChatBreadcrumb";
import { MessageColumn } from "@/components/chat/MessageColumn";
import { UserTurn } from "@/components/chat/UserTurn";
import { AssistantTurn } from "@/components/chat/AssistantTurn";
import { EmptyModeState } from "@/components/chat/EmptyModeState";
import { ChatMessageBody } from "@/components/chat/ChatMessageBody";
import { getMode, MODE_IDS, type ChatMode } from "@/lib/mode-registry";
import { PanelBuilder } from "@/components/roundtable/PanelBuilder";
import { BoardroomThread } from "@/components/roundtable/BoardroomThread";

// Kickoff status shown BEFORE the agent has decided whether it's going to
// ask a clarifying question or start producing the deliverable. We used to
// say "Composing document…" / "Designing workflow…" here, which misled the
// user when the agent's first act was actually to ask a question back.
// Keep this label generic and let onThinking (server-driven phase labels)
// and onChunk (classifier below) refine it once the intent is known.
const getStatusForMode = (mode: string): string => {
  const statusMessages: Record<string, string> = {
    'standard': 'Thinking…',
    'deep-research': 'Reading your request…',
    'checklist': 'Thinking…',
    'workflow': 'Thinking…',
    'audit-plan': 'Thinking…',
    'calculation': 'Thinking…',
    'scenario-simulator': 'Thinking…',
    'deliverable-composer': 'Thinking…',
    'forensic-intelligence': 'Thinking…',
    'roundtable': 'Coordinating experts…',
  };
  return statusMessages[mode] || 'Thinking…';
};

interface MessageMetadata {
  showInOutputPane?: boolean;
  reasoningContent?: string;
  thinkingSteps?: Array<{ phase: string; detail: string }>;
  visualization?: ChartData;
  deliverableContent?: string;
  spreadsheetData?: Record<string, unknown>;
  hasExcel?: boolean;
  calculationResults?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

interface Conversation {
  id: string;
  title: string;
  metadata?: string | null;
  preview: string | null;
  chatMode?: string | null;
  createdAt: string;
  updatedAt: string;
  profileId: string | null;
  pinned: boolean;
  isShared: boolean;
  sharedToken: string | null;
}

interface Profile {
  id: string;
  name: string;
  type: 'business' | 'personal' | 'family';
  isDefault: boolean;
}

/**
 * Recursive text extraction for ReactMarkdown code-block children.
 * rehype-highlight wraps tokens in <span class="hljs-*">, so children may be
 * a nested array of spans. For diagram blocks (mermaid/mindmap) we need the
 * plain source string regardless of highlighting.
 */
function extractCodeText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractCodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractCodeText((node as any).props?.children);
  }
  return "";
}

/**
 * Stable-reference mindmap code block. Memoises the JSON.parse result keyed
 * by the raw source so every parent re-render doesn't hand MindmapArtifact a
 * fresh payload object — which was causing the ReactFlow layout underneath
 * to re-run (`setNodes`/`setEdges`) on every keystroke in the composer,
 * visually flashing the mindmap.
 */
const MindmapCodeBlock = React.memo(function MindmapCodeBlock({
  raw,
  isStreaming,
}: {
  raw: string;
  isStreaming: boolean;
}) {
  const parseResult = useMemo(() => {
    try {
      return { ok: true as const, payload: JSON.parse(raw) };
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? "parse error" };
    }
  }, [raw]);

  if (parseResult.ok) {
    return (
      <div className="my-4 not-prose">
        <MindmapArtifact payload={parseResult.payload} />
      </div>
    );
  }
  if (isStreaming) {
    return (
      <div className="my-4 not-prose text-xs text-muted-foreground italic flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        Generating mindmap…
      </div>
    );
  }
  return (
    <details className="my-4 not-prose text-xs border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
      <summary className="font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
        Mindmap couldn't be parsed — {parseResult.error}
      </summary>
      <pre className="mt-2 p-2 bg-muted rounded whitespace-pre-wrap break-all">{raw}</pre>
    </details>
  );
});

/**
 * Stable-reference flowchart (mermaid) code block. Same reasoning as
 * MindmapCodeBlock — the FlowchartArtifact ref-compares its `payload.source`
 * prop; without stabilising here, every parent render reinitialises the
 * Mermaid instance and redraws the SVG.
 */
const FlowchartCodeBlock = React.memo(function FlowchartCodeBlock({
  source,
}: {
  source: string;
}) {
  const payload = useMemo(() => ({ source }), [source]);
  return (
    <div className="my-4 not-prose">
      <FlowchartArtifact payload={payload} />
    </div>
  );
});

export default function Chat() {
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(true);
  const [isOutputFullscreen, setIsOutputFullscreen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  // `inputMessage` state was previously here. It has been pushed down into
  // the ChatInputBox component so typing doesn't re-render the whole Chat
  // page (which caused mindmaps/flowcharts to visibly re-layout on each
  // keystroke). The parent now only learns about the text when the user
  // submits, via ChatInputBox's onSend callback.
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>("all");
  const [pendingRoundtableConversationId, setPendingRoundtableConversationId] = useState<string | null>(null);
  /** Server-assigned conversation id from a brand-new chat's first
   *  message. Tracked separately because the sidebar conversations
   *  query is invalidated AFTER `onSuccess` fires — leaving a window
   *  where activeConversation is set but the cached list still doesn't
   *  contain it. The stale-conversation-cleanup effect would otherwise
   *  reset activeConversation during that window and bounce the user
   *  back to the new-chat home page mid-stream. Cleared once the new
   *  conversation actually appears in the list. */
  const [pendingNewConversationId, setPendingNewConversationId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string>("");
  const [renameValue, setRenameValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cagptStatus, setCagptStatus] = useState<string>('');
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ phase: string; detail: string }>>([]);
  // Latches true as soon as the server emits a `clarify` thinking event,
  // signalling that the next assistant turn is a clarification question
  // rather than an answer. The chunk classifier respects this and keeps
  // the status pinned to "Asking a clarifying question…" — prevents a
  // non-matching opener (e.g. "I'd like to confirm a few details…") from
  // flipping the label to "Answering…".
  const isClarifyingRef = useRef(false);
  // Ref to prevent message overwrite immediately after streaming ends (race condition fix)
  const justFinishedStreamingRef = useRef(false);
  // Ref for auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // textareaRef + showToolsRow moved into ChatInputBox (they're input-local).
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const [speakControls, setSpeakControls] = useState<SpeakControls | null>(null);
  const [chatMode, setChatMode] = useState<string>('standard');
  // Roundtable Panel Builder drawer — only used when chatMode === 'roundtable'.
  // Kept local to avoid threading state through the shell.
  const [panelBuilderOpen, setPanelBuilderOpen] = useState(false);
  const [cagptGPTsExpanded, setCagptGPTsExpanded] = useState(true);
  const [gptSectionHeight, setGptSectionHeight] = useState(240);
  const gptDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackConvId, setFeedbackConvId] = useState<string>("");
  const { user, logout, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Feature flag: whiteboard v2 (rich rendering + whiteboard view + PIP).
  const { data: features } = useFeatureFlags();
  const whiteboardEnabled = !!features?.whiteboardV2;
  const [view, setView] = useChatView();
  // Command palette (⌘K) state.
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Composer text state — moved back into the page because the new
  // primitive is controlled. Typing re-renders the page, but the heavy
  // mindmap/flowchart blocks are memoised inside ChatMessageBody so
  // they no longer thrash on each keystroke.
  const [input, setInput] = useState('');
  // Artifacts for PIP chip lookup / rich message rendering when flag is ON.
  const { data: artifactsData } = useConversationArtifacts(activeConversation);

  const chatModes = [
    { id: 'standard', label: 'Standard Chat', icon: MessageSquare, description: 'General accounting advice', gradient: 'from-slate-500 to-slate-600' },
    { id: 'deep-research', label: 'Deep Research', icon: Sparkles, description: 'Comprehensive analysis with sources', gradient: 'from-primary to-secondary' },
    { id: 'checklist', label: 'Create Checklist', icon: ListChecks, description: 'Structured task lists', gradient: 'from-emerald-500 to-green-600' },
    { id: 'workflow', label: 'Workflow Visualization', icon: Network, description: 'Process diagrams & flows', gradient: 'from-rai-500 to-rai-600' },
    { id: 'audit-plan', label: 'Audit Plan', icon: FileBarChart, description: 'Comprehensive audit approach', gradient: 'from-amber-500 to-orange-600' },
    { id: 'calculation', label: 'Financial Calculation', icon: Calculator, description: 'Tax & financial computations', gradient: 'from-rose-500 to-pink-600' },
    { id: 'scenario-simulator', label: 'Scenario Simulator', icon: TrendingUp, description: 'What-if analysis & stress testing', gradient: 'from-primary to-secondary' },
    { id: 'deliverable-composer', label: 'Deliverable Composer', icon: FileEdit, description: 'Professional document generation', gradient: 'from-rai-500 to-rai-600' },
    { id: 'forensic-intelligence', label: 'Forensic Intelligence', icon: SearchIcon, description: 'Fraud detection & pattern analysis', gradient: 'from-red-500 to-rose-600' },
    { id: 'roundtable', label: 'Roundtable', icon: UsersIcon, description: 'Multi-expert collaboration', gradient: 'from-teal-500 to-emerald-600' },
      ];

  // CA GPTs - Centralized hub for all AI capabilities
  const cagptGPTs = [
    { id: 'standard', label: 'CA GPT Assistant', icon: Bot, description: 'General accounting & finance advisor for CAs', color: 'text-primary', route: null },
    { id: 'deep-research', label: 'Deep Research', icon: Sparkles, description: 'Comprehensive analysis with sources', color: 'text-primary', route: null },
    { id: 'checklist', label: 'Checklist Builder', icon: ListChecks, description: 'Structured task lists & workflows', color: 'text-green-500', route: null },
    { id: 'workflow', label: 'Workflow Designer', icon: Network, description: 'Process diagrams & flows', color: 'text-rai-500', route: null },
    { id: 'audit-plan', label: 'Audit Planner', icon: FileBarChart, description: 'Comprehensive audit approach', color: 'text-amber-500', route: null },
    { id: 'calculation', label: 'Financial Calculator', icon: Calculator, description: 'Tax & financial computations', color: 'text-orange-500', route: null },
    { id: 'scenario-simulator', label: 'Scenario Simulator', icon: TrendingUp, description: 'What-if analysis & stress testing', color: 'text-primary', route: null },
    { id: 'deliverable-composer', label: 'Deliverable Composer', icon: FileEdit, description: 'Professional document generation', color: 'text-rai-500', route: null },
    { id: 'forensic-intelligence', label: 'Forensic Intelligence', icon: SearchIcon, description: 'Fraud detection & pattern analysis', color: 'text-red-500', route: null },
    { id: 'roundtable', label: 'Expert Roundtable', icon: UsersIcon, description: 'Multi-expert AI collaboration', color: 'text-green-500', route: null },
      ];

  // Handle GPT selection
  const handleGPTSelect = (gpt: typeof cagptGPTs[0]) => {
    if (gpt.route) {
      setLocation(gpt.route);
    } else {
      setChatMode(gpt.id);
      handleNewChat();
      toast({
        title: `${gpt.label} activated`,
        description: gpt.description
      });
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    const mode = savedTheme || 'system';
    setThemeMode(mode);
    let dark = false;
    if (mode === 'dark') dark = true;
    else if (mode === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    else dark = false;
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);



  const applyTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    localStorage.setItem('theme', mode);
    let dark = false;
    if (mode === 'dark') dark = true;
    else if (mode === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(dark);
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const toggleTheme = () => {
    applyTheme(isDark ? 'light' : 'dark');
  };

  // Clear active conversation when profile filter changes
  useEffect(() => {
    setActiveConversation(undefined);
    setMessages([]);
  }, [selectedProfileFilter]);

  // Only show output pane content for document/visualization/export/calculation responses
  const outputMessages = messages.filter(m => m.role === 'assistant' && m.metadata?.showInOutputPane);

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    // Delay scroll to ensure DOM is updated after messages render
    const scrollTimer = setTimeout(() => {
      if (messagesEndRef.current) {
        // Find the closest scrollable parent (Radix ScrollArea Viewport)
        const scrollContainer = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          // Fallback to scrollIntoView
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [messages, isStreaming]);
  
  // Use deliverable content when available, fallback to regular content
  const outputContent = outputMessages
    .map(m => m.metadata?.deliverableContent || m.content)
    .join('\n\n---\n\n');
  
  // Determine content type from the most recent message
  const latestOutputMessage = outputMessages[outputMessages.length - 1];
  const hasSpreadsheet = latestOutputMessage?.metadata?.spreadsheetData;
  const outputContentType: 'spreadsheet' | 'checklist' | 'workflow' | 'calculation' | 'markdown' =
    hasSpreadsheet ? 'spreadsheet' :
    chatMode === 'checklist' ? 'checklist' :
    chatMode === 'workflow' ? 'workflow' :
    chatMode === 'audit-plan' ? 'calculation' :
    'markdown';
  
  // Check if latest message has Excel file
  const hasExcel = latestOutputMessage?.metadata?.hasExcel || false;
  const outputMessageId = latestOutputMessage?.id;
  const spreadsheetData = latestOutputMessage?.metadata?.spreadsheetData;
  
  // Get the most recent visualization from output messages
  const latestVizMessage = [...outputMessages].reverse().find(m => m.metadata?.visualization);
  const outputVisualization: ChartData | undefined = latestVizMessage?.metadata?.visualization;

  // Auto-expand output pane when there's output content
  useEffect(() => {
    if (outputMessages.length > 0 && rightPaneCollapsed) {
      setRightPaneCollapsed(false);
    }
  }, [outputMessages.length, rightPaneCollapsed]);

  useEffect(() => {
    if (!isLoading && !user) {
      // Store the current path so we can redirect back after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/chat') {
        sessionStorage.setItem('pendingRedirect', currentPath);
      }
      setLocation('/auth');
    }
  }, [user, isLoading, setLocation]);

  const { data: profilesData } = useQuery<{ profiles: Profile[] }>({
    queryKey: ['/api/profiles'],
    enabled: !!user,
  });

  const profiles: Profile[] = profilesData?.profiles || [];
  const defaultProfile = profiles.find(p => p.isDefault);

  const { data: conversationsData, isLoading: conversationsLoading, error: conversationsError } = useQuery({
    queryKey: ['/api/conversations', selectedProfileFilter],
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale
    queryFn: async () => {
      let response;
      if (selectedProfileFilter === 'all') {
        response = await conversationApi.getAll();
      } else if (selectedProfileFilter === 'none') {
        const res = await fetch(`/api/conversations?profileId=null`, {
          credentials: 'include'
        });
        response = await res.json();
      } else {
        const res = await fetch(`/api/conversations?profileId=${selectedProfileFilter}`, {
          credentials: 'include'
        });
        response = await res.json();
      }
      return response;
    },
  });

  const { data: messagesData } = useQuery({
    queryKey: ['/api/conversations', activeConversation, 'messages'],
    enabled: !!activeConversation,
    queryFn: () => conversationApi.getMessages(activeConversation!),
  });

  useEffect(() => {
    if (messagesData?.messages) {
      // DON'T overwrite messages while streaming or immediately after - it will wipe out the streaming content!
      if (isStreaming || justFinishedStreamingRef.current) {
        return;
      }
      
      setMessages(messagesData.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metadata: msg.metadata || (msg.calculationResults ? { calculationResults: msg.calculationResults, showInOutputPane: true } : undefined)
      })));
    }
  }, [messagesData, isStreaming]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, file, selection }: { content: string; file: File | null; selection?: ComposerSelection }) => {
      // Determine which profile to use for new conversations
      let profileIdToUse: string | null | undefined = undefined;
      if (!activeConversation) {
        // Creating a new conversation - use selected filter if it's a specific profile
        if (selectedProfileFilter !== 'all' && selectedProfileFilter !== 'none') {
          profileIdToUse = selectedProfileFilter;
        } else if (selectedProfileFilter === 'none') {
          profileIdToUse = null;
        } else if (defaultProfile) {
          // No filter or "all" selected - use default profile
          profileIdToUse = defaultProfile.id;
        }
      }
      
      // If there's a file attached, upload it first
      let fileData: { base64Data: string; type: string; name: string } | null = null;
      if (file) {
        // Show "Uploading document..." status
        setUploadingFile(true);
        setMessages(prev => [...prev, {
          id: 'uploading-temp',
          role: 'assistant',
          content: 'Uploading document...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadRes = await fetch('/api/chat/upload-file', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });
          
          if (!uploadRes.ok) {
            throw new Error('File upload failed');
          }
          
          const uploadData = await uploadRes.json();
          fileData = uploadData.file;
          
          // Update status to "Analyzing document..."
          setMessages(prev => prev.map(msg => 
            msg.id === 'uploading-temp' 
              ? { ...msg, content: 'Analyzing document and extracting content...' }
              : msg
          ));
        } finally {
          setUploadingFile(false);
        }
      }
      
      // Preserve user's text message and send file data separately
      const messageContent = content.trim() || (fileData ? 'Please analyze this document' : '');
      
      // Add a streaming placeholder message
      const streamingId = 'streaming-' + Date.now();
      setMessages(prev => [...prev.filter(m => m.id !== 'uploading-temp'), {
        id: streamingId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      
      // Capture the conversation id inside this request's closure. Needed
      // because onStart may fire `setActiveConversation(convId)` for a brand-
      // new conversation, and by the time onEnd runs, the React state
      // `activeConversation` is still the stale value in this closure. The
      // ref pattern gives onEnd the actual server-side conversation id so
      // cache invalidations target the right keys.
      let resolvedConvId: string | null = activeConversation ?? null;

      // Use SSE streaming
      const result = await chatApi.streamMessage({
        conversationId: activeConversation,
        query: messageContent,
        profileId: profileIdToUse,
        chatMode: chatMode,
        documentAttachment: fileData ? {
          data: fileData.base64Data,
          type: fileData.type,
          filename: fileData.name
        } : undefined,
        // selection is forwarded when whiteboard v2 is on; api.ts passes
        // only declared fields today, so the server will still receive it
        // once api.ts is extended. Kept on the mutation variables so call
        // sites from Composer / ChatPIP can round-trip the whiteboard
        // context. See routes.ts — `req.body.selection` is already read.
        ...(selection ? { selection } : {}),
      } as Parameters<typeof chatApi.streamMessage>[0], {
        onStart: (convId) => {
          setIsStreaming(true);
          setThinkingSteps([]); // Reset thinking steps
          isClarifyingRef.current = false; // Reset clarify latch per turn
          setCagptStatus(getStatusForMode(chatMode));

          // Prime the whiteboard cache with an empty placeholder BEFORE
          // `setActiveConversation` propagates. Without this, the instant
          // useConversationArtifacts(convId) mounts (triggered by the state
          // flip) it fires a queryFn that hits /api/.../whiteboard — the
          // server returns [] because no artifacts are persisted yet — and
          // that empty result gets cached with staleTime: 30_000. When
          // onEnd later setQueryData's the real artifacts, the subtle
          // observer-vs-fiber-tree timing prevents the already-committed
          // "[artifact … loading…]" render from updating, and the user has
          // to reload / navigate away to remount the subscriber.
          //
          // By pre-seeding the cache, the mount sees cached data and skips
          // the initial fetch entirely — no race. The function-form guards
          // the case where this conversation is actually returning and
          // already has cached artifacts we want to preserve.
          queryClient.setQueryData(
            ['whiteboard', convId],
            (old: any) => old ?? { artifacts: [], byId: {} },
          );

          if (!activeConversation) {
            setActiveConversation(convId);
            // Mark this id as pending so the stale-conversation-cleanup
            // effect doesn't reset it while the sidebar query is still
            // refetching post-onSuccess. Cleared once the conv appears
            // in the conversations list (effect below).
            setPendingNewConversationId(convId);
          }
          // Mirror the server-side conversation id into our closure so
          // onEnd can invalidate caches even before the React state update
          // settles.
          resolvedConvId = convId;
        },
        onThinking: (phase, detail) => {
          // Server-authoritative clarify signal — server's own
          // orchestrator decided this turn is a question, not an answer.
          if (phase === 'clarify') {
            isClarifyingRef.current = true;
            setCagptStatus('Asking a clarifying question…');
          } else {
            setCagptStatus(detail);
          }
          setThinkingSteps(prev => [...prev, { phase, detail }]);
        },
        onChunk: (chunk) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id !== streamingId) return msg;
            const nextContent = msg.content + chunk;

            // Server-authoritative clarify latch (set via onThinking) is
            // the source of truth — if the orchestrator decided this turn
            // is a clarifying question, pin the label and skip all
            // heuristics. Otherwise classify heuristically: visualization
            // → clarifying wording → structured answer → plain answer.
            if (isClarifyingRef.current) {
              setCagptStatus('Asking a clarifying question…');
            } else if (nextContent.includes('```') || nextContent.includes('mermaid')) {
              setCagptStatus('Generating visualization…');
            } else {
              const head = nextContent.slice(0, 300).trim();
              const headLower = head.toLowerCase();
              const looksLikeClarification =
                // Common question/clarification openers.
                /^(could you|can you|would you|what |which |when |where |who |how |do you |to help|to better (help|assist)|before (i|we)|please (clarify|share|confirm|provide)|just to (confirm|clarify)|i(['’])?d (like|need) to (confirm|clarify|check)|i need (a bit|some|one|more|some more|a little more|to) |to (answer|help) accurately)/i.test(head)
                // Any explicit "clarify/clarification/clarifying" word in the
                // first 300 chars — catches "I need one clarification before
                // I summarise it." type openers that the opener list missed.
                || /\bclarif(y|ication|ying)\b/i.test(headLower)
                // A question mark in the first 300 chars, first sentence is
                // short, and no structured-answer markers appear ahead of
                // the `?` (so a rhetorical `?` inside a full answer doesn't
                // mislabel).
                || (() => {
                  const q = head.indexOf('?');
                  if (q < 0) return false;
                  const firstSentence = head.split(/[.\n]/, 1)[0] || '';
                  const preQ = head.slice(0, q);
                  return firstSentence.length < 180 && !/\n(##|###|\*\s|-\s|\d+\.\s)/.test(preQ);
                })();

              if (looksLikeClarification) {
                setCagptStatus('Asking a clarifying question…');
              } else if (/\n(##|###)\s|\n-\s|\n\*\s|\n\d+\.\s/.test(nextContent)) {
                setCagptStatus('Writing your response…');
              } else if (nextContent.length > 40) {
                setCagptStatus('Answering…');
              }
            }

            return { ...msg, content: nextContent };
          }));
        },
        onEnd: (metadata, messageId) => {
          // Set flag BEFORE changing isStreaming to prevent race condition
          justFinishedStreamingRef.current = true;
          setIsStreaming(false);
          setCagptStatus('');
          // Snapshot the live thinking steps onto the completed message so
          // the ThinkingBlock in the reasoning slot can keep rendering them
          // after streaming ends (live state is about to be cleared).
          const stepsSnapshot = thinkingSteps;
          setThinkingSteps([]);
          // Store metadata for visualization - ensure showInOutputPane is preserved
          // CRITICAL: Also update the message ID from streaming-xxx to real server ID for download URLs
          if (metadata) {
            setMessages(prev => {
              const updated = prev.map(msg =>
                msg.id === streamingId
                  ? {
                      ...msg,
                      id: messageId || msg.id, // Use real message ID from server for download URLs
                      metadata: {
                        ...metadata,
                        showInOutputPane: metadata.showInOutputPane || false,
                        thinkingSteps: stepsSnapshot.length > 0 ? stepsSnapshot : metadata.thinkingSteps,
                      }
                    }
                  : msg
              );
              return updated;
            });
          }
          
          // Refetch conversation list immediately to update sidebar
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });

          // After SSE ends, fetch BOTH messages and whiteboard artifacts
          // directly and prime their React Query caches. Invalidation alone
          // is unreliable here:
          //
          //  - Messages query key is an array (['/api/conversations', id,
          //    'messages']); an invalidation with a string key wouldn't
          //    match. Even matching keys get blocked by the
          //    justFinishedStreamingRef guard on the syncing useEffect.
          //
          //  - Whiteboard query has staleTime: 30_000. Invalidation marks
          //    stale and SHOULD refetch if subscribed — but we've seen
          //    artifacts remain in the "[artifact … loading…]" state until
          //    a hard page refresh. Direct fetch + setQueryData is belt-
          //    and-braces: the cache is updated synchronously the moment
          //    the response lands, all subscribers re-render immediately.
          if (resolvedConvId) {
            // 1. Push artifacts straight from the SSE end event into the
            //    React Query cache. The server already had them in memory —
            //    shipping them inline eliminates the refetch-and-race pattern
            //    that was causing "[artifact … loading…]" to stick on
            //    first-generate. No fetch, no ETag/304, no cancel-in-flight
            //    gymnastics.
            const inlineArtifacts = (metadata?.whiteboardArtifacts ?? []) as any[];
            if (inlineArtifacts.length > 0) {
              const byId: Record<string, any> = {};
              for (const a of inlineArtifacts) byId[a.id] = a;
              // Merge with any previously-cached artifacts (this conversation
              // may already have older artifacts from prior turns).
              const prev = queryClient.getQueryData<{ artifacts: any[]; byId: Record<string, any> }>(
                ['whiteboard', resolvedConvId],
              );
              const mergedArtifacts = prev?.artifacts
                ? [...prev.artifacts.filter(a => !byId[a.id]), ...inlineArtifacts]
                : inlineArtifacts;
              const mergedById = { ...(prev?.byId ?? {}), ...byId };
              queryClient.setQueryData(
                ['whiteboard', resolvedConvId],
                { artifacts: mergedArtifacts, byId: mergedById },
              );
            }

            // 2. Update the message content locally with the server-processed
            //    version (which has <artifact> placeholders and inlined
            //    formula results). Prefer whiteboardUpdatedContent from the
            //    end event if available — skips a round-trip.
            const serverContent = (metadata?.whiteboardUpdatedContent as string | null) ?? null;
            if (serverContent && messageId) {
              setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, content: serverContent } : msg
              ));
            } else if (messageId) {
              // Fallback: fetch messages list to pick up DB-stored content.
              // This path runs only if the server didn't inline
              // whiteboardUpdatedContent (legacy / non-artifact turns).
              (async () => {
                try {
                  const fresh = await conversationApi.getMessages(resolvedConvId);
                  const freshMsg = fresh.messages.find((m: any) => m.id === messageId);
                  if (freshMsg) {
                    setMessages(prev => prev.map(msg =>
                      msg.id === messageId ? { ...msg, content: freshMsg.content } : msg
                    ));
                  }
                  queryClient.setQueryData(
                    ['/api/conversations', resolvedConvId, 'messages'],
                    fresh,
                  );
                } catch (err) {
                  console.warn('[Chat] fallback messages refetch failed', err);
                }
              })();
            }
          }

          // Clear the flag after 2 seconds to allow future message loads
          setTimeout(() => {
            justFinishedStreamingRef.current = false;
          }, 2000);
        },
        onError: (error: string) => {
          console.error('[Chat] Streaming error:', error);
          setIsStreaming(false);
          setCagptStatus('');
          setThinkingSteps([]); // Clear thinking steps on error
          // Don't throw here - let the mutation handle the error via rejection
        }
      });
      
      return result;
    },
    onSuccess: () => {
      // Clear selected file after successful send
      setSelectedFile(null);
      setIsStreaming(false);
      setCagptStatus('');
      
      // Invalidate ALL conversation queries to refresh sidebar (includes profile filter variants)
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: Error) => {
      // Remove temporary messages on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('uploading-') && !msg.id.startsWith('streaming-')));
      setIsStreaming(false);
      setCagptStatus('');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send message"
      });
    }
  });

  const lastAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .slice(-1)[0]?.content;

  const handleSendMessage = (inputText: string = '') => {
    if (!user) return;
    const trimmed = inputText.trim();
    if (!trimmed && !selectedFile) return;

    // Build message content - include both text and filename if both are present
    const messageContent = trimmed
      ? (selectedFile ? `${inputText} [Attached: ${selectedFile.name}]` : inputText)
      : (selectedFile ? `[Attached: ${selectedFile.name}]` : '');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    // CRITICAL: Pass file to mutation as parameter, not from state
    // State will be cleared immediately, but mutation needs the file
    const fileToSend = selectedFile;
    sendMessageMutation.mutate({ content: messageContent, file: fileToSend });
    // Clear file; textarea state is cleared inside ChatInputBox itself.
    setSelectedFile(null);
  };

  // Unified send used by the whiteboard v2 Composer / ChatPIP.
  // Mirrors handleSendMessage but takes text + optional selection directly.
  const handleSend = (text: string, selection?: ComposerSelection) => {
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;

    const fileToSend = selectedFile;
    const messageContent = trimmed
      ? (fileToSend ? `${trimmed} [Attached: ${fileToSend.name}]` : trimmed)
      : (fileToSend ? `[Attached: ${fileToSend.name}]` : '');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate({ content: messageContent, file: fileToSend, selection });
    setSelectedFile(null);
  };

  // Hidden file input ref for composer attach.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileInputRef.current?.click();

  const handleNewChat = () => {
    setActiveConversation(undefined);
    setMessages([]);
    setSelectedFile(null);
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Mirror the server's allowed MIME types (see routes.ts /api/chat/upload-file)
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/tiff',
        'image/tif',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain',
      ];
      // Fallback: some browsers report empty MIME for .csv — trust the extension
      const extOk = /\.(pdf|jpe?g|png|tiff?|xlsx?|csv|txt)$/i.test(file.name);

      if (!allowedTypes.includes(file.type) && !extOk) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Supported formats: PDF, PNG, JPEG, TIFF, Excel (XLSX/XLS), CSV, TXT"
        });
        return;
      }
      
      // Validate file size (10MB limit for chat)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Maximum file size is 10MB."
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  // Conversation management mutations
  const pinMutation = useMutation({
    mutationFn: async (convId: string) => {
      const res = await fetch(`/api/conversations/${convId}/pin`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to pin conversation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "Conversation updated" });
    }
  });

  const renameMutation = useMutation({
    mutationFn: async ({ convId, title }: { convId: string, title: string }) => {
      const res = await fetch(`/api/conversations/${convId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error('Failed to rename conversation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setRenameDialogOpen(false);
      toast({ title: "Conversation renamed" });
    }
  });

  const shareMutation = useMutation({
    mutationFn: async (convId: string) => {
      const res = await fetch(`/api/conversations/${convId}/share`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to share conversation');
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Try to copy to clipboard with error handling
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        toast({ title: "Share link copied to clipboard!" });
      } catch {
        // Fallback if clipboard access denied
        toast({ 
          title: "Share link created",
          description: "Copy this link: " + data.shareUrl
        });
      }
    }
  });

  const unshareMutation = useMutation({
    mutationFn: async (convId: string) => {
      const res = await fetch(`/api/conversations/${convId}/share`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to unshare conversation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "Conversation unshared" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (convId: string) => {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete conversation');
      return { convId };
    },
    onSuccess: ({ convId }) => {
      // Clear active conversation if we're deleting the currently active one
      if (activeConversation === convId) {
        setActiveConversation(undefined);
        setMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "Conversation deleted" });
    }
  });

  const handleRename = (convId: string, currentTitle: string) => {
    setRenameConvId(convId);
    setRenameValue(currentTitle);
    setRenameDialogOpen(true);
  };

  const handleFeedback = (convId: string) => {
    setFeedbackConvId(convId);
    setFeedbackDialogOpen(true);
  };

  const confirmRename = () => {
    if (renameValue.trim()) {
      renameMutation.mutate({ convId: renameConvId, title: renameValue.trim() });
    }
  };

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if no user (handled by useEffect, show loading while redirecting)
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const conversations: Conversation[] = conversationsData?.conversations || [];
  
  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group conversations by time period like ChatGPT
  const groupConversationsByTime = (convs: typeof filteredConversations) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Separate pinned and unpinned conversations
    const pinned = convs.filter(c => c.pinned).sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
    const unpinned = convs.filter(c => !c.pinned);

    const groups: { label: string; conversations: typeof convs }[] = [];

    // Add pinned group first if there are any pinned conversations
    if (pinned.length > 0) {
      groups.push({ label: 'Pinned', conversations: pinned });
    }

    // Create time-based groups for unpinned conversations
    const timeGroups: { label: string; conversations: typeof convs }[] = [
      { label: 'Today', conversations: [] },
      { label: 'Yesterday', conversations: [] },
      { label: 'Previous 7 Days', conversations: [] },
      { label: 'Previous 30 Days', conversations: [] },
      { label: 'Older', conversations: [] },
    ];

    unpinned.forEach(conv => {
      const convDate = new Date(conv.updatedAt || conv.createdAt);
      if (convDate >= today) {
        timeGroups[0].conversations.push(conv);
      } else if (convDate >= yesterday) {
        timeGroups[1].conversations.push(conv);
      } else if (convDate >= last7Days) {
        timeGroups[2].conversations.push(conv);
      } else if (convDate >= last30Days) {
        timeGroups[3].conversations.push(conv);
      } else {
        timeGroups[4].conversations.push(conv);
      }
    });

    // Add non-empty time groups
    timeGroups.forEach(group => {
      if (group.conversations.length > 0) {
        groups.push(group);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversationsByTime(filteredConversations);
  // Sidebar grouping is kept for now but not rendered in the new shell; the
  // new ModeSidebar will take ownership of grouping in a later task. The
  // computation is cheap and has no side effects, so we leave it to avoid
  // dead-code churn in this diff.
  void groupedConversations;

  // Map the legacy `chatMode` string into the new ChatMode union. Modes
  // that exist only in the legacy list (e.g. `scenario-simulator`) fall
  // back to `standard` for shell/primitive wiring. The actual send path
  // still uses the legacy `chatMode` string verbatim, so backend behavior
  // is unchanged.
  const currentMode: ChatMode = (MODE_IDS as readonly string[]).includes(chatMode)
    ? (chatMode as ChatMode)
    : 'standard';

  // Build sidebar conversation list for AppShell/ModeSidebar in the
  // `{ id, title, mode }` shape it expects. Mode is unknown for most
  // persisted conversations today — default to 'standard'.
  const sidebarConversations = filteredConversations.map((c) => {
    const m = c.chatMode ?? 'standard';
    const mode: ChatMode = (MODE_IDS as readonly string[]).includes(m)
      ? (m as ChatMode)
      : 'standard';
    return {
      id: c.id,
      title: c.title,
      mode,
      pinned: c.pinned,
      shared: c.isShared,
    };
  });

  const activeConversationTitle =
    conversations.find((c) => c.id === activeConversation)?.title ?? 'New conversation';

  useEffect(() => {
    if (!pendingRoundtableConversationId) return;
    const exists = conversations.some((c) => c.id === pendingRoundtableConversationId);
    if (exists) {
      setPendingRoundtableConversationId(null);
    }
  }, [conversations, pendingRoundtableConversationId]);

  // Symmetric clear for normal-chat pending conversations.
  useEffect(() => {
    if (!pendingNewConversationId) return;
    const exists = conversations.some((c) => c.id === pendingNewConversationId);
    if (exists) {
      setPendingNewConversationId(null);
    }
  }, [conversations, pendingNewConversationId]);

  useEffect(() => {
    if (conversationsLoading) return;
    if (!activeConversation) return;
    if (pendingRoundtableConversationId === activeConversation) return;
    // Bail while a send is in flight (covers the streaming window).
    if (isStreaming) return;
    // Bail while a brand-new conversation hasn't yet appeared in the
    // sidebar query. onSuccess invalidates the conversations list AFTER
    // setIsStreaming(false), leaving a window where activeConversation
    // is set but the cached list is still the pre-creation snapshot.
    // Without this guard, the user gets bounced to home in that gap.
    // Cleared by the effect above once the conv shows up in the list.
    if (pendingNewConversationId === activeConversation) return;

    const stillExists = conversations.some((c) => c.id === activeConversation);
    if (stillExists) return;

    setActiveConversation(undefined);
    setMessages([]);
    queryClient.removeQueries({ queryKey: ['/api/conversations', activeConversation, 'messages'] });
    queryClient.removeQueries({ queryKey: ['whiteboard', activeConversation] });
  }, [activeConversation, conversations, conversationsLoading, pendingRoundtableConversationId, pendingNewConversationId, isStreaming, queryClient]);

  // Map the legacy useChatView state (`'chat' | 'board'`) to the new
  // primitive's expected shape (`'chat' | 'whiteboard'`).
  const breadcrumbView: 'chat' | 'whiteboard' = view === 'board' ? 'whiteboard' : 'chat';
  const setBreadcrumbView = (v: 'chat' | 'whiteboard') =>
    setView(v === 'whiteboard' ? 'board' : 'chat');

  const handleSelectMode = (mode: ChatMode) => {
    // Mode is a per-conversation property (persisted at creation and used to
    // group the sidebar + pick the right prompt). Switching modes mid-chat
    // would silently re-route subsequent messages to a different system
    // prompt while the conversation stays in its original sidebar bucket —
    // confusing, and it would also drift from the mode the AI was told it
    // was operating in. Instead, picking a mode always starts a fresh chat
    // so the conversation is cleanly scoped to one mode end-to-end.
    //
    // If the user already has an empty unsent chat (no messages) just
    // update the mode on that same draft — no need to churn a new
    // conversation-id slot for nothing.
    setChatMode(mode);
    if (messages.length > 0 || activeConversation) {
      setActiveConversation(undefined);
      setMessages([]);
      setSelectedFile(null);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    // Restore the conversation's original mode so the composer, prompt, and
    // sidebar highlight stay in sync with what this chat was created in.
    const conv = conversations.find((c) => c.id === id);
    if (conv?.chatMode && conv.chatMode !== chatMode) {
      setChatMode(conv.chatMode);
    }
  };

  const handleStop = () => {
    // Streaming cancel is not surfaced through chatApi today. Clear the
    // local streaming flag so the UI stops showing the pulse; the in-
    // flight SSE will complete on its own.
    setIsStreaming(false);
    setCagptStatus('');
  };

  const userLabel = user?.name || user?.email || 'User';
  const userPlan = user?.subscriptionTier || 'Free';
  const userInitial =
    user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="h-screen">
      <AppShell
        conversations={sidebarConversations}
        activeMode={currentMode}
        activeConversationId={activeConversation}
        userLabel={userLabel}
        userPlan={userPlan}
        userInitial={userInitial}
        themeMode={themeMode}
        onChangeTheme={applyTheme}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onSelectMode={handleSelectMode}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={(id) => {
          const conv = conversations.find((c) => c.id === id);
          handleRename(id, conv?.title ?? '');
        }}
        onPinConversation={(id) => pinMutation.mutate(id)}
        onShareConversation={(id) => {
          // For an already-shared conversation, we still POST: the server
          // endpoint returns the existing token rather than minting a new
          // one, so the menu item doubles as "Copy share link".
          shareMutation.mutate(id);
        }}
        onUnshareConversation={(id) => {
          if (window.confirm('Revoke the share link for this conversation? Anyone with the old link will lose access.')) {
            unshareMutation.mutate(id);
          }
        }}
        onDeleteConversation={(id) => {
          if (window.confirm('Delete this conversation? This cannot be undone.')) {
            deleteMutation.mutate(id);
          }
        }}
        onNewChat={handleNewChat}
        onOpenSettings={() => setLocation('/settings')}
        onOpenSearch={() => setCommandOpen(true)}
        onSignOut={handleLogout}
      >
        <ChatBreadcrumb
          mode={currentMode}
          title={activeConversationTitle}
          view={breadcrumbView}
          onViewChange={setBreadcrumbView}
          rightSlot={
            chatMode === 'roundtable' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPanelBuilderOpen(true)}
                data-testid="open-panel-builder"
              >
                <UsersIcon className="w-3.5 h-3.5 mr-1" /> Configure panel
              </Button>
            ) : chatMode === 'deep-research' && messages.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setChatMode('roundtable');
                  setPanelBuilderOpen(true);
                }}
                data-testid="promote-to-roundtable"
                title="Switch to roundtable mode and start building a panel using the same conversation context."
              >
                <UsersIcon className="w-3.5 h-3.5 mr-1" /> Promote to Roundtable
              </Button>
            ) : undefined
          }
        />
        {breadcrumbView === 'chat' ? (
          chatMode === 'roundtable' ? (
            <div className="flex-1 min-h-0">
              <BoardroomThread
                conversationId={activeConversation ?? null}
                onConfigurePanel={() => setPanelBuilderOpen(true)}
              />
            </div>
          ) : (
          <>
            <MessageColumn>
              {messages.length === 0 ? (
                <EmptyModeState
                  mode={currentMode}
                  onPickStarter={(p) => setInput(p)}
                />
              ) : (
                messages.map((message) =>
                  message.role === 'user' ? (
                    <UserTurn key={message.id} timestamp={message.timestamp}>
                      {message.content}
                    </UserTurn>
                  ) : (
                    <AssistantTurn
                      key={message.id}
                      modeName={getMode(currentMode)?.label.toLowerCase()}
                      timestamp={message.timestamp}
                      streaming={
                        isStreaming && message.id.startsWith('streaming-')
                      }
                      onStop={handleStop}
                      reasoning={(() => {
                        const isStreamingThis =
                          isStreaming && message.id.startsWith('streaming-');
                        // Prefer live steps for the active stream, then the
                        // snapshot we persist onEnd, and finally fall back to
                        // splitting the reasoningContent prose on newlines so
                        // historical messages still get a structured view.
                        const liveSteps = isStreamingThis ? thinkingSteps : [];
                        const persistedSteps = message.metadata?.thinkingSteps ?? [];
                        const fallbackSteps =
                          persistedSteps.length === 0 && message.metadata?.reasoningContent
                            ? message.metadata.reasoningContent
                                .split(/\n+/)
                                .map((line) => line.trim())
                                .filter(Boolean)
                                .map((detail) => ({ phase: 'reasoning', detail }))
                            : [];
                        const steps = isStreamingThis
                          ? liveSteps
                          : persistedSteps.length > 0
                            ? persistedSteps
                            : fallbackSteps;
                        if (steps.length === 0 && !isStreamingThis) return undefined;
                        return (
                          <ThinkingBlock
                            steps={steps}
                            isActive={isStreamingThis}
                            currentStatus={isStreamingThis ? cagptStatus || undefined : undefined}
                          />
                        );
                      })()}
                      feedback={
                        !message.id.startsWith('streaming-') &&
                        !message.id.startsWith('uploading-') &&
                        activeConversation ? (
                          <MessageFeedback
                            messageId={message.id}
                            conversationId={activeConversation}
                          />
                        ) : undefined
                      }
                    >
                      {message.content ? (
                        <ChatMessageBody
                          content={message.content}
                          artifactsById={artifactsData?.byId}
                          conversationId={activeConversation}
                          isStreaming={isStreaming}
                          onOpenInWhiteboard={() => setBreadcrumbView('whiteboard')}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          {cagptStatus || 'Thinking…'}
                        </span>
                      )}
                    </AssistantTurn>
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </MessageColumn>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
              <div className="pointer-events-auto w-[calc(100%-40px)] max-w-[720px]">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={() => {
                    const text = input;
                    setInput('');
                    handleSend(text);
                  }}
                  onAttach={openFilePicker}
                  attachedFile={selectedFile ? { name: selectedFile.name, size: selectedFile.size } : null}
                  onRemoveAttachment={handleRemoveFile}
                  voiceSlot={
                    <VoiceModeEnhanced
                      onTranscription={(text) =>
                        setInput((prev) => (prev ? `${prev} ${text}` : text))
                      }
                      onSendMessage={() => {
                        const text = input;
                        setInput('');
                        handleSend(text);
                      }}
                      onSpeakReady={setSpeakControls}
                      lastAssistantMessage={lastAssistantMessage}
                      conversationId={activeConversation}
                      inputMessage={input}
                    />
                  }
                  placeholder={`Ask CA-GPT anything in ${
                    getMode(currentMode)?.label ?? 'Standard'
                  } mode…`}
                  disabled={isStreaming || sendMessageMutation.isPending}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.xlsx,.xls,.csv,.txt"
                  onChange={(e) => {
                    handleFileSelect(e);
                    // Reset input so picking the same file twice re-fires onChange.
                    if (e.target) e.target.value = '';
                  }}
                />
              </div>
            </div>
          </>
          )
        ) : (
          <div className="flex-1 min-h-0">
            {activeConversation ? (
              <>
                <Whiteboard conversationId={activeConversation} />
                {whiteboardEnabled && (
                  <ChatPIP
                    messages={messages}
                    byId={artifactsData?.byId ?? {}}
                    onSend={handleSend}
                    isStreaming={isStreaming}
                    conversationId={activeConversation}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Start a conversation to populate your output.
              </div>
            )}
          </div>
        )}

        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          recentConversations={sidebarConversations}
          currentView={breadcrumbView}
          onSelectMode={handleSelectMode}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onToggleTheme={toggleTheme}
          onToggleView={() =>
            setBreadcrumbView(breadcrumbView === 'chat' ? 'whiteboard' : 'chat')
          }
          onSignOut={handleLogout}
        />
      </AppShell>

      {/* Roundtable Panel Builder — drawer that mounts only when needed.
          Sheet renders via portal, so position in the JSX tree is stable. */}
      <PanelBuilder
        open={panelBuilderOpen}
        onOpenChange={setPanelBuilderOpen}
        conversationId={activeConversation ?? null}
        onConversationCreated={(id) => {
          setPendingRoundtableConversationId(id);
          setActiveConversation(id);
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }}
      />

      {/* Rename Dialog — preserved from legacy layout */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent data-testid="dialog-rename-conversation">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmRename();
              }
            }}
            placeholder="Conversation title"
            data-testid="input-rename-title"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!renameValue.trim()}
              data-testid="button-confirm-rename"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversation Feedback Dialog — preserved from legacy layout */}
      <ConversationFeedback
        conversation={
          conversationsData?.conversations.find(
            (c: Conversation) => c.id === feedbackConvId
          ) || null
        }
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />
    </div>
  );
}

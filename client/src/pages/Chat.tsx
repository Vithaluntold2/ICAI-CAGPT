import { useState, useEffect, useRef } from "react";
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

import ReasoningFeedback from "@/components/ReasoningFeedback";
import ChatOverlay from "@/components/ChatOverlay";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { rehypeArtifactPlaceholder } from "@/components/chat/rehypeArtifactPlaceholder";
import { normalizeMath } from "@/lib/mathNormalizer";
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
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import type { ComposerSelection } from "@/components/chat/Composer";

// Helper function to get appropriate status message based on chat mode
const getStatusForMode = (mode: string): string => {
  const statusMessages: Record<string, string> = {
    'standard': 'Thinking...',
    'deep-research': 'Researching sources...',
    'checklist': 'Creating checklist...',
    'workflow': 'Designing workflow...',
    'audit-plan': 'Planning audit approach...',
    'calculation': 'Calculating...',
    'scenario-simulator': 'Simulating scenarios...',
    'deliverable-composer': 'Composing document...',
    'forensic-intelligence': 'Analyzing patterns...',
    'roundtable': 'Coordinating experts...',
  };
  return statusMessages[mode] || 'Processing...';
};

interface MessageMetadata {
  showInOutputPane?: boolean;
  reasoningContent?: string;
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

export default function Chat() {
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(true);
  const [isOutputFullscreen, setIsOutputFullscreen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>("all");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string>("");
  const [renameValue, setRenameValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cagptStatus, setCagptStatus] = useState<string>('');
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ phase: string; detail: string }>>([]);
  // Ref to prevent message overwrite immediately after streaming ends (race condition fix)
  const justFinishedStreamingRef = useRef(false);
  // Ref for auto-scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref for textarea auto-height reset
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const [showToolsRow, setShowToolsRow] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const [speakControls, setSpeakControls] = useState<SpeakControls | null>(null);
  const [chatMode, setChatMode] = useState<string>('standard');
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
          setCagptStatus(getStatusForMode(chatMode));
          if (!activeConversation) {
            setActiveConversation(convId);
          }
        },
        onThinking: (phase, detail) => {
          setCagptStatus(detail);
          setThinkingSteps(prev => [...prev, { phase, detail }]);
        },
        onChunk: (chunk) => {
          // Update status based on content being streamed
          if (chunk.includes('```') || chunk.includes('mermaid')) {
            setCagptStatus('Generating visualization...');
          } else if (chunk.includes('##') || chunk.includes('###')) {
            setCagptStatus('Structuring response...');
          }
          
          setMessages(prev => prev.map(msg => 
            msg.id === streamingId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        },
        onEnd: (metadata, messageId) => {
          // Set flag BEFORE changing isStreaming to prevent race condition
          justFinishedStreamingRef.current = true;
          setIsStreaming(false);
          setCagptStatus('');
          setThinkingSteps([]); // Clear thinking steps
          // Store metadata for visualization - ensure showInOutputPane is preserved
          // CRITICAL: Also update the message ID from streaming-xxx to real server ID for download URLs
          if (metadata) {
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === streamingId 
                  ? { 
                      ...msg, 
                      id: messageId || msg.id, // Use real message ID from server for download URLs
                      metadata: { ...metadata, showInOutputPane: metadata.showInOutputPane || false } 
                    }
                  : msg
              );
              return updated;
            });
          }
          
          // Refetch conversation list immediately to update sidebar
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          
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

  const handleSendMessage = () => {
    if (!user) return;
    if (!inputMessage.trim() && !selectedFile) return;
    
    // Build message content - include both text and filename if both are present
    const messageContent = inputMessage.trim() 
      ? (selectedFile ? `${inputMessage} [Attached: ${selectedFile.name}]` : inputMessage)
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
    // Clear UI state immediately
    setInputMessage("");
    setSelectedFile(null);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Unified send used by the whiteboard v2 Composer / ChatPIP.
  // Mirrors handleSendMessage but takes text + optional selection directly.
  const handleSend = (text: string, selection?: ComposerSelection) => {
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate({ content: trimmed, file: null, selection });
  };

  const handleNewChat = () => {
    setActiveConversation(undefined);
    setMessages([]);
    setSelectedFile(null);
  };

  const handleLogout = () => {
    logout();
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={cagptLogoUrl} alt="CA GPT" className="h-8 w-auto" data-testid="img-logo" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CA GPT
            </h1>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground">Accounting Superintelligence</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Whiteboard v2: chat/board view switcher (flag-gated) */}
          {whiteboardEnabled && (
            <ChatViewSwitcher value={view} onChange={setView} />
          )}

          {/* Chat mode indicator in header */}
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {chatModes.find(m => m.id === chatMode)?.label || 'Standard Chat'}
          </span>

          {/* Theme mode switcher: Light / Dark / System */}
          <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5">
            <button
              onClick={() => applyTheme('light')}
              className={`p-1.5 rounded-full transition-colors ${
                themeMode === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Light mode"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              onClick={() => applyTheme('dark')}
              className={`p-1.5 rounded-full transition-colors ${
                themeMode === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dark mode"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              onClick={() => applyTheme('system')}
              className={`p-1.5 rounded-full transition-colors ${
                themeMode === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="System mode"
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode ribbon hidden for spacious layout — mode selector in input bar + menu */}

      {/* 3-Pane Resizable Layout — sidebar always renders; middle+right pane content depends on whiteboardEnabled */}
      <ResizablePanelGroup key={`layout-${rightPaneCollapsed}-${leftPaneCollapsed}-${whiteboardEnabled ? 'wb' : 'legacy'}`} direction="horizontal" className="flex-1">
        {/* Left Pane: Sessions - Always render, control visibility with collapsedSize */}
        <ResizablePanel 
          defaultSize={leftPaneCollapsed ? 4 : 14} 
          minSize={leftPaneCollapsed ? 4 : 12} 
          maxSize={leftPaneCollapsed ? 4 : 25}
          collapsible={true}
          collapsedSize={4}
        >
          {!leftPaneCollapsed ? (
            /* ====== EXPANDED SIDEBAR ====== */
            <div className="flex flex-col h-full bg-muted/30 border-r">
              {/* Top: Sidebar Toggle + New Chat */}
              <div className="flex items-center gap-2 px-3 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setLeftPaneCollapsed(true)}
                  title="Close sidebar"
                  data-testid="button-collapse-left"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleNewChat}
                  title="New chat"
                  data-testid="button-new-chat"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              {/* Search */}
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search chats..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm bg-background/50"
                    data-testid="input-search-conversations"
                  />
                </div>
              </div>

              {/* CA GPTs Section - Collapsible */}
              <div className="px-2 pb-1">
                <button
                  onClick={() => setCagptGPTsExpanded(!cagptGPTsExpanded)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-md"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${cagptGPTsExpanded ? 'rotate-90' : ''}`} />
                  CA GPTs
                </button>
                {cagptGPTsExpanded && (
                  <div className="space-y-0.5 mt-1 overflow-y-auto" style={{ maxHeight: gptSectionHeight }}>
                    {cagptGPTs.map((gpt) => {
                      const Icon = gpt.icon;
                      return (
                        <button
                          key={gpt.id}
                          onClick={() => handleGPTSelect(gpt)}
                          className={`flex items-center gap-2.5 w-full px-2 py-1.5 text-sm rounded-lg transition-colors ${
                            chatMode === gpt.id
                              ? 'bg-primary/10 text-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                          title={gpt.description}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${gpt.color}`} />
                          <span className="truncate">{gpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Draggable resize handle between GPTs and conversations */}
              <div
                className="mx-2 flex items-center justify-center cursor-row-resize group select-none"
                style={{ height: 12 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  gptDragRef.current = { startY: e.clientY, startHeight: gptSectionHeight };
                  const onMouseMove = (ev: MouseEvent) => {
                    if (!gptDragRef.current) return;
                    const delta = ev.clientY - gptDragRef.current.startY;
                    const newHeight = Math.max(80, Math.min(500, gptDragRef.current.startHeight + delta));
                    setGptSectionHeight(newHeight);
                  };
                  const onMouseUp = () => {
                    gptDragRef.current = null;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  gptDragRef.current = { startY: touch.clientY, startHeight: gptSectionHeight };
                  const onTouchMove = (ev: TouchEvent) => {
                    if (!gptDragRef.current) return;
                    const delta = ev.touches[0].clientY - gptDragRef.current.startY;
                    const newHeight = Math.max(80, Math.min(500, gptDragRef.current.startHeight + delta));
                    setGptSectionHeight(newHeight);
                  };
                  const onTouchEnd = () => {
                    gptDragRef.current = null;
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                  };
                  document.addEventListener('touchmove', onTouchMove);
                  document.addEventListener('touchend', onTouchEnd);
                }}
              >
                <div className="w-8 h-1 rounded-full bg-border group-hover:bg-muted-foreground/40 transition-colors" />
              </div>

              {/* Conversation History */}
              <ScrollArea className="flex-1">
                <div className="px-2 py-2">
                  {conversationsLoading ? (
                    <ConversationListSkeleton count={8} />
                  ) : conversationsError ? (
                    <div className="text-center py-8 text-red-500 text-sm">
                      Failed to load conversations
                    </div>
                  ) : groupedConversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {searchTerm ? 'No conversations found' : 'No conversations yet'}
                    </div>
                  ) : (
                    groupedConversations.map((group) => (
                      <div key={group.label} className="mb-3">
                        <h4 className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          {group.label}
                        </h4>
                        <div className="space-y-0.5">
                          {group.conversations.map((conv) => (
                            <div
                              key={conv.id}
                              className={`group flex items-center rounded-lg transition-colors ${
                                activeConversation === conv.id
                                  ? 'bg-primary/10'
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <button
                                onClick={() => setActiveConversation(conv.id)}
                                className="flex-1 text-left px-2 py-2 transition-colors overflow-hidden min-w-0"
                                data-testid={`conversation-${conv.id}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {conv.pinned && <Pin className="h-3 w-3 flex-shrink-0 text-primary" />}
                                  <span className="text-sm truncate">{conv.title}</span>
                                </div>
                              </button>
                              
                              {/* Inline menu button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity mr-1"
                                    data-testid={`button-conversation-menu-${conv.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => pinMutation.mutate(conv.id)}
                                    data-testid={`menu-item-pin-${conv.id}`}
                                  >
                                    {conv.pinned ? (
                                      <><PinOff className="mr-2 h-4 w-4" /> Unpin</>
                                    ) : (
                                      <><Pin className="mr-2 h-4 w-4" /> Pin</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleRename(conv.id, conv.title)}
                                    data-testid={`menu-item-rename-${conv.id}`}
                                  >
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleFeedback(conv.id)}
                                    data-testid={`menu-item-feedback-${conv.id}`}
                                  >
                                    <Star className="mr-2 h-4 w-4" />
                                    Rate Conversation
                                  </DropdownMenuItem>
                                  {conv.isShared ? (
                                    <DropdownMenuItem 
                                      onClick={() => unshareMutation.mutate(conv.id)}
                                      data-testid={`menu-item-unshare-${conv.id}`}
                                    >
                                      <Share2 className="mr-2 h-4 w-4" />
                                      Unshare
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => shareMutation.mutate(conv.id)}
                                      data-testid={`menu-item-share-${conv.id}`}
                                    >
                                      <Share2 className="mr-2 h-4 w-4" />
                                      Share
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => deleteMutation.mutate(conv.id)}
                                    className="text-destructive"
                                    data-testid={`menu-item-delete-${conv.id}`}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* User Profile Row at Bottom */}
              <div className="border-t px-2 py-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.subscriptionTier || 'Free'}</p>
                      </div>
                      <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="w-56">
                    <DropdownMenuItem onClick={() => setLocation('/settings')} data-testid="menu-item-settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation('/integrations')} data-testid="menu-item-integrations">
                      <Building2 className="mr-2 h-4 w-4" />
                      Integrations
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                      {isDark ? 'Light mode' : 'Dark mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            /* ====== COLLAPSED SIDEBAR - Icon Rail ====== */
            <div className="w-full h-full flex flex-col items-center border-r bg-muted/30 py-3">
              {/* Top Icons */}
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setLeftPaneCollapsed(false)}
                  title="Open sidebar"
                  data-testid="button-expand-left"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleNewChat}
                  title="New chat"
                  data-testid="button-new-chat-collapsed"
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => { setLeftPaneCollapsed(false); setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="input-search-conversations"]')?.focus(), 100); }}
                  title="Search chats"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Bottom: User Avatar */}
              <div className="flex flex-col items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-semibold hover:ring-2 hover:ring-primary/30 transition-all"
                      title={user?.name || user?.email || 'User'}
                    >
                      {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="right" className="w-56">
                    <div className="px-3 py-2 border-b">
                      <p className="text-sm font-medium">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuItem onClick={() => setLocation('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation('/integrations')}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Integrations
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                      {isDark ? 'Light mode' : 'Dark mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Middle Pane: Chat — board view swaps to Whiteboard+PIP; chat view keeps the familiar layout */}
        <ResizablePanel defaultSize={whiteboardEnabled ? 86 : (rightPaneCollapsed ? 80 : 50)} minSize={30}>
          {whiteboardEnabled && view === "board" ? (
            <div className="relative h-full overflow-hidden">
              {activeConversation ? (
                <Whiteboard conversationId={activeConversation} />
              ) : (
                <div
                  className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center"
                  data-testid="whiteboard-no-conversation"
                >
                  <p className="text-sm">Start a conversation to populate your whiteboard.</p>
                </div>
              )}
              <ChatPIP
                messages={messages.map(m => ({ id: m.id, role: m.role, content: m.content }))}
                byId={artifactsData?.byId ?? {}}
                onSend={(text, selection) => handleSend(text, selection)}
              />
            </div>
          ) : (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-2xl font-medium text-foreground/80">What are you working on?</h2>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={cagptLogoUrl} alt="CA GPT" />
                            <AvatarFallback>L</AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : ''
                          }`}
                        >
                        {message.role === 'assistant' ? (
                          <div className="space-y-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {/* Show loading indicator for streaming messages with empty content */}
                              {message.content ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[
                                    rehypeRaw,
                                    rehypeArtifactPlaceholder,
                                    rehypeKatex,
                                    // rehype-highlight wraps tokens in <span class="hljs-*">;
                                    // ignoreMissing=true makes it a no-op for languages hljs
                                    // doesn't ship (like 'mermaid' and 'mindmap'), so those still
                                    // reach our custom <code> handler with plain-text children.
                                    [rehypeHighlight, { ignoreMissing: true, detect: false }],
                                  ]}
                                  components={{
                                    // Render fenced diagram blocks as actual diagrams instead of
                                    // raw code. Currently handled languages: ```mermaid (flowcharts
                                    // via FlowchartArtifact) and ```mindmap (JSON → MindmapArtifact).
                                    // Other fenced blocks render with syntax highlighting + copy button.
                                    code: ({ className, children, inline, ...props }: any) => {
                                      // Inline `code` spans keep default rendering
                                      if (inline || typeof className !== "string") {
                                        return <code className={className} {...props}>{children}</code>;
                                      }
                                      if (/language-mermaid/.test(className)) {
                                        const source = extractCodeText(children);
                                        return (
                                          <div className="my-4 not-prose">
                                            <FlowchartArtifact payload={{ source }} />
                                          </div>
                                        );
                                      }
                                      if (/language-mindmap/.test(className)) {
                                        const raw = extractCodeText(children);
                                        try {
                                          const payload = JSON.parse(raw);
                                          return (
                                            <div className="my-4 not-prose">
                                              <MindmapArtifact payload={payload} />
                                            </div>
                                          );
                                        } catch (err: any) {
                                          return (
                                            <div className="my-4 not-prose text-xs">
                                              <div className="font-medium text-red-600 mb-1">Mindmap JSON invalid</div>
                                              <div className="text-muted-foreground">{err?.message ?? "parse error"}</div>
                                              <pre className="mt-2 p-2 bg-muted rounded whitespace-pre-wrap break-all">{raw}</pre>
                                            </div>
                                          );
                                        }
                                      }
                                      // Fenced block with a recognised language → copy button + hljs styling
                                      return <CodeBlockWithCopy className={className}>{children}</CodeBlockWithCopy>;
                                    },
                                    // Suppress the default <pre> wrapper — CodeBlockWithCopy brings its own.
                                    pre: ({ children }: any) => <>{children}</>,
                                    "artifact-placeholder": ({ id }: any) => {
                                      const artifact = artifactsData?.byId?.[id];
                                      if (!artifact) {
                                        return (
                                          <div className="text-xs text-muted-foreground italic my-2">
                                            [artifact {id} loading…]
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="my-4 not-prose">
                                          <ArtifactRenderer
                                            artifact={artifact}
                                            conversationId={activeConversation}
                                          />
                                        </div>
                                      );
                                    },
                                    table: ({ children, ...props }: any) => (
                                      <div className="my-4 w-full overflow-auto">
                                        <Table {...props}>
                                          {children}
                                        </Table>
                                      </div>
                                    ),
                                    thead: ({ children, ...props }: any) => (
                                      <TableHeader {...props}>
                                        {children}
                                      </TableHeader>
                                    ),
                                    tbody: ({ children, ...props }: any) => (
                                      <TableBody {...props}>
                                        {children}
                                      </TableBody>
                                    ),
                                    tr: ({ children, ...props }: any) => (
                                      <TableRow {...props}>
                                        {children}
                                      </TableRow>
                                    ),
                                    th: ({ children, ...props }: any) => (
                                      <TableHead {...props}>
                                        {children}
                                      </TableHead>
                                    ),
                                    td: ({ children, ...props }: any) => (
                                      <TableCell {...props}>
                                        {children}
                                      </TableCell>
                                    ),
                                  } as any}
                                >
                                  {normalizeMath(message.content)}
                                </ReactMarkdown>
                              ) : (
                                <div className="space-y-2">
                                  {/* ChatGPT-style thinking block */}
                                  {isStreaming && message.id.startsWith('streaming-') ? (
                                    <ThinkingBlock
                                      steps={thinkingSteps}
                                      isActive={true}
                                      currentStatus={cagptStatus || 'Thinking'}
                                    />
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">Loading...</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Show reasoning feedback for professional modes */}
                            {message.metadata?.reasoningContent && (
                              <ReasoningFeedback
                                messageContent={message.metadata.reasoningContent}
                                messageId={message.id}
                                onSubmitFeedback={async (feedback) => {
                                  // TODO: Send feedback to backend
                                }}
                              />
                            )}
                            
                            {/* Quick message feedback (thumbs up/down) for continuous learning */}
                            {message.content && !message.id.startsWith('streaming-') && !message.id.startsWith('uploading-') && activeConversation && (
                              <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1">
                                <MessageFeedback 
                                  messageId={message.id}
                                  conversationId={activeConversation}
                                />
                                {/* Speaker icon - tap to hear this response (ChatGPT-style) */}
                                <MessageSpeakButton 
                                  text={message.content}
                                  speakControls={speakControls}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <span className="text-xs opacity-70 mt-2 block">{message.timestamp}</span>
                      </div>
                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback>
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    ))}
                    
                    {/* Removed ChatMessageSkeleton - loading state is now shown inside the streaming message */}
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-3">
              <div className="max-w-4xl mx-auto space-y-2">
                {/* File Preview - only when file selected */}
                {selectedFile && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleRemoveFile}
                      data-testid="button-remove-file"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* ChatGPT-style Input Container */}
                <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls,.csv,.txt"
                    aria-label="Upload document file"
                    data-testid="input-file-upload"
                  />
                  
                  {/* Textarea - full width, no border */}
                  <Textarea
                    ref={textareaRef}
                    placeholder="Ask anything..."
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={1}
                    className="w-full border-0 shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px] overflow-y-auto px-4 pt-3 pb-1 text-base"
                    data-testid="input-message"
                  />
                  
                  {/* Bottom toolbar inside container */}
                  <div className="flex items-center justify-between px-2 pb-2 pt-0">
                    {/* Left: expandable tools */}
                    <div className="flex items-center gap-0.5">
                      {/* Expand/collapse tools toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-muted transition-transform"
                        onClick={() => setShowToolsRow(!showToolsRow)}
                        title="More tools"
                      >
                        <Plus id="tools-toggle-icon" className={`h-4 w-4 transition-transform duration-200 ${showToolsRow ? 'rotate-45' : ''}`} />
                      </Button>
                      
                      {/* Expandable tool buttons - hidden by default */}
                      {showToolsRow && (
                      <div className="flex items-center gap-0.5 animate-in slide-in-from-left-2 duration-200">
                        {/* Attachment */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => document.getElementById('file-upload')?.click()}
                          title="Attach file"
                          data-testid="button-attach-file"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        
                        {/* Chat Mode selector */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              title="Chat mode"
                              data-testid="button-chat-mode"
                            >
                              {(() => {
                                const mode = chatModes.find(m => m.id === chatMode);
                                const Icon = mode?.icon || MessageSquare;
                                return <Icon className="h-4 w-4" />;
                              })()}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64">
                            {chatModes.map((mode) => {
                              const Icon = mode.icon;
                              const isSelected = chatMode === mode.id;
                              return (
                                <DropdownMenuItem
                                  key={mode.id}
                                  onClick={() => setChatMode(mode.id)}
                                  className={isSelected ? 'bg-accent' : ''}
                                  data-testid={`chat-mode-${mode.id}`}
                                >
                                  <Icon className="h-4 w-4 mr-2" />
                                  <div className="flex-1">
                                    <span className="font-medium">{mode.label}</span>
                                    {isSelected && <Check className="h-3 w-3 ml-2 inline" />}
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      )}
                      
                      {/* Voice mic - ChatGPT style: just the mic */}
                      <VoiceModeEnhanced 
                        onTranscription={(text) => setInputMessage(prev => prev ? `${prev} ${text}` : text)}
                        onSendMessage={handleSendMessage}
                        onSpeakReady={setSpeakControls}
                        lastAssistantMessage={lastAssistantMessage}
                        conversationId={activeConversation}
                        inputMessage={inputMessage}
                      />
                    </div>
                    
                    {/* Right: Send button */}
                    <Button
                      variant="default"
                      size="icon"
                      className="h-8 w-8 rounded-full flex-shrink-0"
                      onClick={handleSendMessage}
                      disabled={(inputMessage.trim() === '' && !selectedFile) || sendMessageMutation.isPending || uploadingFile}
                      data-testid="button-send"
                    >
                      {uploadingFile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </ResizablePanel>

        {/* Right Pane: Output - only in legacy (flag-off) layout */}
        {!whiteboardEnabled && !isOutputFullscreen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel 
              defaultSize={rightPaneCollapsed ? 3 : 30} 
              minSize={rightPaneCollapsed ? 3 : 20} 
              maxSize={rightPaneCollapsed ? 3 : 50}
              collapsible={true}
              collapsedSize={3}
              key={`output-${rightPaneCollapsed}`}
            >
              {!rightPaneCollapsed ? (
                <OutputPane
                  content={outputContent}
                  visualization={outputVisualization}
                  contentType={outputContentType}
                  title={
                    chatMode === 'checklist' ? 'Professional Checklist' :
                    chatMode === 'workflow' ? 'Process Workflow' :
                    chatMode === 'audit-plan' ? 'Audit Plan' :
                    chatMode === 'calculation' ? 'Financial Calculations' :
                    'Output'
                  }
                  onCollapse={() => setRightPaneCollapsed(true)}
                  isCollapsed={false}
                  onFullscreenToggle={() => setIsOutputFullscreen(!isOutputFullscreen)}
                  isFullscreen={false}
                  conversationId={activeConversation}
                  messageId={outputMessageId}
                  hasExcel={hasExcel}
                  spreadsheetData={spreadsheetData}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center border-l bg-muted/30">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightPaneCollapsed(false)}
                    data-testid="button-expand-output-pane"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Rename Dialog */}
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

      {/* Conversation Feedback Dialog */}
      <ConversationFeedback
        conversation={conversationsData?.conversations.find((c: Conversation) => c.id === feedbackConvId) || null}
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />

      {/* Chat Overlay for Fullscreen Mode */}
      {isOutputFullscreen && showChatOverlay && (
        <ChatOverlay
          isVisible={true}
          onToggle={() => setShowChatOverlay(false)}
          onSendMessage={handleSendMessage}
          messages={messages
            .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.metadata?.showInOutputPane))
            .slice(-5) // Show last 5 messages
            .map(m => ({
              id: m.id,
              text: m.content,
              isUser: m.role === 'user',
              timestamp: new Date(m.timestamp)
            }))
          }
          isLoading={isStreaming || sendMessageMutation.isPending}
        />
      )}
      
      {/* Fullscreen Output Pane */}
      {isOutputFullscreen && (
        <OutputPane
          content={outputContent}
          visualization={outputVisualization}
          contentType={outputContentType}
          title={
            chatMode === 'checklist' ? 'Professional Checklist' :
            chatMode === 'workflow' ? 'Process Workflow' :
            chatMode === 'audit-plan' ? 'Audit Plan' :
            chatMode === 'calculation' ? 'Financial Calculations' :
            'Output'
          }
          onCollapse={() => setRightPaneCollapsed(true)}
          isCollapsed={false}
          onFullscreenToggle={() => {
            setIsOutputFullscreen(!isOutputFullscreen);
            setShowChatOverlay(false);
          }}
          isFullscreen={true}
          onChatToggle={() => setShowChatOverlay(true)}
          conversationId={activeConversation}
          messageId={outputMessageId}
          hasExcel={hasExcel}
          spreadsheetData={spreadsheetData}
        />
      )}
    </div>
  );
}

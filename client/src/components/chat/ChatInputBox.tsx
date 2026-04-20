import { memo, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Paperclip, Plus, MessageSquare, X, Send, Loader2, Check } from "lucide-react";
import { VoiceModeEnhanced } from "@/components/voice/VoiceModeEnhanced";
import type { SpeakControls } from "@/components/voice/VoiceModeEnhanced";

export interface ChatMode {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  gradient?: string;
}

export interface ChatInputBoxProps {
  /** File currently staged for upload (owned by parent). */
  selectedFile: File | null;
  onRemoveFile: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;

  chatMode: string;
  onChatModeChange: (mode: string) => void;
  chatModes: ChatMode[];

  /** Called on Enter / Send click with the submitted text. Parent is
   *  responsible for dispatching the actual send mutation. The child clears
   *  its own textarea state after this callback returns. */
  onSend: (text: string) => void;

  /** Disables the whole send path (mutation in flight, file uploading). */
  busy?: boolean;
  uploadingFile?: boolean;

  /** VoiceMode plumbing. Kept as props so the parent still owns the SSE/
   *  conversation identity and voice-reply hooks. */
  conversationId?: string;
  lastAssistantMessage?: string;
  onSpeakReady?: (controls: SpeakControls) => void;
}

/**
 * Self-contained chat input box.
 *
 * Why this is a child component: previously the `inputMessage` state lived
 * at the Chat page root, so every keystroke re-rendered the entire page —
 * sidebar, message list, every mindmap/flowchart/chart artifact. That was
 * the source of the "typing makes the whole page shake" complaint:
 * heavyweight sibling components (ReactFlow-powered mindmaps especially)
 * re-ran their layout on every character the user typed.
 *
 * Keeping `text` and `showToolsRow` state local means typing only re-renders
 * this component. The parent re-renders only on submit, which is when it
 * actually needs to — to add the user's message to the list, fire the
 * mutation, etc.
 */
function ChatInputBoxInner({
  selectedFile,
  onRemoveFile,
  onFileSelect,
  chatMode,
  onChatModeChange,
  chatModes,
  onSend,
  busy = false,
  uploadingFile = false,
  conversationId,
  lastAssistantMessage,
  onSpeakReady,
}: ChatInputBoxProps) {
  const [text, setText] = useState("");
  const [showToolsRow, setShowToolsRow] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    if (!text.trim() && !selectedFile) return;
    onSend(text);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, selectedFile, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, []);

  const sendDisabled = (text.trim() === '' && !selectedFile) || busy || uploadingFile;

  return (
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
            onClick={onRemoveFile}
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
          onChange={onFileSelect}
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls,.csv,.txt"
          aria-label="Upload document file"
          data-testid="input-file-upload"
        />

        <Textarea
          ref={textareaRef}
          placeholder="Ask anything..."
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          className="w-full border-0 shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px] overflow-y-auto px-4 pt-3 pb-1 text-base"
          data-testid="input-message"
        />

        {/* Bottom toolbar inside container */}
        <div className="flex items-center justify-between px-2 pb-2 pt-0">
          {/* Left: expandable tools */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-muted transition-transform"
              onClick={() => setShowToolsRow(v => !v)}
              title="More tools"
            >
              <Plus className={`h-4 w-4 transition-transform duration-200 ${showToolsRow ? 'rotate-45' : ''}`} />
            </Button>

            {showToolsRow && (
              <div className="flex items-center gap-0.5 animate-in slide-in-from-left-2 duration-200">
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
                          onClick={() => onChatModeChange(mode.id)}
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

            <VoiceModeEnhanced
              onTranscription={(t) => setText(prev => prev ? `${prev} ${t}` : t)}
              onSendMessage={submit}
              onSpeakReady={onSpeakReady}
              lastAssistantMessage={lastAssistantMessage}
              conversationId={conversationId}
              inputMessage={text}
            />
          </div>

          {/* Right: Send button */}
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full flex-shrink-0"
            onClick={submit}
            disabled={sendDisabled}
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
  );
}

export const ChatInputBox = memo(ChatInputBoxInner);

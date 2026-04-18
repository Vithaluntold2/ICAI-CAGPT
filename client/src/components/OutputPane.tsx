import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  Maximize2,
  Minimize2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VisualizationRenderer, { ChartData } from "./visualizations/VisualizationRenderer";
import ChecklistRenderer from "./ChecklistRenderer";
import WorkflowRenderer from "./visualizations/WorkflowRenderer";
import SpreadsheetViewer from "./SpreadsheetViewer";
import { parseWorkflowContent } from "@/utils/workflowParser";

interface OutputPaneProps {
  content: string;
  visualization?: ChartData;
  onCollapse?: () => void;
  isCollapsed?: boolean;
  contentType?: 'markdown' | 'checklist' | 'workflow' | 'calculation' | 'spreadsheet';
  title?: string;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onChatToggle?: () => void;
  conversationId?: string;
  messageId?: string;
  hasExcel?: boolean;
  spreadsheetData?: any;
}

export default function OutputPane({ 
  content, 
  visualization, 
  onCollapse, 
  isCollapsed, 
  contentType = 'markdown', 
  title,
  onFullscreenToggle,
  isFullscreen = false,
  onChatToggle,
  conversationId,
  messageId,
  hasExcel = false,
  spreadsheetData
}: OutputPaneProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && onFullscreenToggle) {
        onFullscreenToggle();
      }
    };
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen, onFullscreenToggle]);

  const handleExport = async (format: 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'csv' | 'txt') => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          visualization,
          format,
          title: 'CA GPT Output'
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the file blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ca-output-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: `Output exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Unable to export output. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = () => {
    let textToCopy = content;
    
    // Add visualization data as text if present
    if (visualization && 'data' in visualization && Array.isArray(visualization.data) && visualization.data.length > 0) {
      if (textToCopy) textToCopy += '\n\n';
      if (visualization.title) textToCopy += visualization.title + '\n\n';
      
      const allKeys = Array.from(
        new Set(visualization.data.flatMap((obj: any) => Object.keys(obj)))
      );
      
      textToCopy += allKeys.join('\t') + '\n';
      for (const row of visualization.data) {
        textToCopy += allKeys.map((key: string) => (row as any)[key] ?? '').join('\t') + '\n';
      }
    }
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if there's actual visual content to display
  const hasVisualContent = visualization || spreadsheetData || contentType === 'checklist' || contentType === 'workflow';

  if (isCollapsed && !isFullscreen) {
    return (
      <div className="flex items-center justify-center h-full bg-background border-l">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          data-testid="button-expand-output"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 h-screen bg-background' : 'h-full bg-background border-l'}`}>
      {/* Output Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">
            {isFullscreen ? 'Visualization' : 'Output'}
          </h2>
          {title && (
            <span className="text-xs text-muted-foreground">• {title}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasExcel && conversationId && messageId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const downloadUrl = `/api/conversations/${conversationId}/messages/${messageId}/excel`;
                window.open(downloadUrl, '_blank');
                toast({
                  title: "Downloading Excel file",
                  description: "Your financial calculations workbook is being downloaded."
                });
              }}
              title="Download Excel Workbook"
              data-testid="button-download-excel"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            disabled={!content && !visualization}
            data-testid="button-copy-output"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          {isFullscreen && onChatToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onChatToggle}
              data-testid="button-chat-toggle"
              title="Toggle Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          {onFullscreenToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onFullscreenToggle}
              data-testid="button-fullscreen-toggle"
              className={isFullscreen ? "bg-primary/10 hover:bg-primary/20" : ""}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          {!isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              data-testid="button-collapse-output"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Export Options - only show when there's visual content */}
      {hasVisualContent && (
        <div className="px-4 py-2 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Export:</span>
            <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} data-testid="button-export-xlsx">
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} data-testid="button-export-pdf">
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pptx')} data-testid="button-export-pptx">
              PPT
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Output Content - Only show visualizations/structured data, NOT duplicate text */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 pb-24">
          {visualization || spreadsheetData || contentType === 'checklist' || contentType === 'workflow' ? (
            <div className="space-y-6">
            {/* Spreadsheet Viewer for calculations - show whenever spreadsheetData exists */}
            {spreadsheetData ? (
              <SpreadsheetViewer
                data={spreadsheetData}
                conversationId={conversationId}
                messageId={messageId}
                onFullscreen={onFullscreenToggle}
                isFullscreen={isFullscreen}
              />
            ) : contentType === 'checklist' && content ? (
              <ChecklistRenderer 
                content={content}
                title={title}
                onExport={(format) => handleExport(format as any)}
              />
            ) : contentType === 'workflow' && content ? (
              <div className="bg-card border rounded-lg overflow-hidden" style={{ height: '70vh', minHeight: 560 }}>
                {(() => {
                  const workflowData = parseWorkflowContent(content);
                  return (
                    <WorkflowRenderer
                      nodes={workflowData.nodes}
                      edges={workflowData.edges}
                      title={title}
                      layout={workflowData.layout}
                    />
                  );
                })()}
              </div>
            ) : visualization ? (
              <div className="bg-card border rounded-lg p-4" data-testid="visualization-container">
                <VisualizationRenderer chartData={visualization} />
              </div>
            ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[280px] text-muted-foreground text-sm p-6 text-center">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium mb-2">Specialized Intelligence Output</p>
            <p className="text-xs max-w-sm mb-4">
              Charts, mindmaps, workflows, checklists, and spreadsheets appear here when generated.
            </p>
            <div className="text-xs space-y-1 text-left max-w-sm bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground/80 mb-2">Try these modes to see output:</p>
              <p>• <span className="font-medium">Checklist</span> - Create structured task lists</p>
              <p>• <span className="font-medium">Workflow</span> - Design process diagrams</p>
              <p>• <span className="font-medium">Calculation</span> - Financial computations with Excel</p>
              <p>• <span className="font-medium">Deep Research</span> - Analysis with visualizations</p>
              <p>• <span className="font-medium">Audit Plan</span> - Comprehensive audit approach</p>
            </div>
            {isFullscreen && (
              <div className="mt-4 text-xs opacity-70">
                Click the minimize button above to return to normal view
              </div>
            )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pagination - removed since we're not showing text content anymore */}
    </div>
  );
}

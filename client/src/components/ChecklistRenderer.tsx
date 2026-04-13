import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Printer, 
  Share, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown
} from "lucide-react";

interface ChecklistItem {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  dependencies?: string[];
  description?: string;
  completed: boolean;
  section?: string;
}

interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
  collapsed?: boolean;
}

interface ChecklistRendererProps {
  content: string;
  title?: string;
  onExport?: (format: 'pdf' | 'docx' | 'txt') => void;
}

const priorityColors = {
  high: "destructive",
  medium: "secondary",
  low: "outline"
} as const;

const priorityIcons = {
  high: AlertTriangle,
  medium: Clock,
  low: CheckCircle
};

export default function ChecklistRenderer({ content, title, onExport }: ChecklistRendererProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Parse checklist content into structured data
  const parseChecklist = (content: string): ChecklistSection[] => {
    const lines = content.split('\n');
    const sections: ChecklistSection[] = [];
    let currentSection: ChecklistSection = { title: "Tasks", items: [] };
    let itemCounter = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Section headers (## Title or ### Title)
      if (trimmed.match(/^#{2,3}\s+/)) {
        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmed.replace(/^#{2,3}\s+/, ''),
          items: []
        };
        continue;
      }
      
      // Checklist items (- [ ] or - [x] format)
      const checkboxMatch = trimmed.match(/^[-*]\s*\[([x\s])\]\s*(.+)/i);
      if (checkboxMatch) {
        const isCompleted = checkboxMatch[1].toLowerCase() === 'x';
        const text = checkboxMatch[2];
        
        // Extract priority from text
        const priorityMatch = text.match(/\((\w+)\s*priority\)/i);
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (priorityMatch) {
          const p = priorityMatch[1].toLowerCase();
          if (p === 'high' || p === 'medium' || p === 'low') {
            priority = p;
          }
        }
        
        // Extract deadline
        const deadlineMatch = text.match(/(?:by|due|deadline):\s*([^,]+)/i);
        const deadline = deadlineMatch ? deadlineMatch[1].trim() : undefined;
        
        const item: ChecklistItem = {
          id: `item-${itemCounter++}`,
          text: text.replace(/\([^)]*priority\)/i, '').replace(/(?:by|due|deadline):\s*[^,]+/i, '').trim(),
          priority,
          deadline,
          completed: isCompleted,
          section: currentSection.title
        };
        
        currentSection.items.push(item);
      }
      
      // Regular list items (convert to checklist items)
      else if (trimmed.match(/^[-*]\s+/) && !trimmed.includes('[')) {
        const text = trimmed.replace(/^[-*]\s+/, '');
        
        // Extract priority from text
        const priorityMatch = text.match(/\((\w+)\s*priority\)/i);
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (priorityMatch) {
          const p = priorityMatch[1].toLowerCase();
          if (p === 'high' || p === 'medium' || p === 'low') {
            priority = p;
          }
        }
        
        const item: ChecklistItem = {
          id: `item-${itemCounter++}`,
          text: text.replace(/\([^)]*priority\)/i, '').trim(),
          priority,
          completed: false,
          section: currentSection.title
        };
        
        currentSection.items.push(item);
      }
    }
    
    if (currentSection.items.length > 0) {
      sections.push(currentSection);
    }
    
    return sections.length > 0 ? sections : [{ title: "Checklist", items: [] }];
  };
  
  const sections = parseChecklist(content);
  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  const completedItems = sections.reduce((sum, section) => 
    sum + section.items.filter(item => checkedItems.has(item.id)).length, 0);
  
  const toggleItem = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    setCheckedItems(newChecked);
  };
  
  const toggleSection = (sectionTitle: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionTitle)) {
      newCollapsed.delete(sectionTitle);
    } else {
      newCollapsed.add(sectionTitle);
    }
    setCollapsedSections(newCollapsed);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-bold">
              {title || "Professional Checklist"}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Progress: {completedItems}/{totalItems} completed 
                ({Math.round((completedItems / totalItems) * 100) || 0}%)
              </span>
              <Badge variant="outline" className="text-xs">
                {sections.length} section{sections.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport?.('pdf')}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedItems / totalItems) * 100}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {sections.map((section, sectionIndex) => {
          const isCollapsed = collapsedSections.has(section.title);
          const sectionCompleted = section.items.filter(item => checkedItems.has(item.id)).length;
          
          return (
            <div key={section.title} className="space-y-3">
              {/* Section Header */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(section.title)}
                  className="h-auto p-1 hover:bg-transparent"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <h3 className="font-semibold text-lg">{section.title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {sectionCompleted}/{section.items.length}
                </Badge>
              </div>
              
              {!isCollapsed && (
                <div className="ml-6 space-y-3">
                  {section.items.map((item) => {
                    const PriorityIcon = priorityIcons[item.priority];
                    const isChecked = checkedItems.has(item.id);
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                          isChecked ? 'bg-muted/50 opacity-75' : 'bg-background'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className={`flex-1 ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                              {item.text}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <Badge variant={priorityColors[item.priority]} className="text-xs gap-1">
                                <PriorityIcon className="h-3 w-3" />
                                {item.priority}
                              </Badge>
                            </div>
                          </div>
                          
                          {item.deadline && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Due: {item.deadline}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {sectionIndex < sections.length - 1 && <Separator className="mt-6" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
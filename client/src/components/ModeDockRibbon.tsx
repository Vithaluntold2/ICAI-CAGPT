import { MessageSquare, Sparkles, ListChecks, Network, FileBarChart, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface ModeDockRibbonProps {
  chatMode: string;
  onModeChange: (mode: string) => void;
}

const chatModes = [
  { id: 'standard', label: 'Standard', icon: MessageSquare, color: 'text-foreground' },
  { id: 'deep-research', label: 'Research', icon: Sparkles, color: 'text-primary' },
  { id: 'checklist', label: 'Checklist', icon: ListChecks, color: 'text-success' },
  { id: 'workflow', label: 'Workflow', icon: Network, color: 'text-secondary' },
  { id: 'audit-plan', label: 'Audit', icon: FileBarChart, color: 'text-gold' },
  { id: 'calculation', label: 'Calculate', icon: Calculator, color: 'text-accent' },
];

export default function ModeDockRibbon({ chatMode, onModeChange }: ModeDockRibbonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeMode = chatModes.find(m => m.id === chatMode) || chatModes[0];
  const ActiveIcon = activeMode.icon;

  return (
    <div className="border-b border-border/50 glass px-4 py-2">
      <div className="max-w-7xl mx-auto">
        {/* Collapsed View - Single row with current mode and toggle */}
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mode:
            </span>
            <div className={`
              px-3 py-1.5 rounded-lg font-medium text-sm
              glass-heavy border border-primary/50
              flex items-center gap-2
            `}>
              <ActiveIcon className={`w-4 h-4 ${activeMode.color}`} />
              <span className={activeMode.color}>{activeMode.label}</span>
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Output Pane
            </Badge>
          </div>
          <button 
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            aria-label={isExpanded ? "Collapse modes" : "Expand modes"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Expanded View - All mode options */}
        {isExpanded && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/30">
            {chatModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = chatMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeChange(mode.id);
                    setIsExpanded(false);
                  }}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm
                    transition-smooth hover-elevate
                    flex items-center gap-2
                    ${isActive 
                      ? 'glass-heavy border-2 border-primary/50 shadow-lg' 
                      : 'glass border border-border/30 hover:border-primary/30'
                    }
                  `}
                  data-testid={`mode-dock-${mode.id}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? mode.color : 'text-muted-foreground'}`} />
                  <span className={isActive ? mode.color : 'text-foreground/70'}>
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

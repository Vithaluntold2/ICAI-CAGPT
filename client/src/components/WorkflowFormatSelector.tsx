import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, 
  ArrowRight, 
  GitMerge, 
  CheckCircle, 
  Network,
  Workflow
} from "lucide-react";

interface WorkflowFormatSelectorProps {
  onFormatSelect: (format: string) => void;
  selectedFormat?: string;
}

const workflowFormats = [
  {
    id: 'linear',
    name: 'Linear Process',
    icon: ArrowRight,
    description: 'Sequential steps from start to finish',
    example: 'Step 1 → Step 2 → Step 3 → Complete',
    useCase: 'Standard procedures, checklists, simple workflows',
    color: 'text-rai-500'
  },
  {
    id: 'decision',
    name: 'Decision Tree',
    icon: TreePine,
    description: 'Branching paths based on decisions',
    example: 'Decision Point → Yes/No → Different Outcomes',
    useCase: 'Compliance checks, troubleshooting, conditional processes',
    color: 'text-green-500'
  },
  {
    id: 'parallel',
    name: 'Parallel Workflow',
    icon: GitMerge,
    description: 'Multiple simultaneous paths that converge',
    example: 'Start → Path A + Path B + Path C → Merge → End',
    useCase: 'Team collaborations, multi-department processes',
    color: 'text-primary'
  },
  {
    id: 'approval',
    name: 'Approval Workflow',
    icon: UserCheck,
    description: 'Review gates and approval checkpoints',
    example: 'Submit → Review → Approve/Reject → Final Action',
    useCase: 'Document reviews, budget approvals, compliance sign-offs',
    color: 'text-orange-500'
  }
];

export default function WorkflowFormatSelector({ onFormatSelect, selectedFormat }: WorkflowFormatSelectorProps) {
  const [hoveredFormat, setHoveredFormat] = useState<string | null>(null);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Choose Workflow Format
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the visualization style that best fits your process
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflowFormats.map((format) => {
            const Icon = format.icon;
            const isSelected = selectedFormat === format.id;
            const isHovered = hoveredFormat === format.id;
            
            return (
              <Button
                key={format.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto p-4 flex flex-col items-start gap-3 text-left transition-all ${
                  isHovered ? 'shadow-md scale-105' : ''
                }`}
                onClick={() => onFormatSelect(format.id)}
                onMouseEnter={() => setHoveredFormat(format.id)}
                onMouseLeave={() => setHoveredFormat(null)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Icon className={`h-6 w-6 ${format.color}`} />
                  <div className="flex-1">
                    <div className="font-semibold">{format.name}</div>
                    <div className="text-xs opacity-75">{format.description}</div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}\n                </div>
                
                <div className="w-full space-y-2">
                  <div className="text-xs font-mono bg-muted p-2 rounded text-center">
                    {format.example}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Best for:</span> {format.useCase}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-4 w-4" />
            <span className="text-sm font-medium">Interactive Features</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Drag and rearrange workflow steps</p>
            <p>• Zoom and pan for complex processes</p>
            <p>• Export as PNG, SVG, or PDF</p>
            <p>• Real-time collaboration (coming soon)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
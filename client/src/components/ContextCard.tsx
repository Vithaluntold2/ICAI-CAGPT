/**
 * Context Card Component
 * Displays conversation context with key details
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Tag, TrendingUp, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConversationContext } from '../../../server/services/core/contextManager';

interface ContextCardProps {
  context: ConversationContext;
  onSelect?: (context: ConversationContext) => void;
  onDelete?: (contextId: string) => void;
  onRestore?: (contextId: string) => void;
}

const modeColors: Record<string, string> = {
  'deep-research': 'bg-rai-500',
  'financial-calculation': 'bg-green-500',
  'workflow-visualization': 'bg-primary/100',
  'audit-planning': 'bg-orange-500',
  'scenario-simulator': 'bg-pink-500',
  'deliverable-composer': 'bg-rai-500',
  'forensic-intelligence': 'bg-red-500',
  'roundtable': 'bg-yellow-500',
};

const modeLabels: Record<string, string> = {
  'deep-research': 'Deep Research',
  'financial-calculation': 'Financial Calculation',
  'workflow-visualization': 'Workflow Visualization',
  'audit-planning': 'Audit Planning',
  'scenario-simulator': 'Scenario Simulator',
  'deliverable-composer': 'Deliverable Composer',
  'forensic-intelligence': 'Forensic Intelligence',
  'roundtable': 'Roundtable',
};

export function ContextCard({ context, onSelect, onDelete, onRestore }: ContextCardProps) {
  const formattedDate = new Date(context.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(context.updatedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer relative"
      onClick={() => onSelect?.(context)}
    >
      {/* Mode indicator bar */}
      <div className={`h-1 w-full ${modeColors[context.mode] || 'bg-gray-500'}`} />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">
              {context.title || 'Untitled Conversation'}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {modeLabels[context.mode] || context.mode}
              </Badge>
              {context.state.currentStep && (
                <span className="text-xs text-muted-foreground">
                  Step: {context.state.currentStep}
                </span>
              )}
            </CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onSelect?.(context);
              }}>
                Open
              </DropdownMenuItem>
              {onRestore && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onRestore(context.id);
                }}>
                  Restore Snapshot
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(context.id);
                  }}
                  className="text-red-600"
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Statistics */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>{context.metadata.messageCount} messages</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate} at {formattedTime}</span>
            </div>
          </div>

          {/* Tags */}
          {context.metadata.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {context.metadata.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {context.metadata.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{context.metadata.tags.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* User tier badge */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs capitalize">
              {context.metadata.userTier}
            </Badge>
          </div>

          {/* Variable count */}
          {Object.keys(context.state.variables).length > 0 && (
            <div className="text-xs text-muted-foreground">
              {Object.keys(context.state.variables).length} context variables
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

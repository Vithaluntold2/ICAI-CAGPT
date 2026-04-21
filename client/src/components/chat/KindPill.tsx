// client/src/components/chat/KindPill.tsx
import {
  BarChart3, ListChecks, Network, Sparkle as MindIcon,
  Table2, Share2, FileText,
} from 'lucide-react';
import type { WhiteboardArtifact } from '../../../../shared/schema';

const KIND_META: Record<WhiteboardArtifact['kind'], { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  chart: { label: 'CHART', Icon: BarChart3 },
  checklist: { label: 'CHECKLIST', Icon: ListChecks },
  workflow: { label: 'WORKFLOW', Icon: Network },
  mindmap: { label: 'MINDMAP', Icon: MindIcon },
  spreadsheet: { label: 'SHEET', Icon: Table2 },
  flowchart: { label: 'FLOW', Icon: Share2 },
  document: { label: 'NOTE', Icon: FileText },
};

interface KindPillProps {
  kind: WhiteboardArtifact['kind'];
}

export function KindPill({ kind }: KindPillProps) {
  const meta = KIND_META[kind];
  if (!meta) return null;
  const { Icon, label } = meta;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-aurora-teal/10 border border-aurora-teal/20 text-aurora-teal-soft text-[10px] font-mono font-medium">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

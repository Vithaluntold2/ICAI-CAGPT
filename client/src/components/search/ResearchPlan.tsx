/**
 * ResearchPlan — Progressive todo-list showing AI research steps
 *
 * Mimics a professional research workflow:
 * ✅ Completed steps (green check)
 * ⏳ In-progress step (spinning indicator + detail text)
 * ○  Not-started steps (gray circle)
 *
 * Includes a progress bar and current-step detail at the bottom.
 */

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export interface ResearchStep {
  id: number;
  label: string;
  status: 'not-started' | 'in-progress' | 'completed';
  detail?: string;
}

interface ResearchPlanProps {
  title: string;
  steps: ResearchStep[];
  currentDetail?: string;
}

export function ResearchPlan({ title, steps, currentDetail }: ResearchPlanProps) {
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <h3 className="text-sm font-medium text-foreground leading-snug pr-4">
          {title}
        </h3>
        {progress < 100 && (
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {completedCount}/{steps.length}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="px-5 py-3 space-y-2.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 transition-opacity duration-300 ${
              step.status === 'not-started' ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {/* Status icon */}
            <div className="shrink-0 mt-0.5">
              {step.status === 'completed' && (
                <CheckCircle2 className="w-[18px] h-[18px] text-primary" />
              )}
              {step.status === 'in-progress' && (
                <Loader2 className="w-[18px] h-[18px] text-primary animate-spin" />
              )}
              {step.status === 'not-started' && (
                <Circle className="w-[18px] h-[18px] text-muted-foreground/40" />
              )}
            </div>

            {/* Step text */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm leading-snug ${
                  step.status === 'completed'
                    ? 'text-foreground'
                    : step.status === 'in-progress'
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </p>
              {step.status === 'in-progress' && step.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar + current detail */}
      <div className="px-5 pb-3.5 space-y-2">
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current step detail text */}
        {currentDetail && progress < 100 && (
          <p className="text-xs text-muted-foreground truncate">
            {currentDetail}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * ThinkingBlock — ChatGPT-style "Thinking" indicator
 * 
 * Shows a collapsible dark block with:
 * - Animated dot spinner + "Thinking" header
 * - Step-by-step progress items with green dots (completed) / pulsing dot (active)
 * - Shimmer gradient animation on the active step text
 * - Collapses into a compact summary when done
 * 
 * Matches the ChatGPT/Gemini "Thinking" / "Working..." / "Considering..." pattern.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface ThinkingStep {
  phase: string;
  detail: string;
  timestamp?: number;
}

interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isActive: boolean; // true = still thinking, false = done
  currentStatus?: string; // e.g. "Considering...", "Processing..."
}

// CSS-in-JS for the shimmer animation (injected once)
const SHIMMER_STYLE_ID = 'thinking-block-shimmer';
const injectShimmerCSS = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes shimmer-sweep {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .thinking-shimmer {
      background: linear-gradient(
        90deg,
        currentColor 0%,
        rgba(168, 139, 250, 1) 40%,
        rgba(129, 140, 248, 1) 50%,
        rgba(168, 139, 250, 1) 60%,
        currentColor 100%
      );
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer-sweep 2s ease-in-out infinite;
    }
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    .thinking-dot-1 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 0ms; }
    .thinking-dot-2 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 200ms; }
    .thinking-dot-3 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 400ms; }
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .thinking-spinner {
      animation: spin-slow 1s linear infinite;
    }
  `;
  document.head.appendChild(style);
};

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  steps,
  isActive,
  currentStatus,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Inject shimmer CSS once
  useEffect(() => {
    injectShimmerCSS();
  }, []);

  // Auto-collapse when thinking finishes
  useEffect(() => {
    if (!isActive && steps.length > 0) {
      const timer = setTimeout(() => setExpanded(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isActive, steps.length]);

  if (steps.length === 0 && !isActive) return null;

  const activeLabel = currentStatus || 'Thinking';

  return (
    <div className="my-1">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors group w-full text-left py-1"
      >
        {/* Animated spinner / chevron */}
        {isActive ? (
          <span className="relative flex items-center justify-center w-4 h-4 text-primary">
            <svg className="w-4 h-4 thinking-spinner" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 20" strokeLinecap="round" opacity="0.3" />
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 30" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-primary/70" />
          ) : (
            <ChevronRight className="w-4 h-4 text-primary/70" />
          )
        )}

        {/* Label with shimmer when active */}
        {isActive ? (
          <span className="thinking-shimmer font-medium">
            {activeLabel}
          </span>
        ) : (
          <span className="text-primary/60">
            Thought for a moment
          </span>
        )}
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="ml-2 pl-4 border-l-2 border-primary/30 mt-1 space-y-0.5">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isActiveStep = isActive && isLast;
            
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 py-0.5 text-sm transition-all duration-300 ${
                  isActiveStep
                    ? 'text-foreground'
                    : 'text-primary/40'
                }`}
              >
                {/* Dot indicator */}
                {isActiveStep ? (
                  <span className="relative mt-1.5 flex-shrink-0">
                    <span className="block w-2 h-2 bg-primary rounded-full" />
                    <span className="absolute inset-0 w-2 h-2 bg-primary rounded-full animate-ping opacity-40" />
                  </span>
                ) : (
                  <span className="mt-1.5 flex-shrink-0">
                    <span className="block w-2 h-2 bg-primary/30 rounded-full" />
                  </span>
                )}

                {/* Step text */}
                <span className={isActiveStep ? 'font-medium' : ''}>
                  {step.detail}
                </span>
              </div>
            );
          })}

          {/* Active bottom status with animated dots */}
          {isActive && (
            <div className="flex items-center gap-1.5 pt-1 pb-0.5">
              <span className="relative mt-0 flex-shrink-0 flex items-center gap-0.5 ml-0">
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full thinking-dot-1" />
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full thinking-dot-2" />
                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full thinking-dot-3" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;

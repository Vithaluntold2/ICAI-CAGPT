/**
 * RelatedQuestions — AI-generated follow-up questions
 *
 * Displayed after search results to encourage deeper exploration.
 */

import { ArrowRight } from 'lucide-react';

interface RelatedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function RelatedQuestions({ questions, onSelect }: RelatedQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Related Questions</h3>
      <div className="space-y-1.5">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="group flex items-center gap-3 w-full text-left rounded-xl border border-border/30 bg-card/40 px-4 py-2.5 text-sm text-foreground transition-all duration-150 hover:border-primary/30 hover:bg-accent/40"
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
            <span className="flex-1">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

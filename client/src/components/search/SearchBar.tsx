/**
 * SearchBar — The central search input for CA GPT Search
 *
 * Features:
 * - Auto-expanding textarea for long queries
 * - Domain filter chips (Tax, Audit, GAAP/IFRS, etc.)
 * - Keyboard shortcut (Enter to search, Shift+Enter for newline)
 * - Loading state while searching
 */

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SearchDomain } from '@/hooks/useSearch';

interface SearchBarProps {
  onSearch: (query: string, domain?: SearchDomain) => void;
  isSearching: boolean;
  initialQuery?: string;
  initialDomain?: SearchDomain;
}

const DOMAIN_OPTIONS: { value: SearchDomain; label: string; icon: string }[] = [
  { value: 'general', label: 'All', icon: '🔍' },
  { value: 'tax', label: 'Tax', icon: '📋' },
  { value: 'audit', label: 'Audit', icon: '🔎' },
  { value: 'gaap_ifrs', label: 'GAAP / IFRS', icon: '📊' },
  { value: 'compliance', label: 'Compliance', icon: '⚖️' },
  { value: 'advisory', label: 'Advisory', icon: '💼' },
];

export function SearchBar({ onSearch, isSearching, initialQuery = '', initialDomain }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedDomain, setSelectedDomain] = useState<SearchDomain>(initialDomain || 'general');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync query when parent passes a new initialQuery (e.g. history click, related question)
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [query]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;
    onSearch(trimmed, selectedDomain === 'general' ? undefined : selectedDomain);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Search input */}
      <div className="relative group">
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-lg transition-all duration-200 focus-within:border-primary/50 focus-within:shadow-primary/10 focus-within:shadow-xl">
          <Search className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />

          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about accounting, tax, or finance..."
            className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 min-h-[28px] max-h-[160px] text-base leading-relaxed"
            rows={1}
            disabled={isSearching}
          />

          {query && !isSearching && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground mt-1 shrink-0"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!query.trim() || isSearching}
            size="sm"
            className="rounded-xl shrink-0 mt-0.5"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Domain chips */}
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        {DOMAIN_OPTIONS.map((opt) => (
          <Badge
            key={opt.value}
            variant={selectedDomain === opt.value ? 'default' : 'outline'}
            className={`cursor-pointer select-none transition-all duration-150 text-xs px-3 py-1 ${
              selectedDomain === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent/60 border-border/50'
            }`}
            onClick={() => setSelectedDomain(opt.value)}
          >
            <span className="mr-1">{opt.icon}</span>
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

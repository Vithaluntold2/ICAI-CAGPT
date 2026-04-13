/**
 * CA GPT Search — AI-Powered Search Page
 *
 * A dedicated search experience for accounting, tax, and finance professionals.
 * Not just a search engine — a research assistant that thinks like 10,000 CPAs.
 *
 * Layout:
 * - Sidebar: Search history (collapsible on mobile)
 * - Main: Search bar → AI-synthesized answer → Source cards → Related questions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useSearch, SearchDomain, SearchHistoryItem } from '@/hooks/useSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { SourceCard } from '@/components/search/SourceCard';
import { RelatedQuestions } from '@/components/search/RelatedQuestions';
import { ResearchPlan } from '@/components/search/ResearchPlan';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  History,
  Pin,
  Trash2,
  Clock,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Zap,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Domain label map
// ---------------------------------------------------------------------------

const DOMAIN_LABELS: Record<string, { label: string; icon: string }> = {
  tax: { label: 'Tax', icon: '📋' },
  audit: { label: 'Audit', icon: '🔎' },
  gaap_ifrs: { label: 'GAAP / IFRS', icon: '📊' },
  compliance: { label: 'Compliance', icon: '⚖️' },
  advisory: { label: 'Advisory', icon: '💼' },
  general: { label: 'General', icon: '🔍' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const [, navigate] = useLocation();
  const {
    currentResult,
    isSearching,
    searchError,
    history,
    isLoadingHistory,
    suggestions,
    executeSearch,
    loadFromHistory,
    pinSearch,
    deleteSearch,
    // Streaming state
    researchPlanTitle,
    researchSteps,
    streamingAnswer,
    streamingCitations,
    streamingRelated,
    currentStepDetail,
  } = useSearch();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentQuery, setCurrentQuery] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  // Scroll to results when they arrive
  useEffect(() => {
    if (currentResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentResult]);

  // Handle search
  const handleSearch = useCallback(
    (query: string, domain?: SearchDomain) => {
      setCurrentQuery(query);
      executeSearch(query, domain);
    },
    [executeSearch],
  );

  // Handle related question click
  const handleRelatedQuestion = useCallback(
    (question: string) => {
      setCurrentQuery(question);
      executeSearch(question);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [executeSearch],
  );

  // Handle history item click
  const handleHistoryClick = useCallback(
    (item: SearchHistoryItem) => {
      setCurrentQuery(item.query);
      loadFromHistory(item);
    },
    [loadFromHistory],
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setCurrentQuery(suggestion);
      executeSearch(suggestion);
    },
    [executeSearch],
  );

  return (
    <div className="flex h-screen bg-background">
      {/* ── Sidebar: Search History ─────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } shrink-0 border-r border-border/40 bg-card/30 transition-all duration-300 overflow-hidden`}
      >
        <div className="flex flex-col h-full w-72">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Search History</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* History list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoadingHistory ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))
              ) : history.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No searches yet.</p>
                  <p className="text-xs mt-1">Your search history will appear here.</p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleHistoryClick(item)}
                    className="group w-full text-left rounded-lg px-3 py-2.5 hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground line-clamp-2 flex-1">
                        {item.query}
                      </p>
                      {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {DOMAIN_LABELS[item.domain]?.icon} {DOMAIN_LABELS[item.domain]?.label || item.domain}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    {/* Pin / Delete on hover */}
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pinSearch(item.id);
                        }}
                        className="text-muted-foreground hover:text-primary p-0.5"
                        title={item.pinned ? 'Unpin' : 'Pin'}
                        aria-label={item.pinned ? 'Unpin search' : 'Pin search'}
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSearch(item.id);
                        }}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title="Delete"
                        aria-label="Delete search"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Back to Chat */}
          <div className="p-3 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => navigate('/chat')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Chat
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Toggle sidebar button (when collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-10 p-2 rounded-lg bg-card border border-border/40 text-muted-foreground hover:text-foreground shadow-sm transition-colors"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Search area — centered when no results, top when results exist */}
        <div
          className={`flex-shrink-0 transition-all duration-500 ${
            currentResult
              ? 'pt-6 pb-4 px-6'
              : 'flex-1 flex flex-col items-center justify-center px-6 pb-20'
          }`}
        >
          {/* Branding (only shown before search) */}
          {!currentResult && !isSearching && (
            <div className="text-center mb-8 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  CA GPT <span className="text-primary">Search</span>
                </h1>
              </div>
              <p className="text-muted-foreground text-base max-w-lg mx-auto">
                Your AI research assistant for accounting, tax, and finance.
                Powered by real-time search with authoritative source citations.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Real-time web search
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Authoritative sources
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Expert analysis
                </span>
              </div>
            </div>
          )}

          <SearchBar
            onSearch={handleSearch}
            isSearching={isSearching}
            initialQuery={currentQuery}
          />

          {/* Suggestions (only shown when no results) */}
          {!currentResult && !isSearching && (
            <div className="mt-8 max-w-2xl mx-auto">
              <p className="text-xs text-muted-foreground/60 text-center mb-3">
                Try searching
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border/30 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/40 transition-all duration-150 max-w-[260px] truncate"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Research Plan (streaming todo-list) ────────────────────── */}
        {isSearching && researchSteps.length > 0 && (
          <div className="px-6 pb-6 max-w-3xl mx-auto w-full space-y-6">
            <ResearchPlan
              title={researchPlanTitle}
              steps={researchSteps}
              currentDetail={currentStepDetail}
            />

            {/* Streaming answer (appears as chunks arrive) */}
            {streamingAnswer && (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground">
                <ReactMarkdown>{streamingAnswer}</ReactMarkdown>
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
              </div>
            )}

            {/* Streaming citations */}
            {streamingCitations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Sources ({streamingCitations.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {streamingCitations.map((citation, i) => (
                    <SourceCard key={i} citation={citation} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Fallback loading skeleton (if no research plan yet) ───────── */}
        {isSearching && researchSteps.length === 0 && (
          <div className="px-6 pb-8 max-w-3xl mx-auto w-full space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Preparing research plan...
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {searchError && (
          <div className="px-6 pb-8 max-w-3xl mx-auto w-full">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {searchError}
            </div>
          </div>
        )}

        {/* ── Search Results ───────────────────────────────────────────── */}
        {currentResult && !isSearching && (
          <div ref={resultRef} className="px-6 pb-12 max-w-3xl mx-auto w-full space-y-6">
            {/* Result metadata */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                {DOMAIN_LABELS[currentResult.domain]?.icon}{' '}
                {DOMAIN_LABELS[currentResult.domain]?.label || currentResult.domain}
              </Badge>
              {currentResult.jurisdiction && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  🌍 {currentResult.jurisdiction.toUpperCase()}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(currentResult.processingTimeMs / 1000).toFixed(1)}s
              </span>
              <span>
                {currentResult.providerUsed === 'perplexity' ? '🌐 Web search' : '🤖 AI knowledge'}
              </span>
            </div>

            {/* AI Answer */}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground">
              <ReactMarkdown>{currentResult.answer}</ReactMarkdown>
            </div>

            {/* Sources — use streaming citations (preferred) or currentResult.citations (history) */}
            {(() => {
              const citations = streamingCitations.length > 0 ? streamingCitations : currentResult.citations;
              if (citations.length === 0) return null;
              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Sources ({citations.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {citations.map((citation, i) => (
                      <SourceCard key={i} citation={citation} index={i} />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Related Questions — use streaming or currentResult */}
            <RelatedQuestions
              questions={streamingRelated.length > 0 ? streamingRelated : currentResult.relatedQuestions}
              onSelect={handleRelatedQuestion}
            />

            {/* Deep dive prompt */}
            <div className="border-t border-border/30 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigate(`/chat?q=${encodeURIComponent(currentQuery)}&mode=deep-research`)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Deep Dive in Chat — Multi-expert analysis
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: relative time
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

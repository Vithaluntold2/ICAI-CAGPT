/**
 * SourceCard — Displays a single search result source/citation
 *
 * Shows favicon, domain, title, and links to the original source.
 * Professional appearance with domain-specific styling.
 */

import { ExternalLink } from 'lucide-react';
import type { SearchCitation } from '@/hooks/useSearch';

interface SourceCardProps {
  citation: SearchCitation;
  index: number;
}

/** Known authoritative domain badges */
const AUTHORITATIVE_DOMAINS: Record<string, { label: string; className: string }> = {
  'incometaxindia.gov.in': { label: 'Govt.', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'cbdt.gov.in': { label: 'CBDT', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'gst.gov.in': { label: 'GST', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'mca.gov.in': { label: 'MCA', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'sebi.gov.in': { label: 'SEBI', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'rbi.org.in': { label: 'RBI', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'icai.org': { label: 'ICAI', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  'ifrs.org': { label: 'IFRS', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  'fasb.org': { label: 'FASB', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  'irs.gov': { label: 'IRS', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'sec.gov': { label: 'SEC', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'pcaobus.org': { label: 'PCAOB', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  'aicpa.org': { label: 'AICPA', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  'gov.uk': { label: 'UK Govt.', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'legislation.gov.uk': { label: 'UK Law', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
};

function getAuthoritativeBadge(domain: string): { label: string; className: string } | null {
  for (const [key, badge] of Object.entries(AUTHORITATIVE_DOMAINS)) {
    if (domain.includes(key)) return badge;
  }
  return null;
}

export function SourceCard({ citation, index }: SourceCardProps) {
  const badge = getAuthoritativeBadge(citation.domain);

  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/60 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-accent/40 hover:shadow-md"
    >
      {/* Index number */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </span>

      {/* Favicon */}
      <img
        src={citation.favicon}
        alt=""
        className="h-4 w-4 shrink-0 mt-0.5 rounded-sm"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {citation.title}
          </span>
          {badge && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate block mt-0.5">
          {citation.domain}
        </span>
        {citation.snippet && (
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
            {citation.snippet}
          </p>
        )}
      </div>

      {/* External link icon */}
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

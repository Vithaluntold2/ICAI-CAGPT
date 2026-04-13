/**
 * Regulatory Scraper Service
 * Web scraping integration for real-time regulatory updates from Indian tax &
 * accounting authorities, aligned with ICAI CA GPT's domain.
 * 
 * Primary sources (India):
 * - ICAI (Institute of Chartered Accountants of India)
 * - CBDT (Central Board of Direct Taxes / Income Tax India)
 * - SEBI (Securities and Exchange Board of India)
 * - MCA (Ministry of Corporate Affairs)
 * - RBI (Reserve Bank of India)
 * - GST Council / CBIC
 * 
 * International standards:
 * - IFRS Foundation, IESBA updates
 */

import { EventEmitter } from 'events';
import { db } from '../../db';
import { knowledgeNodes, knowledgeEdges } from '../../../shared/schema';
import { embeddingService } from '../embeddingService';
import { pgVectorStore } from './pgVectorStore';
import { sql } from 'drizzle-orm';

// ================================
// Types
// ================================

export interface RegulatorySource {
  id: string;
  name: string;
  jurisdiction: string;
  url: string;
  type: 'rss' | 'api' | 'html';
  category: 'tax' | 'accounting' | 'audit' | 'compliance';
  enabled: boolean;
  lastFetched?: Date;
  fetchIntervalHours: number;
}

export interface RegulatoryUpdate {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  summary?: string;
  url: string;
  publishedAt: Date;
  jurisdiction: string;
  category: string;
  tags: string[];
  isProcessed: boolean;
  vectorId?: string;
  nodeId?: string;
}

export interface ScrapingResult {
  source: RegulatorySource;
  updates: RegulatoryUpdate[];
  errors: string[];
  fetchedAt: Date;
}

// ================================
// Regulatory Sources Configuration
// ================================

const REGULATORY_SOURCES: RegulatorySource[] = [
  // ── India — Primary Sources ──────────────────────────────────────

  // ICAI
  {
    id: 'icai-announcements',
    name: 'ICAI Announcements',
    jurisdiction: 'IN',
    url: 'https://www.icai.org/category/announcements',
    type: 'html',
    category: 'accounting',
    enabled: true,
    fetchIntervalHours: 6,
  },
  {
    id: 'icai-standards',
    name: 'ICAI Accounting Standards',
    jurisdiction: 'IN',
    url: 'https://www.icai.org/post/accounting-standards',
    type: 'html',
    category: 'accounting',
    enabled: true,
    fetchIntervalHours: 24,
  },

  // CBDT — Income Tax India
  {
    id: 'cbdt-circulars',
    name: 'CBDT Circulars',
    jurisdiction: 'IN',
    url: 'https://incometaxindia.gov.in/Pages/communications/circulars.aspx',
    type: 'html',
    category: 'tax',
    enabled: true,
    fetchIntervalHours: 6,
  },
  {
    id: 'cbdt-notifications',
    name: 'CBDT Notifications',
    jurisdiction: 'IN',
    url: 'https://incometaxindia.gov.in/Pages/communications/notifications.aspx',
    type: 'html',
    category: 'tax',
    enabled: true,
    fetchIntervalHours: 6,
  },

  // GST / CBIC
  {
    id: 'gst-notifications',
    name: 'GST Notifications',
    jurisdiction: 'IN',
    url: 'https://www.cbic.gov.in/htdocs-cbec/gst/Notifications/notifications.htm',
    type: 'html',
    category: 'tax',
    enabled: true,
    fetchIntervalHours: 12,
  },

  // SEBI
  {
    id: 'sebi-circulars',
    name: 'SEBI Circulars',
    jurisdiction: 'IN',
    url: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=2&smid=0',
    type: 'html',
    category: 'compliance',
    enabled: true,
    fetchIntervalHours: 12,
  },

  // MCA
  {
    id: 'mca-notifications',
    name: 'MCA Notifications',
    jurisdiction: 'IN',
    url: 'https://www.mca.gov.in/content/mca/global/en/acts-rules/ebooks/notifications.html',
    type: 'html',
    category: 'compliance',
    enabled: true,
    fetchIntervalHours: 24,
  },

  // RBI
  {
    id: 'rbi-circulars',
    name: 'RBI Master Circulars',
    jurisdiction: 'IN',
    url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx',
    type: 'html',
    category: 'compliance',
    enabled: true,
    fetchIntervalHours: 12,
  },

  // ── International Standards ───────────────────────────────────────

  {
    id: 'ifrs-news',
    name: 'IFRS Foundation News',
    jurisdiction: 'INTL',
    url: 'https://www.ifrs.org/news-and-events/news/',
    type: 'html',
    category: 'accounting',
    enabled: true,
    fetchIntervalHours: 24,
  },
  {
    id: 'iesba-updates',
    name: 'IESBA Ethics Updates',
    jurisdiction: 'INTL',
    url: 'https://www.ethicsboard.org/resources-standards',
    type: 'html',
    category: 'audit',
    enabled: true,
    fetchIntervalHours: 48,
  },
];

// ================================
// Scraper Service
// ================================

class RegulatoryScraperService extends EventEmitter {
  private sources: Map<string, RegulatorySource> = new Map();
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Initialize sources
    REGULATORY_SOURCES.forEach(source => {
      this.sources.set(source.id, source);
    });
    console.log(`[RegulatoryScraper] Initialized with ${this.sources.size} sources`);
  }

  // ================================
  // Source Management
  // ================================

  /**
   * Get all configured sources
   */
  getSources(): RegulatorySource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get sources by jurisdiction
   */
  getSourcesByJurisdiction(jurisdiction: string): RegulatorySource[] {
    return this.getSources().filter(s => s.jurisdiction === jurisdiction);
  }

  /**
   * Enable/disable a source
   */
  setSourceEnabled(sourceId: string, enabled: boolean): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.enabled = enabled;
      this.emit('source:updated', { sourceId, enabled });
    }
  }

  // ================================
  // Scraping Logic
  // ================================

  /**
   * Start the scraping scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[RegulatoryScraper] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[RegulatoryScraper] Starting scheduler...');

    // Run initial fetch
    this.fetchAllSources();

    // Schedule periodic fetches (every hour, check which sources need updating)
    this.intervalId = setInterval(() => {
      this.fetchDueSources();
    }, 60 * 60 * 1000); // Check every hour

    this.emit('scheduler:started');
  }

  /**
   * Stop the scraping scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[RegulatoryScraper] Stopped scheduler');
    this.emit('scheduler:stopped');
  }

  /**
   * Fetch all enabled sources
   */
  async fetchAllSources(): Promise<ScrapingResult[]> {
    const enabledSources = this.getSources().filter(s => s.enabled);
    console.log(`[RegulatoryScraper] Fetching ${enabledSources.length} sources...`);

    const results: ScrapingResult[] = [];
    
    for (const source of enabledSources) {
      try {
        const result = await this.fetchSource(source);
        results.push(result);
      } catch (error) {
        console.error(`[RegulatoryScraper] Error fetching ${source.id}:`, error);
        results.push({
          source,
          updates: [],
          errors: [String(error)],
          fetchedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Fetch sources that are due for update
   */
  async fetchDueSources(): Promise<ScrapingResult[]> {
    const now = new Date();
    const dueSources = this.getSources().filter(source => {
      if (!source.enabled) return false;
      if (!source.lastFetched) return true;
      
      const hoursSinceLastFetch = (now.getTime() - source.lastFetched.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastFetch >= source.fetchIntervalHours;
    });

    if (dueSources.length === 0) {
      return [];
    }

    console.log(`[RegulatoryScraper] ${dueSources.length} sources due for update`);
    
    const results: ScrapingResult[] = [];
    for (const source of dueSources) {
      try {
        const result = await this.fetchSource(source);
        results.push(result);
      } catch (error) {
        console.error(`[RegulatoryScraper] Error fetching ${source.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Fetch a single source
   */
  async fetchSource(source: RegulatorySource): Promise<ScrapingResult> {
    console.log(`[RegulatoryScraper] Fetching ${source.name}...`);
    const startTime = Date.now();
    const errors: string[] = [];
    const updates: RegulatoryUpdate[] = [];

    try {
      // Fetch the content
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'ICAI CAGPT/1.0 (Accounting Research Bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Parse based on source type
      const parsedUpdates = await this.parseContent(source, html);
      
      // Process and store updates
      for (const update of parsedUpdates) {
        try {
          const processed = await this.processUpdate(update);
          if (processed) {
            updates.push(processed);
          }
        } catch (err) {
          errors.push(`Failed to process update: ${update.title}`);
        }
      }

      // Update last fetched time
      source.lastFetched = new Date();
      
      const duration = Date.now() - startTime;
      console.log(`[RegulatoryScraper] ${source.name}: ${updates.length} updates in ${duration}ms`);
      
      this.emit('source:fetched', { 
        sourceId: source.id, 
        updateCount: updates.length,
        duration 
      });

    } catch (error) {
      errors.push(String(error));
      console.error(`[RegulatoryScraper] ${source.name} failed:`, error);
    }

    return {
      source,
      updates,
      errors,
      fetchedAt: new Date(),
    };
  }

  /**
   * Parse HTML content to extract updates
   */
  private async parseContent(source: RegulatorySource, html: string): Promise<RegulatoryUpdate[]> {
    const updates: RegulatoryUpdate[] = [];
    
    // Simple regex-based extraction (in production, use cheerio or puppeteer)
    // This is a simplified implementation - real scraping would need source-specific parsers
    
    // Extract links with titles
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const [, href, title] = match;
      
      // Filter for relevant content based on keywords
      const lowerTitle = title.toLowerCase();
      const isRelevant = this.isRelevantUpdate(lowerTitle, source.category);
      
      if (isRelevant && title.length > 10 && title.length < 200) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).toString();
        
        updates.push({
          id: this.generateUpdateId(source.id, fullUrl),
          sourceId: source.id,
          title: title.trim(),
          content: '', // Would fetch full content in production
          url: fullUrl,
          publishedAt: new Date(),
          jurisdiction: source.jurisdiction,
          category: source.category,
          tags: this.extractTags(title),
          isProcessed: false,
        });
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return updates.filter(u => {
      if (seen.has(u.url)) return false;
      seen.add(u.url);
      return true;
    }).slice(0, 20); // Limit to 20 updates per source
  }

  /**
   * Check if an update is relevant based on keywords
   */
  private isRelevantUpdate(title: string, category: string): boolean {
    const keywords: Record<string, string[]> = {
      tax: ['tax', 'irs', 'hmrc', 'cra', 'ato', 'income', 'deduction', 'credit', 'filing', 'return', 'withholding', 'gst', 'vat', 'excise'],
      accounting: ['accounting', 'gaap', 'ifrs', 'fasb', 'standard', 'disclosure', 'financial statement', 'revenue', 'lease', 'impairment'],
      audit: ['audit', 'assurance', 'attestation', 'review', 'pcaob', 'inspection', 'quality control'],
      compliance: ['sec', 'regulation', 'rule', 'compliance', 'enforcement', 'filing', 'disclosure', 'form'],
    };

    const categoryKeywords = keywords[category] || [];
    return categoryKeywords.some(kw => title.includes(kw));
  }

  /**
   * Extract tags from title
   */
  private extractTags(title: string): string[] {
    const tags: string[] = [];
    const lower = title.toLowerCase();
    
    // Tax types
    if (lower.includes('income tax')) tags.push('income-tax');
    if (lower.includes('sales tax') || lower.includes('gst') || lower.includes('vat')) tags.push('indirect-tax');
    if (lower.includes('payroll')) tags.push('payroll');
    if (lower.includes('international') || lower.includes('transfer pricing')) tags.push('international-tax');
    
    // Entity types
    if (lower.includes('corporation') || lower.includes('corporate')) tags.push('corporate');
    if (lower.includes('individual') || lower.includes('personal')) tags.push('individual');
    if (lower.includes('partnership')) tags.push('partnership');
    if (lower.includes('trust') || lower.includes('estate')) tags.push('trust-estate');
    
    // Document types
    if (lower.includes('notice')) tags.push('notice');
    if (lower.includes('revenue procedure') || lower.includes('rev. proc.')) tags.push('revenue-procedure');
    if (lower.includes('revenue ruling') || lower.includes('rev. rul.')) tags.push('revenue-ruling');
    if (lower.includes('regulation')) tags.push('regulation');
    
    return tags;
  }

  /**
   * Generate unique ID for an update
   */
  private generateUpdateId(sourceId: string, url: string): string {
    const hash = url.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${sourceId}-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Process and store an update
   */
  private async processUpdate(update: RegulatoryUpdate): Promise<RegulatoryUpdate | null> {
    try {
      // Check if already processed (by URL hash)
      const existingNode = await this.findExistingNode(update.url);
      if (existingNode) {
        console.log(`[RegulatoryScraper] Skipping duplicate: ${update.title.slice(0, 50)}...`);
        return null;
      }

      // Generate embedding for the update
      const textToEmbed = `${update.title}\n\n${update.content || update.title}`;
      const embeddingResult = await embeddingService.generateEmbedding(textToEmbed);

      // Store in vector store
      const vectorResult = await pgVectorStore.addDocument({
        content: textToEmbed,
        embedding: embeddingResult.embedding,
        metadata: {
          type: 'regulation' as const,
          source: update.sourceId,
          jurisdiction: update.jurisdiction,
          tags: update.tags,
        },
      });

      const vectorId = vectorResult?.id || '';
      update.vectorId = vectorId;

      // Store in knowledge graph
      const [nodeResult] = await db.insert(knowledgeNodes).values({
        nodeType: 'regulation',
        label: update.title,
        source: 'regulatory_scraper',
        properties: {
          url: update.url,
          jurisdiction: update.jurisdiction,
          category: update.category,
          tags: update.tags,
          sourceId: update.sourceId,
          content: update.content || update.title,
          vectorId,
          fetchedAt: new Date().toISOString(),
        },
      }).returning({ id: knowledgeNodes.id });

      update.nodeId = nodeResult.id;
      update.isProcessed = true;

      console.log(`[RegulatoryScraper] Processed: ${update.title.slice(0, 50)}...`);
      this.emit('update:processed', { updateId: update.id, title: update.title });

      return update;

    } catch (error) {
      console.error(`[RegulatoryScraper] Failed to process update:`, error);
      return null;
    }
  }

  /**
   * Check if a node already exists for this URL
   */
  private async findExistingNode(url: string): Promise<boolean> {
    try {
      const result = await db.select({ id: knowledgeNodes.id })
        .from(knowledgeNodes)
        .where(sql`properties->>'url' = ${url}`)
        .limit(1);
      
      return result.length > 0;
    } catch {
      return false;
    }
  }

  // ================================
  // Manual Trigger
  // ================================

  /**
   * Manually trigger a fetch for a specific source
   */
  async triggerFetch(sourceId: string): Promise<ScrapingResult | null> {
    const source = this.sources.get(sourceId);
    if (!source) {
      console.error(`[RegulatoryScraper] Source not found: ${sourceId}`);
      return null;
    }

    return this.fetchSource(source);
  }

  /**
   * Get scraping status
   */
  getStatus(): {
    isRunning: boolean;
    sources: Array<{
      id: string;
      name: string;
      jurisdiction: string;
      enabled: boolean;
      lastFetched?: Date;
      nextFetch?: Date;
    }>;
  } {
    return {
      isRunning: this.isRunning,
      sources: this.getSources().map(s => ({
        id: s.id,
        name: s.name,
        jurisdiction: s.jurisdiction,
        enabled: s.enabled,
        lastFetched: s.lastFetched,
        nextFetch: s.lastFetched 
          ? new Date(s.lastFetched.getTime() + s.fetchIntervalHours * 60 * 60 * 1000)
          : undefined,
      })),
    };
  }
}

// ================================
// Singleton Export
// ================================

export const regulatoryScraper = new RegulatoryScraperService();
export default regulatoryScraper;

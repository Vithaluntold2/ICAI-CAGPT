/**
 * Regulatory Intelligence Service
 * Uses Perplexity AI for real-time regulatory monitoring
 * NO FALLBACKS - Perplexity is required for regulatory intelligence
 */

import { db } from '../db';
import { regulatoryAlerts } from '@shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';

export interface RegulatoryUpdate {
  title: string;
  summary: string;
  source: string;
  jurisdiction: string;
  alertType: 'new_regulation' | 'amendment' | 'deadline' | 'guidance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  effectiveDate?: Date;
  externalUrl?: string;
  tags: string[];
}

export interface MonitoringConfig {
  jurisdictions: string[];
  topics: string[];
  frequency: 'hourly' | 'daily' | 'weekly';
}

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

function requirePerplexity() {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY required for regulatory intelligence - no fallbacks');
  }
  return PERPLEXITY_API_KEY;
}

/**
 * Query Perplexity for regulatory updates
 */
async function queryPerplexity(query: string): Promise<string> {
  const apiKey = requirePerplexity();
  
  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online', // Real-time web search
      messages: [
        {
          role: 'system',
          content: `You are a regulatory intelligence analyst specializing in tax, accounting, and financial regulations.
                   Provide concise, factual updates about regulatory changes.
                   Always include:
                   - Source (IRS, FASB, HMRC, GST Council, etc.)
                   - Effective date if known
                   - Brief summary of the change
                   - Severity level (low/medium/high/critical)
                   
                   Format each update as JSON with these fields:
                   { "title", "summary", "source", "effectiveDate", "severity", "url" }`
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for factual responses
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Parse Perplexity response into structured updates
 */
function parseRegulatoryUpdates(content: string, jurisdiction: string): RegulatoryUpdate[] {
  const updates: RegulatoryUpdate[] = [];
  
  // Try to parse JSON objects from the response
  const jsonMatches = content.match(/\{[^{}]*\}/g);
  
  if (jsonMatches) {
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);
        updates.push({
          title: parsed.title || 'Regulatory Update',
          summary: parsed.summary || parsed.description || '',
          source: parsed.source || 'Unknown',
          jurisdiction,
          alertType: determineAlertType(parsed.title || '', parsed.summary || ''),
          severity: (parsed.severity || 'medium').toLowerCase() as any,
          effectiveDate: parsed.effectiveDate ? new Date(parsed.effectiveDate) : undefined,
          externalUrl: parsed.url || parsed.link,
          tags: extractTags(parsed.summary || ''),
        });
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
  
  // If no JSON found, try to extract from plain text
  if (updates.length === 0 && content.length > 50) {
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    for (const line of lines.slice(0, 5)) { // Max 5 updates
      if (line.includes('IRS') || line.includes('FASB') || line.includes('GST') || 
          line.includes('HMRC') || line.includes('regulation') || line.includes('tax')) {
        updates.push({
          title: line.substring(0, 100),
          summary: line,
          source: extractSource(line),
          jurisdiction,
          alertType: determineAlertType(line, ''),
          severity: 'medium',
          tags: extractTags(line),
        });
      }
    }
  }
  
  return updates;
}

function determineAlertType(title: string, summary: string): RegulatoryUpdate['alertType'] {
  const text = (title + ' ' + summary).toLowerCase();
  if (text.includes('deadline') || text.includes('due date') || text.includes('filing')) {
    return 'deadline';
  }
  if (text.includes('amend') || text.includes('update') || text.includes('change')) {
    return 'amendment';
  }
  if (text.includes('guidance') || text.includes('clarification') || text.includes('faq')) {
    return 'guidance';
  }
  return 'new_regulation';
}

function extractSource(text: string): string {
  const sources = [
    { pattern: /IRS/i, name: 'IRS' },
    { pattern: /FASB/i, name: 'FASB' },
    { pattern: /IASB|IFRS/i, name: 'IASB' },
    { pattern: /HMRC/i, name: 'HMRC' },
    { pattern: /GST\s*Council/i, name: 'GST Council' },
    { pattern: /CBDT/i, name: 'CBDT' },
    { pattern: /SEC/i, name: 'SEC' },
    { pattern: /PCAOB/i, name: 'PCAOB' },
    { pattern: /Treasury/i, name: 'Treasury' },
    { pattern: /EU\s*Commission/i, name: 'EU Commission' },
  ];
  
  for (const source of sources) {
    if (source.pattern.test(text)) {
      return source.name;
    }
  }
  return 'Regulatory Authority';
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const tagPatterns = [
    { pattern: /income\s*tax/i, tag: 'income-tax' },
    { pattern: /corporate\s*tax/i, tag: 'corporate-tax' },
    { pattern: /GST|VAT/i, tag: 'indirect-tax' },
    { pattern: /TDS|withholding/i, tag: 'withholding-tax' },
    { pattern: /transfer\s*pricing/i, tag: 'transfer-pricing' },
    { pattern: /audit/i, tag: 'audit' },
    { pattern: /GAAP|IFRS/i, tag: 'accounting-standards' },
    { pattern: /filing|return/i, tag: 'compliance' },
    { pattern: /penalty|fine/i, tag: 'penalties' },
    { pattern: /crypto|digital\s*asset/i, tag: 'crypto' },
  ];
  
  for (const { pattern, tag } of tagPatterns) {
    if (pattern.test(text)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Regulatory Intelligence Service
 */
export class RegulatoryIntelligenceService {
  /**
   * Scan for regulatory updates in a jurisdiction
   */
  static async scanJurisdiction(jurisdiction: string): Promise<RegulatoryUpdate[]> {
    const queries: Record<string, string> = {
      'US': 'Latest IRS tax updates, FASB accounting standards changes, SEC regulations in the last 7 days',
      'IN': 'Latest Indian GST updates, CBDT notifications, Income Tax changes, RBI circulars in the last 7 days',
      'UK': 'Latest HMRC updates, UK tax changes, FRC accounting standards in the last 7 days',
      'EU': 'Latest EU VAT updates, IASB/IFRS changes, EU financial regulations in the last 7 days',
      'AU': 'Latest ATO tax updates, Australian accounting standards changes in the last 7 days',
      'SG': 'Latest IRAS Singapore tax updates, ACRA changes in the last 7 days',
      'AE': 'Latest UAE corporate tax updates, FTA announcements in the last 7 days',
      'SA': 'Latest Saudi ZATCA updates, KSA tax regulations in the last 7 days',
    };
    
    const query = queries[jurisdiction.toUpperCase()] || 
      `Latest tax and accounting regulatory updates for ${jurisdiction} in the last 7 days`;
    
    console.log(`[RegulatoryIntel] Scanning ${jurisdiction}: ${query}`);
    
    const response = await queryPerplexity(query);
    const updates = parseRegulatoryUpdates(response, jurisdiction);
    
    // Store updates in database
    for (const update of updates) {
      await this.storeAlert(update, query);
    }
    
    console.log(`[RegulatoryIntel] Found ${updates.length} updates for ${jurisdiction}`);
    return updates;
  }

  /**
   * Run full regulatory scan for all configured jurisdictions
   */
  static async runFullScan(jurisdictions: string[] = ['US', 'IN', 'UK', 'EU']): Promise<{
    total: number;
    byJurisdiction: Record<string, number>;
    critical: number;
  }> {
    const results: Record<string, number> = {};
    let total = 0;
    let critical = 0;
    
    for (const jurisdiction of jurisdictions) {
      try {
        const updates = await this.scanJurisdiction(jurisdiction);
        results[jurisdiction] = updates.length;
        total += updates.length;
        critical += updates.filter(u => u.severity === 'critical').length;
        
        // Rate limit between jurisdictions
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[RegulatoryIntel] Failed to scan ${jurisdiction}:`, error);
        results[jurisdiction] = 0;
      }
    }
    
    return {
      total,
      byJurisdiction: results,
      critical
    };
  }

  /**
   * Search for specific regulatory topic
   */
  static async searchTopic(topic: string, jurisdiction?: string): Promise<RegulatoryUpdate[]> {
    const jurisdictionClause = jurisdiction ? ` in ${jurisdiction}` : '';
    const query = `Latest regulatory updates about ${topic}${jurisdictionClause}. Include any recent IRS, FASB, HMRC, GST Council announcements.`;
    
    console.log(`[RegulatoryIntel] Topic search: ${query}`);
    
    const response = await queryPerplexity(query);
    return parseRegulatoryUpdates(response, jurisdiction || 'GLOBAL');
  }

  /**
   * Get deadline alerts for upcoming compliance dates
   */
  static async getUpcomingDeadlines(jurisdiction: string, daysAhead: number = 30): Promise<RegulatoryUpdate[]> {
    const query = `Tax and regulatory filing deadlines coming up in the next ${daysAhead} days for ${jurisdiction}. Include IRS, state tax, GST, corporate filings.`;
    
    console.log(`[RegulatoryIntel] Deadline scan: ${query}`);
    
    const response = await queryPerplexity(query);
    const updates = parseRegulatoryUpdates(response, jurisdiction);
    
    // Filter to only deadline-type alerts
    return updates.filter(u => u.alertType === 'deadline');
  }

  /**
   * Store alert in database
   */
  private static async storeAlert(update: RegulatoryUpdate, query: string): Promise<void> {
    try {
      await db.insert(regulatoryAlerts).values({
        title: update.title,
        summary: update.summary,
        source: update.source,
        jurisdiction: update.jurisdiction,
        alertType: update.alertType,
        severity: update.severity,
        effectiveDate: update.effectiveDate,
        externalUrl: update.externalUrl,
        perplexityQuery: query,
        tags: update.tags,
      });
    } catch (error) {
      // Ignore duplicate errors
      console.log(`[RegulatoryIntel] Alert may already exist: ${update.title.substring(0, 50)}`);
    }
  }

  /**
   * Get recent alerts from database
   */
  static async getRecentAlerts(options?: {
    jurisdiction?: string;
    severity?: string;
    alertType?: string;
    days?: number;
    limit?: number;
  }): Promise<typeof regulatoryAlerts.$inferSelect[]> {
    const conditions: any[] = [];
    
    if (options?.jurisdiction) {
      conditions.push(eq(regulatoryAlerts.jurisdiction, options.jurisdiction));
    }
    
    if (options?.severity) {
      conditions.push(eq(regulatoryAlerts.severity, options.severity));
    }
    
    if (options?.alertType) {
      conditions.push(eq(regulatoryAlerts.alertType, options.alertType));
    }
    
    if (options?.days) {
      const since = new Date();
      since.setDate(since.getDate() - options.days);
      conditions.push(gte(regulatoryAlerts.createdAt, since));
    }
    
    const query = db
      .select()
      .from(regulatoryAlerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(regulatoryAlerts.createdAt))
      .limit(options?.limit || 50);
    
    return await query;
  }

  /**
   * Get critical alerts that need attention
   */
  static async getCriticalAlerts(): Promise<typeof regulatoryAlerts.$inferSelect[]> {
    return this.getRecentAlerts({
      severity: 'critical',
      days: 7,
      limit: 20
    });
  }

  /**
   * Check if Perplexity is configured
   */
  static isConfigured(): boolean {
    return !!PERPLEXITY_API_KEY;
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      requirePerplexity();
      // Quick test query
      await queryPerplexity('Test query - respond with OK');
      return { healthy: true, message: 'Perplexity API connected' };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const regulatoryIntelligence = RegulatoryIntelligenceService;

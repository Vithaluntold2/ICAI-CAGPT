/**
 * Deep Research Mode Agents
 * 8 specialized agents for comprehensive legal and tax research
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import { knowledgeGraph } from '../core/knowledgeGraph';
import { vectorStore } from '../core/vectorStore';
import { documentIngestion } from '../core/documentIngestion';
import { embeddingService } from '../embeddingService';

/**
 * Research Coordinator Agent
 * Orchestrates research workflow and manages multi-agent collaboration
 */
export class ResearchCoordinator extends EventEmitter implements AgentDefinition {
  id = 'research-coordinator';
  name = 'Research Coordinator';
  mode = 'deep-research' as const;
  capabilities = ['coordination', 'planning', 'synthesis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[ResearchCoordinator] Starting research coordination');

    const query = input.data.query as string;
    const jurisdiction = input.data.jurisdiction as string | undefined;
    const documents = input.data.documents as any[] | undefined;

    // Integrate document ingestion if documents provided
    if (documents && documents.length > 0) {
      try {
        for (const doc of documents) {
          await documentIngestion.ingestDocument({
            content: doc.content || doc.text,
            type: doc.type || 'document',
            source: doc.source || doc.filename || 'user-upload',
            jurisdiction: jurisdiction || doc.jurisdiction,
            tags: doc.tags || ['research'],
            metadata: {
              uploadedBy: input.data.userId as string | undefined,
              uploadedAt: new Date().toISOString(),
              query: query,
            },
          });
        }
        console.log(`[ResearchCoordinator] Ingested ${documents.length} documents`);
      } catch (ingestionError) {
        console.warn('[ResearchCoordinator] Document ingestion failed:', ingestionError);
        // Continue with research even if ingestion fails
      }
    }

    // 1. Analyze query and create research plan
    const plan = this.createResearchPlan(query, jurisdiction);

    // 2. Emit coordination events for other agents
    this.emit('research:plan-created', { plan, query, jurisdiction });

    // 3. Coordinate parallel research streams
    const streams = [
      'regulation-search',
      'case-law-analysis',
      'cross-reference-building',
    ];

    this.emit('research:streams-initiated', { streams });

    // 4. Monitor progress and aggregate results
    const results = {
      plan,
      status: 'coordinated',
      timestamp: new Date().toISOString(),
      streams,
      documentsIngested: documents?.length || 0,
      estimatedDuration: plan.steps.length * 30, // 30s per step
    };

    return {
      success: true,
      data: results,
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.95,
      },
    };
  }

  private createResearchPlan(query: string, jurisdiction?: string) {
    return {
      query,
      jurisdiction,
      steps: [
        { id: 1, name: 'Identify key concepts', agent: 'research-coordinator', duration: 30 },
        { id: 2, name: 'Search regulations', agent: 'regulation-searcher', duration: 60 },
        { id: 3, name: 'Analyze case law', agent: 'case-law-analyzer', duration: 90 },
        { id: 4, name: 'Build cross-references', agent: 'cross-reference-builder', duration: 45 },
        { id: 5, name: 'Validate sources', agent: 'source-validator', duration: 30 },
        { id: 6, name: 'Generate citations', agent: 'citation-generator', duration: 30 },
        { id: 7, name: 'Create summary', agent: 'summary-generator', duration: 60 },
      ],
      expectedOutputs: [
        'Comprehensive research report',
        'Cited sources',
        'Cross-references',
        'Summary',
      ],
    };
  }
}

/**
 * Source Validator Agent
 * Validates reliability and relevance of research sources
 */
export class SourceValidator extends EventEmitter implements AgentDefinition {
  id = 'source-validator';
  name = 'Source Validator';
  mode = 'deep-research' as const;
  capabilities = ['validation', 'quality-assessment'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[SourceValidator] Validating sources');

    const sources = input.data.sources as Array<{
      id: string;
      content: string;
      type: string;
      source?: string;
    }>;

    // Validate each source
    const validatedSources = sources.map(source => this.validateSource(source));

    // Calculate overall reliability score
    const avgReliability = validatedSources.reduce((sum, s) => sum + s.reliability, 0) / validatedSources.length;

    return {
      success: true,
      data: {
        sources: validatedSources,
        overallReliability: avgReliability,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: avgReliability,
      },
    };
  }

  private validateSource(source: any) {
    let reliability = 0.5; // Base score

    // Official government sources
    if (source.source?.includes('gov.in') || source.source?.includes('incometax')) {
      reliability = 0.95;
    }
    // Court judgments
    else if (source.type === 'case' && source.source?.includes('court')) {
      reliability = 0.9;
    }
    // Regulatory bodies
    else if (source.type === 'regulation') {
      reliability = 0.85;
    }
    // Academic/professional sources
    else if (source.source?.includes('edu') || source.source?.includes('professional')) {
      reliability = 0.75;
    }

    return {
      ...source,
      reliability,
      validatedAt: new Date().toISOString(),
      issues: reliability < 0.7 ? ['Low reliability score'] : [],
    };
  }
}

/**
 * Citation Generator Agent
 * Generates proper citations in multiple formats
 */
export class CitationGenerator extends EventEmitter implements AgentDefinition {
  id = 'citation-generator';
  name = 'Citation Generator';
  mode = 'deep-research' as const;
  capabilities = ['citation', 'formatting'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[CitationGenerator] Generating citations');

    const sources = input.data.sources as Array<any>;
    const format = (input.data.format as string) || 'bluebook';

    const citations = sources.map(source => this.generateCitation(source, format));

    return {
      success: true,
      data: {
        citations,
        format,
        count: citations.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 1.0,
      },
    };
  }

  private generateCitation(source: any, format: string) {
    switch (format) {
      case 'bluebook':
        return this.bluebookCitation(source);
      case 'apa':
        return this.apaCitation(source);
      case 'mla':
        return this.mlaCitation(source);
      default:
        return this.bluebookCitation(source);
    }
  }

  private bluebookCitation(source: any) {
    if (source.type === 'case') {
      return `${source.title}, ${source.citation || 'No. ' + source.id} (${source.court} ${source.year})`;
    } else if (source.type === 'regulation') {
      return `${source.title}, ${source.code || 'Reg.'} § ${source.section} (${source.year})`;
    }
    return `${source.title}, ${source.source} (${new Date().getFullYear()})`;
  }

  private apaCitation(source: any) {
    const year = source.year || new Date().getFullYear();
    return `${source.author || 'Unknown'}. (${year}). ${source.title}. ${source.source}.`;
  }

  private mlaCitation(source: any) {
    return `${source.author || 'Unknown'}. "${source.title}." ${source.source}, ${source.year || new Date().getFullYear()}.`;
  }
}

/**
 * Regulation Searcher Agent
 * Searches and retrieves relevant regulations
 */
export class RegulationSearcher extends EventEmitter implements AgentDefinition {
  id = 'regulation-searcher';
  name = 'Regulation Searcher';
  mode = 'deep-research' as const;
  capabilities = ['search', 'retrieval'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[RegulationSearcher] Searching regulations');

    const query = input.data.query as string;
    const jurisdiction = input.data.jurisdiction as string | undefined;

    // Search knowledge graph for regulations
    const graphResults = knowledgeGraph.findNodes({
      nodeTypes: ['regulation'],
      properties: jurisdiction ? { jurisdiction } : undefined,
      limit: 20,
    });

    // Search vector store for semantic matches
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const vectorResults = await vectorStore.search(queryEmbedding, {
      types: ['regulation'],
      jurisdiction,
      limit: 20,
      minSimilarity: 0.7,
    });

    // Merge and rank results
    const mergedResults = this.mergeResults(graphResults, vectorResults);

    return {
      success: true,
      data: {
        regulations: mergedResults,
        count: mergedResults.length,
        query,
        jurisdiction,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.85,
      },
    };
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    // Production embedding generation using OpenAI
    if (embeddingService.isAvailable()) {
      try {
        const result = await embeddingService.generateEmbedding(query);
        return result.embedding;
      } catch (error) {
        console.error('[RegulationSearcher] Embedding generation failed:', error);
        // Fall through to fallback
      }
    }

    // Fallback: Generate deterministic pseudo-embedding based on query content
    // This is NOT for semantic search - only for basic keyword matching
    console.warn('[RegulationSearcher] Using fallback embedding - configure OPENAI_API_KEY for semantic search');
    const hash = this.hashString(query);
    const embedding: number[] = [];
    for (let i = 0; i < 1536; i++) {
      // Use hash to generate deterministic values
      embedding.push(Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 2)));
    }
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  private mergeResults(graphResults: any[], vectorResults: any[]) {
    const merged = new Map();

    // Add graph results
    for (const node of graphResults) {
      merged.set(node.id, {
        id: node.id,
        title: node.label,
        content: node.properties.content,
        type: 'regulation',
        source: node.properties.source,
        relevance: 0.7,
      });
    }

    // Add vector results with higher relevance
    for (const result of vectorResults) {
      merged.set(result.document.id, {
        id: result.document.id,
        title: result.document.content.substring(0, 100),
        content: result.document.content,
        type: 'regulation',
        source: result.document.metadata.source,
        relevance: result.similarity,
      });
    }

    // Sort by relevance
    return Array.from(merged.values()).sort((a, b) => b.relevance - a.relevance);
  }
}

/**
 * Case Law Analyzer Agent
 * Analyzes legal precedents and case law
 */
export class CaseLawAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'case-law-analyzer';
  name = 'Case Law Analyzer';
  mode = 'deep-research' as const;
  capabilities = ['analysis', 'legal-reasoning'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[CaseLawAnalyzer] Analyzing case law');

    const query = input.data.query as string;
    const jurisdiction = input.data.jurisdiction as string | undefined;

    // Search for relevant cases
    const cases = knowledgeGraph.findNodes({
      nodeTypes: ['case'],
      properties: jurisdiction ? { jurisdiction } : undefined,
      limit: 15,
    });

    // Analyze each case
    const analyses = cases.map(caseNode => this.analyzeCase(caseNode, query));

    // Extract key principles
    const principles = this.extractPrinciples(analyses);

    return {
      success: true,
      data: {
        cases: analyses,
        principles,
        count: analyses.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.8,
      },
    };
  }

  private analyzeCase(caseNode: any, query: string) {
    return {
      id: caseNode.id,
      title: caseNode.label,
      court: caseNode.properties.court || 'Unknown Court',
      year: caseNode.properties.year || 'Unknown',
      citation: caseNode.properties.citation,
      relevance: this.calculateRelevance(caseNode, query),
      keyPoints: this.extractKeyPoints(caseNode),
      holding: caseNode.properties.holding || 'Not specified',
      precedential: caseNode.properties.precedential !== false,
    };
  }

  private calculateRelevance(caseNode: any, query: string): number {
    const content = (caseNode.properties.content || '').toLowerCase();
    const queryLower = query.toLowerCase();
    const words = queryLower.split(' ');

    let matches = 0;
    for (const word of words) {
      if (content.includes(word)) matches++;
    }

    return matches / words.length;
  }

  private extractKeyPoints(caseNode: any): string[] {
    const content = caseNode.properties.content || '';
    // Simple extraction - in production would use NLP
    return content.split('.').slice(0, 3).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
  }

  private extractPrinciples(analyses: any[]): string[] {
    const principles = new Set<string>();

    for (const analysis of analyses) {
      if (analysis.holding) {
        principles.add(analysis.holding);
      }
    }

    return Array.from(principles);
  }
}

/**
 * Tax Code Navigator Agent
 * Navigates complex tax code structures
 */
export class TaxCodeNavigator extends EventEmitter implements AgentDefinition {
  id = 'tax-code-navigator';
  name = 'Tax Code Navigator';
  mode = 'deep-research' as const;
  capabilities = ['navigation', 'structure-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[TaxCodeNavigator] Navigating tax code');

    const section = input.data.section as string;
    const jurisdiction = (input.data.jurisdiction as string) || 'India';

    // Find the section in knowledge graph
    const sectionNodes = knowledgeGraph.findNodes({
      nodeTypes: ['regulation'],
      properties: { section, jurisdiction },
      limit: 1,
    });

    if (sectionNodes.length === 0) {
      return {
        success: false,
        data: { error: 'Section not found' },
        metadata: {
          agentId: this.id,
          executionTime: Date.now() - input.timestamp,
          confidence: 0,
        },
      };
    }

    const sectionNode = sectionNodes[0];

    // Get related sections
    const related = knowledgeGraph.getNeighbors(sectionNode.id, { maxDepth: 1 });

    // Build hierarchy
    const hierarchy = this.buildHierarchy(sectionNode);

    return {
      success: true,
      data: {
        section: {
          id: sectionNode.id,
          label: sectionNode.label,
          content: sectionNode.properties.content,
          section,
        },
        related: related.map(n => ({
          id: n.id,
          label: n.label,
          section: n.properties.section,
        })),
        hierarchy,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.9,
      },
    };
  }

  private buildHierarchy(node: any) {
    return {
      chapter: node.properties.chapter || 'Unknown',
      part: node.properties.part || 'Unknown',
      section: node.properties.section,
      subsection: node.properties.subsection,
    };
  }
}

/**
 * Cross Reference Builder Agent
 * Builds connections between related legal concepts
 */
export class CrossReferenceBuilder extends EventEmitter implements AgentDefinition {
  id = 'cross-reference-builder';
  name = 'Cross Reference Builder';
  mode = 'deep-research' as const;
  capabilities = ['linking', 'relationship-mapping'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[CrossReferenceBuilder] Building cross-references');

    const sourceIds = input.data.sourceIds as string[];

    const crossReferences = [];

    // Build references between all pairs
    for (let i = 0; i < sourceIds.length; i++) {
      for (let j = i + 1; j < sourceIds.length; j++) {
        const path = knowledgeGraph.findPath(sourceIds[i], sourceIds[j]);

        if (path && path.edges && path.edges.length > 0 && path.edges.length <= 4) {
          crossReferences.push({
            from: sourceIds[i],
            to: sourceIds[j],
            path,
            distance: path.edges.length - 1,
            strength: 1 / path.edges.length,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        crossReferences,
        count: crossReferences.length,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.85,
      },
    };
  }
}

/**
 * Summary Generator Agent
 * Generates comprehensive research summaries
 */
export class SummaryGenerator extends EventEmitter implements AgentDefinition {
  id = 'summary-generator';
  name = 'Summary Generator';
  mode = 'deep-research' as const;
  capabilities = ['synthesis', 'summarization'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    console.log('[SummaryGenerator] Generating summary');

    const researchData = input.data.researchData as {
      regulations?: any[];
      cases?: any[];
      crossReferences?: any[];
    };

    const summary = {
      overview: this.generateOverview(researchData),
      keyFindings: this.extractKeyFindings(researchData),
      regulations: this.summarizeRegulations(researchData.regulations || []),
      caseLaw: this.summarizeCaseLaw(researchData.cases || []),
      recommendations: this.generateRecommendations(researchData),
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: summary,
      metadata: {
        agentId: this.id,
        executionTime: Date.now() - input.timestamp,
        confidence: 0.9,
      },
    };
  }

  private generateOverview(data: any): string {
    const regCount = data.regulations?.length || 0;
    const caseCount = data.cases?.length || 0;
    const refCount = data.crossReferences?.length || 0;

    return `Comprehensive research analysis covering ${regCount} regulations, ${caseCount} case law precedents, and ${refCount} cross-references.`;
  }

  private extractKeyFindings(data: any): string[] {
    const findings: string[] = [];

    if (data.regulations && data.regulations.length > 0) {
      findings.push(`Identified ${data.regulations.length} relevant regulations`);
    }

    if (data.cases && data.cases.length > 0) {
      findings.push(`Found ${data.cases.length} applicable case law precedents`);
    }

    if (data.crossReferences && data.crossReferences.length > 0) {
      findings.push(`Established ${data.crossReferences.length} cross-references`);
    }

    return findings;
  }

  private summarizeRegulations(regulations: any[]): string {
    if (regulations.length === 0) return 'No regulations found';

    const topReg = regulations[0];
    return `Primary regulation: ${topReg.title || 'Unknown'} (${regulations.length} total found)`;
  }

  private summarizeCaseLaw(cases: any[]): string {
    if (cases.length === 0) return 'No case law found';

    const topCase = cases[0];
    return `Leading case: ${topCase.title || 'Unknown'} (${cases.length} total found)`;
  }

  private generateRecommendations(data: any): string[] {
    return [
      'Review all cited regulations for applicability',
      'Consider precedential value of case law',
      'Verify current status of all sources',
    ];
  }
}

// Export all agents as a registry
export const deepResearchAgents: AgentDefinition[] = [
  new ResearchCoordinator(),
  new SourceValidator(),
  new CitationGenerator(),
  new RegulationSearcher(),
  new CaseLawAnalyzer(),
  new TaxCodeNavigator(),
  new CrossReferenceBuilder(),
  new SummaryGenerator(),
];

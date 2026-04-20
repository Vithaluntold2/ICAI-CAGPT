/**
 * AI Model Orchestrator
 * Coordinates multiple AI models and solvers to generate comprehensive responses
 * 
 * Enhanced with Advanced Reasoning Capabilities:
 * - Chain-of-thought reasoning for complex queries
 * - Multi-agent orchestration for specialized analysis
 * - Cognitive monitoring for quality assurance
 * - Parallel reasoning streams for efficiency
 */

import { queryTriageService, type QueryClassification, type RoutingDecision } from './queryTriage';
import { financialSolverService } from './financialSolvers';
import { calculationFormatter } from './calculationFormatter';
import { excelOrchestrator, type SpreadsheetPreviewData } from './excelOrchestrator';
import { excelModelGenerator } from './excel/excelModelGenerator';
import { aiProviderRegistry, AIProviderName, ProviderError, providerHealthMonitor } from './aiProviders';
// Using AI-driven clarification service (no hardcoded patterns)
import { requirementClarificationAIService, type ClarificationAnalysis } from './requirementClarificationAI';
import { documentAnalyzerAgent } from './agents/documentAnalyzer';
import { visualizationGenerator } from './visualizationGenerator';
import { promptBuilder } from './promptBuilder';
import type { VisualizationData } from '../../shared/types/visualization';
import { MindMapGenerator } from './mindmapGenerator';
import type { MindMapData } from '../../shared/types/mindmap';
import { calculateAICost } from '../utils/aiCostCalculator';
import { storage } from '../pgStorage';
// Advanced Reasoning imports (feature-flagged)
import { reasoningGovernor } from './reasoningGovernor';
import { complianceSentinel } from './complianceSentinel';
import { validationAgent } from './validationAgent';
import { normalizeChatMode, isCotMode } from './chatModeNormalizer';
// RAG Pipeline and Continuous Learning (superintelligence layer)
import { ragPipeline, type RAGResult } from './core/ragPipeline';
import { continuousLearning } from './core/continuousLearning';
import { conversationMemory } from './conversationMemory';
import type {
  EnhancedRoutingDecision,
  ReasoningMetadata,
  CognitiveMonitorResult
} from '../../shared/types/reasoning';
// Whiteboard integration (Phase 2.4)
import { randomUUID } from 'crypto';
import { buildArtifactsForMessage } from './whiteboard/extractPipeline';
import { listArtifactsByConversation } from './whiteboard/repository';
import { placeNext, type LayoutState } from './whiteboard/autoLayout';
import type { CreateArtifactInput } from './whiteboard/repository';
import type { SelectionInput } from './whiteboard/selectionPreamble';
import { formatManifest } from './whiteboard/manifest';
import { buildSelectionPreamble } from './whiteboard/selectionPreamble';
import { WHITEBOARD_USAGE_GUIDANCE } from './whiteboard/systemGuidance';
// Tool-calling (Phase 4.7)
import { completeWithToolLoop } from './aiOrchestrator.toolLoop';
import { isFeatureEnabled } from '../config/featureFlags';
import { toolRegistry } from './tools/registry';
import { toolsToAnthropicSchema } from './tools/adapters/anthropic';
import { toolsToOpenAISchema } from './tools/adapters/openai';
import type { CompletionResponse } from './aiProviders/types';

export type ResponseType = 'research' | 'analysis' | 'document' | 'calculation' | 'visualization' | 'export' | 'general';

export interface ResponseMetadata {
  responseType: ResponseType;
  showInOutputPane: boolean;
  hasDocument?: boolean;
  hasVisualization?: boolean;
  hasCalculation?: boolean;
  hasExport?: boolean;
  hasResearch?: boolean;
  classification: QueryClassification;
  calculationResults?: any;
  visualization?: VisualizationData;
  // Advanced reasoning metadata (feature-flagged)
  reasoning?: Partial<ReasoningMetadata>;
  cognitiveMonitoring?: CognitiveMonitorResult;
  qualityScore?: number;
}

export interface OrchestrationResult {
  response: string;
  modelUsed: string;
  routingDecision: RoutingDecision;
  classification: QueryClassification;
  calculationResults?: any;
  metadata: ResponseMetadata;
  clarificationAnalysis?: ClarificationAnalysis;
  needsClarification?: boolean;
  tokensUsed: number;
  processingTimeMs: number;
  // New content separation fields
  deliverableContent?: string; // Structured content for output pane
  reasoningContent?: string;   // Thought process for chat interface
  // Excel workbook for calculation mode
  excelWorkbook?: {
    buffer: Buffer;
    filename: string;
    summary: string;
  };
  // Spreadsheet preview data for UI display (includes formulas as text)
  spreadsheetData?: SpreadsheetPreviewData;
  // Whiteboard integration (Phase 2.4)
  whiteboardArtifacts?: Array<CreateArtifactInput & { id: string }>;
  whiteboardUpdatedContent?: string;
}

export interface AgentWorkflowResult {
  analysis?: string;
  suggestions?: string[];
  detectedEntities?: Record<string, any>;
  preProcessedData?: any;
  confidence?: number;
  [key: string]: any; // Allow extensibility
}

export interface ProcessQueryOptions {
  attachment?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    documentType?: string;
  };
  chatMode?: string;
  agentWorkflowResult?: AgentWorkflowResult;
  conversationId?: string;
  // Whiteboard integration (Phase 2.4)
  messageId?: string;
  selection?: SelectionInput;
  // Tool-calling context (Phase 4.7): required so ToolContext can be built
  // when the provider tool-call loop fires.
  userId?: string;
}

export class AIOrchestrator {
  /**
   * Main orchestration method - routes query through triage, models, and solvers
   * 
   * Now includes professional requirement clarification phase:
   * - Analyzes queries for missing context before providing answers
   * - Asks thoughtful clarifying questions like a real CPA/CA advisor
   * - Only provides answers when sufficient context is available
   */
  async processQuery(
    query: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userTier: string,
    userId?: string,
    options?: ProcessQueryOptions
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // Thread userId into options so downstream (callAIModel -> tool loop) can
    // build a ToolContext { conversationId, userId }. Keep the original
    // top-level `userId` arg for backward compatibility with other call sites.
    if (userId && options && !options.userId) {
      options = { ...options, userId };
    }

    // CRITICAL: Normalize chat mode early to ensure consistent naming throughout
    const chatMode = normalizeChatMode(options?.chatMode);
    
    // CRITICAL DEBUGGING: Log attachment status immediately
    console.log(`[Orchestrator] processQuery called with attachment:`, options?.attachment ? `YES (${options.attachment.filename})` : 'NO');
    
    // Step 1: Classify the query (with document attachment hint and conversation history for jurisdiction persistence)
    const context = {
      hasDocument: !!options?.attachment,
      documentType: options?.attachment?.documentType,
      conversationHistory: conversationHistory
    };
    const classification = queryTriageService.classifyQuery(query, context);
    
    // Log detected jurisdiction for debugging
    console.log(`[Orchestrator] Detected jurisdiction:`, classification.jurisdiction);
    
    // Step 2: Route to appropriate model and solvers
    const routingDecision = queryTriageService.routeQuery(classification, userTier, !!options?.attachment);
    
    // Step 2.5: ADVANCED REASONING - Enhance routing decision with reasoning profile
    // CRITICAL: CoT for Research/Calculate runs independently of full governor
    // This ensures quality improvement even when other features are disabled
    let enhancedRouting: EnhancedRoutingDecision | null = null;
    const cotMode = isCotMode(chatMode);
    
    if (reasoningGovernor.isEnabled() || cotMode) {
      enhancedRouting = reasoningGovernor.enhanceRoutingDecision(
        routingDecision,
        classification,
        chatMode,
        userTier
      );
      
      if (cotMode && !enhancedRouting.enableChainOfThought) {
        console.warn(`[AIOrchestrator] CoT expected for ${chatMode} but not enabled - check feature flags`);
      }
    }
    
    // PHASE 0: Requirement Clarification Analysis (INQUIRY-FIRST BEHAVIOR)
    // CRITICAL: CA GPT ALWAYS asks clarifying questions when context is missing
    // This applies to ALL modes including Deep Research - no assumptions allowed
    // Exception: Skip clarification if document is attached (answer is IN the document)
    let clarificationAnalysis: ClarificationAnalysis | undefined;

    // Check if this is a casual message (greeting, thanks, etc.)
    const isCasualMessage = classification.isCasualMessage === true;

    // If the user has explicitly attached a whiteboard selection (a pinned
    // artifact or a highlighted excerpt), ambiguity in the raw query text
    // ("what does this mean?", "which ones are left?") is already resolved
    // by the selection context that gets prepended as a preamble to the user
    // turn. Running the clarification analyzer in that case just looks at the
    // bare query and — not seeing the preamble — wrongly demands more input,
    // blocking the real answer.
    const hasSelection = !!options?.selection && (
      (Array.isArray(options.selection.artifactIds) && options.selection.artifactIds.length > 0) ||
      (typeof options.selection.highlightedText === 'string' && options.selection.highlightedText.trim().length > 0)
    );

    // Pronoun-only queries ("what does this mean?", "which are remaining?")
    // are ambiguous on their own but perfectly answerable when the whiteboard
    // has artifacts — the agent can resolve from the manifest. Skip the
    // clarifier in that case so it doesn't demand the user re-state what
    // they're clearly pointing at.
    const queryLooksLikeReference = /\b(this|that|these|those|it|them|here|above|below)\b/i.test(query || '');
    let hasArtifactsInConversation = false;
    if (!hasSelection && queryLooksLikeReference && options?.conversationId) {
      try {
        const prior = await listArtifactsByConversation(options.conversationId);
        hasArtifactsInConversation = prior.length > 0;
      } catch {
        // Best-effort — if we can't check, err toward bypass (user-friendlier)
        hasArtifactsInConversation = true;
      }
    }

    if (isCasualMessage) {
      // Skip all complex processing for casual messages
      console.log('[AIOrchestrator] Casual message detected - skipping clarification and research');
    } else if (hasSelection) {
      console.log('[AIOrchestrator] Selection context present — skipping clarification analyzer, proceeding direct to answer');
    } else if (queryLooksLikeReference && hasArtifactsInConversation) {
      console.log('[AIOrchestrator] Ambiguous pronoun query with artifacts present — skipping clarifier, letting agent resolve from manifest');
    } else if (!options?.attachment) {
      // INTERVIEW-FIRST PATTERN: Use AI-driven async analysis for accurate context detection
      // Check if the user has already answered interview questions in this conversation
      const alreadyInterviewed = this.hasCompletedInterview(conversationHistory);
      
      if (alreadyInterviewed) {
        // User already answered clarifying questions — proceed directly to answering
        console.log('[AIOrchestrator] Interview already completed in conversation history — proceeding to answer');
        // Still run analysis to extract detected context for prompt building
        clarificationAnalysis = requirementClarificationAIService.analyzeQuery(query, conversationHistory);
        // Override: don't re-ask
        if (clarificationAnalysis) {
          clarificationAnalysis.needsClarification = false;
          clarificationAnalysis.recommendedApproach = 'answer';
        }
      } else {
        // Use AI-powered async analysis (GPT-4o-mini chain-of-thought) for accurate detection.
        // The clarifier receives the conversationId so it can pull the memory
        // glossary + rolling summary and build a deterministic "DO NOT ASK
        // ABOUT" negative list from history — fixing context re-asks at the
        // source instead of post-filtering the model's output.
        try {
          clarificationAnalysis = await requirementClarificationAIService.analyzeQueryAsync(
            query,
            conversationHistory,
            options?.conversationId,
          );
          console.log(`[AIOrchestrator] AI clarification analysis: needsClarification=${clarificationAnalysis.needsClarification}, approach=${clarificationAnalysis.recommendedApproach}, missing=${clarificationAnalysis.missingContext.length} items`);
        } catch (err) {
          console.error('[AIOrchestrator] AI clarification analysis failed, falling back to heuristic:', err);
          clarificationAnalysis = requirementClarificationAIService.analyzeQuery(query, conversationHistory);
        }
      }

      // INQUIRY-FIRST: Always clarify when critical/high context is missing
      // This applies to ALL modes including Deep Research
      // We don't make assumptions about jurisdiction, entity type, etc.
      const shouldClarify = (
        clarificationAnalysis.needsClarification &&
        clarificationAnalysis.recommendedApproach === 'clarify' &&
        clarificationAnalysis.missingContext.some(m =>
          m.importance === 'critical' || m.importance === 'high'
        )
      );
      
      if (shouldClarify) {
        const questions = requirementClarificationAIService.generateClarifyingQuestions(
          clarificationAnalysis
        );
        
        const clarificationResponse = this.buildClarificationResponse(
          questions,
          clarificationAnalysis,
          chatMode
        );
        
        const processingTimeMs = Date.now() - startTime;
        
        // ALL professional modes show clarification in Output Pane
        const isProfessionalMode = chatMode !== 'standard';
        
        return {
          response: clarificationResponse,
          modelUsed: 'clarification',
          routingDecision,
          classification,
          metadata: {
            responseType: 'general',
            showInOutputPane: isProfessionalMode,
            classification,
            calculationResults: undefined
          },
          clarificationAnalysis,
          needsClarification: true,
          tokensUsed: 0,
          processingTimeMs
        };
      }
    }
    
    // PHASE 1: Document Analysis (if attachment present)
    // Extract text from attached documents and enrich the query
    let enrichedQuery = query;
    let documentAnalysis: any = null;
    
    if (options?.attachment) {
      console.log(`[Orchestrator] Analyzing attached document: ${options.attachment.filename}`);
      
      try {
        const analysisResult = await documentAnalyzerAgent.analyzeDocument(
          options.attachment.buffer,
          options.attachment.filename,
          options.attachment.mimeType
        );
        
        // FIXED: Always use analysis result even if success=false, as long as we have extracted text
        if (analysisResult.analysis.extractedText) {
          documentAnalysis = analysisResult.analysis;
          
          // Enrich the query with extracted document text
          enrichedQuery = `${query}\n\n--- Document Content (${options.attachment.filename}) ---\n${analysisResult.analysis.extractedText}`;
          
          console.log(`[Orchestrator] Document analyzed (${analysisResult.provider}). Extracted ${analysisResult.analysis.extractedText.length} characters`);
          
          // Log if analysis had warnings
          if (analysisResult.error) {
            console.warn(`[Orchestrator] Document analysis warning: ${analysisResult.error}`);
          }
        } else {
          // No text extracted at all - inform the AI
          console.error(`[Orchestrator] Document analysis failed completely: ${analysisResult.error || 'Unknown error'}`);
          enrichedQuery = `${query}\n\n[System Note: User attached a file "${options.attachment.filename}" but text extraction failed. Error: ${analysisResult.error}. Please acknowledge the file attachment and ask the user to describe the content or try a different format.]`;
        }
      } catch (error) {
        console.error('[Orchestrator] Error analyzing document:', error);
        // FIXED: Inform the AI about the failure instead of silent fallback
        enrichedQuery = `${query}\n\n[System Note: User attached a file "${options.attachment.filename}" but an error occurred during analysis: ${error.message}. Please acknowledge the file attachment and ask the user to describe the content.]`;
      }
    }
    
    // Step 3: Execute any needed calculations/solvers
    const calculationResults = await this.executeCalculations(enrichedQuery, classification, routingDecision);
    
    // Step 3.5: Generate Excel workbook 
    // Two modes: 
    // 1. AI-Driven Model Generation: For complex model requests (DCF, LBO, budget, etc.)
    // 2. Calculation Mode: For simple financial calculations with Excel output
    let excelWorkbook: any = null;
    let spreadsheetPreviewData: SpreadsheetPreviewData | undefined;
    
    // Check if this is an AI-driven Excel model request
    const isExcelModelRequest = excelModelGenerator.isExcelRequest(enrichedQuery);
    console.log('[Orchestrator] Excel detection check:', {
      query: enrichedQuery.slice(0, 100),
      isExcelModelRequest
    });
    
    if (isExcelModelRequest) {
      try {
        console.log('[Orchestrator] Detected Excel model request - using AI-driven generator...');
        const modelType = excelModelGenerator.getModelType(enrichedQuery);
        console.log('[Orchestrator] Model type detected:', modelType);
        
        const result = await excelModelGenerator.generate({
          userQuery: enrichedQuery,
          modelType,
          conversationHistory: conversationHistory.map(h => ({ role: h.role, content: h.content })),
          preferences: {
            excelVersion: '365',
            protectFormulas: true,
            includeCharts: true
          }
        }, {
          singleStage: modelType === 'custom', // Use multi-stage for known model types
          validateOutput: true
        });
        
        if (result.success && result.workbook) {
          excelWorkbook = {
            buffer: result.workbook,
            formulasUsed: [],
            summary: result.summary || 'AI-generated Excel model with dynamic formulas',
            stats: result.stats
          };
          // Extract spreadsheet preview data if workbook object is available
          if (result.workbookObject) {
            try {
              spreadsheetPreviewData = excelOrchestrator.extractSpreadsheetPreview(result.workbookObject);
              console.log('[Orchestrator] Spreadsheet preview extracted with formulas');
            } catch (e) {
              console.warn('[Orchestrator] Failed to extract spreadsheet preview:', e);
            }
          }
          console.log('[Orchestrator] AI-driven Excel model generated:', result.stats);
        } else {
          console.warn('[Orchestrator] AI Excel generation failed, falling back to legacy:', result.errors);
          // Fall back to legacy generator — but ONLY if the heuristic parser
          // actually detected something to generate. `parseUserRequest` uses
          // regex pattern matching (DCF / NPV / tax / depreciation / etc.);
          // queries that don't match any pattern produce an empty request and
          // `createCalculationWorkbook` would write just the banner header
          // with zero calculation content. That banner-only xlfx then gets
          // cached and served on download — hence the "only green banner,
          // no content" bug. If there's nothing to generate, let the AI's
          // ```sheet``` block path (metadata.spreadsheetData) own the export.
          const spreadsheetRequest = await excelOrchestrator.parseUserRequest(enrichedQuery, undefined);
          const hasRequestContent =
            (spreadsheetRequest.calculations?.length ?? 0) > 0
            || (spreadsheetRequest.tables?.length ?? 0) > 0
            || (spreadsheetRequest.formulas?.length ?? 0) > 0
            || (spreadsheetRequest.data?.length ?? 0) > 0;
          if (hasRequestContent) {
            excelWorkbook = await excelOrchestrator.createCalculationWorkbook(spreadsheetRequest);
            if (excelWorkbook.workbook) {
              try {
                spreadsheetPreviewData = excelOrchestrator.extractSpreadsheetPreview(excelWorkbook.workbook);
              } catch (e) {
                console.warn('[Orchestrator] Failed to extract spreadsheet preview:', e);
              }
            }
          } else {
            console.log('[Orchestrator] Skipping legacy xlsx — empty request, AI sheet blocks will handle download');
          }
        }
      } catch (error) {
        console.error('[Orchestrator] Excel model generation failed:', error);
        // Don't fail the request if Excel generation fails
      }
    } 
    // Legacy calculation mode Excel generation
    // FIX: Allow Excel generation if triage detected calculation needs, even if chat mode wasn't explicitly set
    else if ((chatMode === 'calculation' || classification.requiresCalculation) && calculationResults && Object.keys(calculationResults).length > 0) {
      try {
        console.log('[Orchestrator] Generating Excel workbook for calculation mode...');
        const spreadsheetRequest = await excelOrchestrator.parseUserRequest(enrichedQuery, undefined);
        
        // Add detected calculations to the request
        if (calculationResults.taxCalculation) {
          spreadsheetRequest.calculations?.push({
            type: 'tax',
            inputs: calculationResults.taxCalculation,
            outputLocation: 'B2'
          });
        }
        if (calculationResults.npv !== undefined) {
          spreadsheetRequest.calculations?.push({
            type: 'npv',
            inputs: calculationResults,
            outputLocation: 'B20'
          });
        }
        if (calculationResults.irr !== undefined) {
          spreadsheetRequest.calculations?.push({
            type: 'irr',
            inputs: calculationResults,
            outputLocation: 'B35'
          });
        }
        if (calculationResults.depreciation) {
          spreadsheetRequest.calculations?.push({
            type: 'depreciation',
            inputs: calculationResults.depreciation,
            outputLocation: 'B50'
          });
        }
        if (calculationResults.amortization) {
          spreadsheetRequest.calculations?.push({
            type: 'amortization',
            inputs: calculationResults.amortization,
            outputLocation: 'B80'
          });
        }

        // Only build the legacy xlsx if the merged request has something to
        // render. Without this, queries that triggered calculation-mode but
        // didn't populate a recognised calc type yield a banner-only file.
        const hasRequestContent =
          (spreadsheetRequest.calculations?.length ?? 0) > 0
          || (spreadsheetRequest.tables?.length ?? 0) > 0
          || (spreadsheetRequest.formulas?.length ?? 0) > 0
          || (spreadsheetRequest.data?.length ?? 0) > 0;
        if (hasRequestContent) {
          excelWorkbook = await excelOrchestrator.createCalculationWorkbook(spreadsheetRequest);
          console.log('[Orchestrator] Excel workbook generated with', excelWorkbook.formulasUsed.length, 'formulas');
          if (excelWorkbook.workbook) {
            try {
              spreadsheetPreviewData = excelOrchestrator.extractSpreadsheetPreview(excelWorkbook.workbook);
            } catch (e) {
              console.warn('[Orchestrator] Failed to extract spreadsheet preview:', e);
            }
          }
        } else {
          console.log('[Orchestrator] Skipping legacy xlsx — empty request, AI sheet blocks will handle download');
        }
      } catch (error) {
        console.error('[Orchestrator] Excel generation failed:', error);
        // Don't fail the request if Excel generation fails
      }
    }
    
    // Step 3.7: RAG Pipeline - Retrieve relevant context from knowledge base
    // This enhances responses with domain-specific knowledge
    let ragResult: RAGResult | null = null;
    
    if (!isCasualMessage) {
      try {
        console.log('[Orchestrator] Running RAG pipeline for context retrieval...');
        ragResult = await ragPipeline.retrieveContext(enrichedQuery, classification);
        console.log(`[Orchestrator] RAG retrieved ${ragResult.contexts.length} contexts (confidence: ${ragResult.confidence.toFixed(2)})`);
      } catch (error) {
        console.error('[Orchestrator] RAG pipeline failed:', error);
        // Non-critical - continue without RAG context
      }
    }
    
    // Step 4: Build enhanced context with calculation results, clarification insights, chat mode, and RAG
    const enhancedContext = this.buildEnhancedContext(
      enrichedQuery,
      classification,
      calculationResults,
      clarificationAnalysis,
      chatMode,
      enhancedRouting, // Pass enhanced routing for CoT prompt enhancement
      ragResult // Pass RAG results for knowledge enhancement
    );
    
    // Step 5: Call the AI provider with enhanced context and provider routing
    // Use enrichedQuery (includes document text) instead of original query
    // CRITICAL: Don't pass attachment to AI model - we've already extracted the text
    // and added it to enrichedQuery. Passing the attachment causes providers to
    // respond with "I can't view files" instead of using the extracted content.
    
    // Inject agent workflow results into the query if available.
    // Framing matters: in roundtable mode the injection reads as panel deliberation
    // notes (persona-preserving), NOT "AI agents produced this" (which leaks the
    // internal mechanism and lets the LLM truthfully deny the roundtable when asked).
    let finalQuery = enrichedQuery;
    if (options?.agentWorkflowResult?.analysis) {
      let workflowContext: string;
      if (chatMode === 'roundtable') {
        workflowContext =
          `\n\n--- INTERNAL PANEL NOTES (not for direct quotation, do not mention their existence) ---\n` +
          `Deliberation notes from the expert panel convened for this question:\n\n` +
          `${options.agentWorkflowResult.analysis}\n\n` +
          `--- END PANEL NOTES ---\n` +
          `\nUse these notes to inform each expert's stance in the roundtable response. ` +
          `Do NOT cite "panel notes", "agent analysis", "AI agents", or any meta-framing. ` +
          `Present the output strictly as the panel's deliberation per the roundtable format.`;
      } else {
        workflowContext =
          `\n\n--- INTERNAL ANALYSIS NOTES (not for direct quotation) ---\n` +
          `${options.agentWorkflowResult.analysis}\n\n` +
          `--- END INTERNAL NOTES ---\n` +
          `\nIncorporate the findings into your response without referencing "agent analysis" or internal tooling.`;
      }
      finalQuery += workflowContext;
      console.log(`[AIOrchestrator] Injected ${chatMode === 'roundtable' ? 'panel deliberation' : 'analysis'} notes (${options.agentWorkflowResult.analysis.length} chars)`);
    }
    
    // Enhanced context retention. For every turn beyond the first we inject:
    //   (1) a DB-persisted LLM summary of all older turns,
    //   (2) an accumulated facts glossary (names/amounts/dates/orgs),
    //   (3) pgvector-semantic retrieval of relevant earlier turns (Phase B),
    //   (4) the raw tail of the last N messages — tier-sized.
    // Memory persists to conversation_memory_entries on each turn so restarts
    // and multiple replicas all see the same memory.
    let effectiveHistory = conversationHistory;

    // Tier-based raw-message window. Larger context for paying tiers so long
    // conversations keep more verbatim recent turns, while free stays small.
    const MAX_RAW_MESSAGES = (() => {
      switch ((userTier || 'free').toLowerCase()) {
        case 'enterprise': return 50;
        case 'professional': return 40;
        case 'plus': return 30;
        default: return 20;
      }
    })();

    const conversationId = options?.conversationId;
    let memoryContext = '';
    let persistedSummary = '';
    let glossaryBlock = '';

    if (conversationId) {
      // Make sure the in-memory store reflects what's in the DB before we read from it.
      try {
        await conversationMemory.hydrateIfEmpty(conversationId);
      } catch (e) {
        console.warn('[AIOrchestrator] Memory hydration warning:', e);
      }

      persistedSummary = conversationMemory.getPersistedSummary(conversationId);
      if (persistedSummary) {
        console.log(`[AIOrchestrator] Loaded persisted rolling summary (${persistedSummary.length} chars)`);
      }

      glossaryBlock = conversationMemory.buildGlossaryBlock(conversationId);
      if (glossaryBlock) {
        console.log('[AIOrchestrator] Built glossary block from accumulated facts');
      }

      // Semantic retrieval (pgvector cosine) with keyword fallback.
      try {
        memoryContext = await conversationMemory.retrieveRelevantMemory(conversationId, finalQuery, 10);
        if (memoryContext) {
          console.log('[AIOrchestrator] Retrieved relevant memory context for query');
        }
      } catch (e) {
        console.warn('[AIOrchestrator] Memory retrieval warning:', e);
      }
    }

    // For all but the very first user query, inject summary/glossary/memory ahead of the raw tail.
    if (conversationHistory.length > 1) {
      effectiveHistory = conversationHistory.length > MAX_RAW_MESSAGES
        ? conversationHistory.slice(-MAX_RAW_MESSAGES)
        : [...conversationHistory];

      console.log(`[AIOrchestrator] Context management: total history=${conversationHistory.length}, using raw tail=${effectiveHistory.length}`);

      const contextBlocks: Array<{ role: 'assistant'; content: string }> = [];
      if (persistedSummary) {
        contextBlocks.push({
          role: 'assistant',
          content: `[Conversation So Far — summary of earlier turns]\n${persistedSummary}`,
        });
      }
      if (glossaryBlock) {
        contextBlocks.push({ role: 'assistant', content: glossaryBlock });
      }
      if (memoryContext) {
        contextBlocks.push({ role: 'assistant', content: memoryContext });
      }
      if (contextBlocks.length > 0) {
        effectiveHistory = [...contextBlocks, ...effectiveHistory];
      }
      console.log(`[AIOrchestrator] Injected context blocks: summary=${!!persistedSummary}, glossary=${!!glossaryBlock}, memory=${!!memoryContext}, final history length=${effectiveHistory.length}`);
    } else if (conversationHistory.length > MAX_RAW_MESSAGES) {
      effectiveHistory = conversationHistory.slice(-MAX_RAW_MESSAGES);
      console.log(`[AIOrchestrator] History trimmed: ${conversationHistory.length} → ${effectiveHistory.length} messages`);
    }
    
    const aiResponse = await this.callAIModel(
      finalQuery,
      enhancedContext,
      effectiveHistory,
      routingDecision.primaryModel,
      routingDecision.preferredProvider,
      routingDecision.fallbackProviders,
      undefined, // Don't pass attachment - content already in enrichedQuery
      classification,
      calculationResults,
      clarificationAnalysis,
      chatMode,
      enhancedRouting,
      options
    );
    
    // Step 5.1: Log AI cost to database (async, non-blocking)
    // TODO: Move to background queue (Bull/BullMQ) for high-volume scenarios with retry logic
    // CRITICAL: Requires database migration - aiProviderCosts table must exist
    if (userId && aiResponse.tokensUsed > 0 && aiResponse.providerUsed && aiResponse.modelUsed) {
      // Fire-and-forget async logging (doesn't block response)
      // WARNING: If process crashes before execution, cost data will be lost
      // For production: Use Bull/BullMQ with persistent queue and retry logic
      setImmediate(async () => {
        let failureCount = 0;
        const MAX_COST_LOG_FAILURES = 10;
        
        try {
          // Get token breakdown from response (if available) or estimate
          // NOTE: 70/30 split is estimation - actual breakdown varies by provider and use case
          const tokenUsage = aiResponse.tokenBreakdown || {
            promptTokens: Math.floor(aiResponse.tokensUsed * 0.7),
            completionTokens: Math.floor(aiResponse.tokensUsed * 0.3),
            totalTokens: aiResponse.tokensUsed
          };
          
          const cost = calculateAICost(
            aiResponse.providerUsed || routingDecision.preferredProvider || 'openai',
            aiResponse.modelUsed || routingDecision.primaryModel,
            tokenUsage
          );
          
          // Validation: Sanity check cost calculations
          const MAX_REASONABLE_COST = 10000; // $100 per request (100 * 100 cents)
          if (cost.costUsd < 0 || cost.costUsd > MAX_REASONABLE_COST || isNaN(cost.costUsd)) {
            console.error(`[Orchestrator] ⚠️  Suspicious cost detected: $${(cost.costUsd / 100).toFixed(4)} for ${cost.tokensUsed} tokens`);
            
            // Create system alert for suspicious cost (don't await to avoid blocking)
            storage.createSystemAlert({
              type: 'warning',
              severity: 'medium',
              source: 'AI Cost Tracking',
              sourceId: `cost-${Date.now()}`,
              message: `Suspicious AI cost detected: $${(cost.costUsd / 100).toFixed(4)} for ${cost.tokensUsed} tokens`,
              details: {
                provider: aiResponse.providerUsed,
                model: aiResponse.modelUsed,
                userId,
                costUsd: cost.costUsd,
                tokensUsed: cost.tokensUsed,
                timestamp: new Date().toISOString()
              }
            }).catch(err => console.error('[Orchestrator] Failed to create cost alert:', err));
          }
          
          await storage.logAIProviderCost({
            date: new Date(),
            provider: aiResponse.providerUsed || routingDecision.preferredProvider || 'openai',
            model: aiResponse.modelUsed || routingDecision.primaryModel,
            tokensUsed: cost.tokensUsed,
            costUsd: cost.costUsd,
            requestCount: 1,
            userId,
            subscriptionTier: userTier
          });
          
          console.log(`[Orchestrator] ✓ Logged AI cost: ${aiResponse.providerUsed}/${aiResponse.modelUsed} - ${cost.tokensUsed} tokens, $${(cost.costUsd / 100).toFixed(4)}`);
        } catch (error: any) {
          failureCount++;
          
          // IMPORTANT: If this fails with "relation does not exist", run: npm run db:push
          console.error('[Orchestrator] ✗ Failed to log AI cost:', error?.message || error);
          
          // After repeated failures, create critical alert (prevents alert spam)
          if (failureCount >= MAX_COST_LOG_FAILURES) {
            storage.createSystemAlert({
              type: 'error',
              severity: 'critical',
              source: 'AI Cost Tracking',
              sourceId: 'cost-logging-failure',
              message: `AI cost logging failing repeatedly (${failureCount}+ failures)`,
              details: {
                error: error?.message || String(error),
                provider: aiResponse.providerUsed,
                model: aiResponse.modelUsed,
                lastAttempt: new Date().toISOString()
              }
            }).catch(err => console.error('[Orchestrator] Failed to create alert:', err));
          }
          
          // Don't fail request if cost logging fails
        }
      });
    } else if (!userId) {
      // Track anonymous usage with special userId
      // TODO: Decide policy - track as 'anonymous' or skip?
      console.log('[Orchestrator] ℹ️  Skipping cost log (no userId provided)');
    }
    
    let finalResponse = aiResponse.content;
    
    // Step 5.5: Format calculation results professionally if calculations were performed
    if (calculationResults && Object.keys(calculationResults).length > 0) {
      try {
        console.log('[Orchestrator] Formatting calculation results professionally...');
        
        // Format each calculation type
        const formattedOutputs: string[] = [];
        
        for (const [calcType, calcData] of Object.entries(calculationResults)) {
          if (calcData && typeof calcData === 'object') {
            const formatted = calculationFormatter.formatCalculation(
              calcType,
              calcData,
              enrichedQuery
            );
            
            // Append formatted markdown to response
            formattedOutputs.push(formatted.markdown);
          }
        }
        
        // If we have formatted outputs, prepend them to the AI response
        if (formattedOutputs.length > 0) {
          const calculationSection = `\n\n---\n\n# 📊 Calculation Results\n\n${formattedOutputs.join('\n\n')}\n\n---\n\n# 💬 Professional Analysis\n\n`;
          finalResponse = calculationSection + finalResponse;
          console.log('[Orchestrator] Professional calculation formatting applied');
        }
      } catch (error) {
        console.error('[Orchestrator] Calculation formatting failed:', error);
        // Don't fail request if formatting fails - AI response still valid
      }
    }
    
    // Step 5.6: ADVANCED REASONING - Cognitive Monitoring & Validation
    // CRITICAL: Monitoring runs independently of CoT - separate feature flags
    // This ensures quality checks even when advanced reasoning is disabled
    let cognitiveMonitoring: CognitiveMonitorResult | undefined;
    let validationResult: any | undefined;
    let qualityScore = 1.0;
    
    const shouldMonitor = enhancedRouting?.enableCognitiveMonitoring || 
                         (process.env.ENABLE_COMPLIANCE_MONITORING === 'true' || 
                          process.env.ENABLE_VALIDATION_AGENT === 'true');
    
    if (shouldMonitor) {
      try {
        console.log('[Orchestrator] Running compliance monitoring...');
        
        // Run compliance sentinel
        cognitiveMonitoring = await complianceSentinel.validateResponse(
          query,
          finalResponse,
          {
            chatMode,
            uploadedDocuments: options?.attachment ? [options.attachment] : undefined,
            previousMessages: conversationHistory
          }
        );
        
        // Run validation agent
        validationResult = await validationAgent.validate(
          query,
          finalResponse,
          {
            calculationResults,
            uploadedDocuments: options?.attachment ? [options.attachment] : undefined
          }
        );
        
        // Calculate overall quality score
        const complianceScore = cognitiveMonitoring.overallStatus === 'pass' ? 1.0 : 
                               cognitiveMonitoring.overallStatus === 'warning' ? 0.8 : 0.5;
        qualityScore = (complianceScore + validationResult.confidence) / 2;
        
        console.log(`[Orchestrator] Quality score: ${(qualityScore * 100).toFixed(0)}%`);
        
        // Auto-repair if quality is low but not failed
        if (cognitiveMonitoring.overallStatus === 'warning' && qualityScore > 0.6) {
          console.log('[Orchestrator] Low quality detected - auto-repair could be attempted');
          // TODO: Implement auto-repair loop in future phase
        }
        
        // Log if human review required
        if (cognitiveMonitoring.requiresHumanReview) {
          console.warn('[Orchestrator] Response requires human review - flagging for attention');
        }
        
      } catch (error) {
        console.error('[Orchestrator] Cognitive monitoring failed:', error);
        // Don't fail request if monitoring fails - it's a quality check, not critical path
      }
    }
    
    // CRITICAL ENFORCEMENT: For partial_answer_then_clarify, ALWAYS append clarifying questions
    // This ensures the advisor behavior is guaranteed regardless of model compliance
    // Check for generated questions (handles both missing context AND ambiguities)
    // Skip if document is attached - we don't ask questions when analyzing documents
    if (clarificationAnalysis?.recommendedApproach === 'partial_answer_then_clarify') {
      const questions = requirementClarificationAIService.generateClarifyingQuestions(
        clarificationAnalysis
      );
      
      // Only append if there are actual questions to ask
      if (questions.length > 0) {
        // Append clarifying questions to response
        finalResponse += `\n\n**To provide more specific, tailored advice, I need a bit more information:**\n\n`;
        questions.forEach((question, index) => {
          finalResponse += `${index + 1}. ${question}\n`;
        });
        
        if (clarificationAnalysis.detectedNuances.length > 0) {
          finalResponse += `\n**Important considerations to keep in mind:**\n`;
          clarificationAnalysis.detectedNuances.slice(0, 2).forEach(nuance => {
            finalResponse += `- ${nuance}\n`;
          });
        }
      }
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // PHASE 5: Generate visualization if response contains financial data OR workflow
    // CRITICAL: Skip visualization for Excel/spreadsheet requests - they get spreadsheet preview instead
    let visualization: VisualizationData | null = null;
    
    // Don't generate chart visualizations for Excel requests - they have spreadsheet preview
    if (isExcelModelRequest || spreadsheetPreviewData) {
      console.log('[Orchestrator] Skipping chart visualization - Excel/spreadsheet request uses spreadsheet preview');
    } else {
      try {
        const startVizTime = Date.now();
        
        // Check if mindmap should be generated based on query and mode
        const shouldGenerateMindmap = MindMapGenerator.shouldGenerateMindmap(query, chatMode);
        
        if (shouldGenerateMindmap) {
          console.log(`[Orchestrator] 🧠 Mindmap triggered for ${chatMode} mode (query: "${query.substring(0, 50)}..."`);
          
          try {
            // Extract mindmap data from AI response
            const extractStartTime = Date.now();
            const mindmapData = MindMapGenerator.extractMindMapFromResponse(finalResponse);
            const extractTime = Date.now() - extractStartTime;
            
            if (mindmapData) {
              console.log(`[Orchestrator] ✓ Mindmap extracted in ${extractTime}ms`);
              
              // Validate mindmap structure
              const validation = MindMapGenerator.validateMindMap(mindmapData);
              
              if (validation.valid) {
                visualization = mindmapData as VisualizationData;
                console.log(`[Orchestrator] ✓ Valid mindmap: ${mindmapData.nodes.length} nodes, ${mindmapData.edges.length} edges, layout: ${mindmapData.layout}`);
                
                // CRITICAL: Strip mindmap JSON from the text response so it doesn't appear in chat
                // Remove JSON code blocks containing mindmap data
                finalResponse = finalResponse.replace(/```json\s*{[\s\S]*?"type"\s*:\s*["']mindmap["'][\s\S]*?}\s*```/g, '');
                // Remove any standalone JSON objects with mindmap structure
                finalResponse = finalResponse.replace(/{\s*["']type["']\s*:\s*["']mindmap["'][\s\S]*?["']nodes["']\s*:\s*\[[\s\S]*?\][\s\S]*?["']edges["']\s*:\s*\[[\s\S]*?\]\s*}/g, '');
                // Clean up any resulting excessive whitespace
                finalResponse = finalResponse.replace(/\n{3,}/g, '\n\n').trim();
              } else {
                console.warn('[Orchestrator] ✗ Mindmap validation failed:', validation.errors);
                // Continue to fallback visualizations
              }
            } else {
              console.log('[Orchestrator] ℹ No mindmap data found in AI response - falling back to standard visualizations');
            }
          } catch (mindmapError) {
            console.error('[Orchestrator] ✗ Mindmap generation error:', mindmapError);
            // Continue to fallback - don't let mindmap errors break the response
          }
        }
        
        // Fallback to standard visualization generation if no mindmap was created
        if (!visualization) {
          // For workflow mode, generate workflow diagram; for others, generate charts
          if (chatMode === 'workflow') {
            const { WorkflowGenerator } = await import('./workflowGenerator');
            visualization = await WorkflowGenerator.generateWorkflowVisualization(finalResponse, chatMode);
          } else {
            visualization = visualizationGenerator.generateVisualization({
              query,
              response: finalResponse,
              classification
            });
          }
        }
        
        const vizTime = Date.now() - startVizTime;
        if (visualization) {
          console.log(`[Orchestrator] ✓ Generated ${visualization.type} visualization in ${vizTime}ms`);
        }
      } catch (error) {
        console.error('[Orchestrator] ✗ Visualization generation failed:', error);
        // Don't fail the request if visualization fails
      }
    }
    
    // Build response metadata (now includes reasoning metadata)
    const metadata = this.buildResponseMetadata(
      query,
      finalResponse,
      classification,
      routingDecision,
      calculationResults,
      options?.attachment,
      visualization,
      chatMode,
      enhancedRouting,
      cognitiveMonitoring,
      qualityScore,
      processingTimeMs
    );

    // Parse separated content for professional modes
    let deliverableContent: string | undefined;
    let reasoningContent: string | undefined;
    let mainResponse = finalResponse;

    if (chatMode && ['checklist', 'workflow', 'audit-plan'].includes(chatMode)) {
      const { deliverable, reasoning, remainingContent } = this.parseSeparatedContent(finalResponse);
      if (deliverable && reasoning) {
        deliverableContent = deliverable;
        reasoningContent = reasoning;
        mainResponse = remainingContent || reasoning; // Chat shows reasoning
      }
    }

    // Deliverable Composer: the entire polished response IS the deliverable —
    // this mode has no separate reasoning stream, and we don't force the AI to
    // emit <DELIVERABLE>/<REASONING> tags. Promote the full response so it
    // becomes a persisted document artifact on the whiteboard. Chat continues
    // to echo the prose (mainResponse unchanged) — the extractPipeline skips
    // the inline <artifact /> placeholder for documents to avoid duplication.
    if (chatMode === 'deliverable-composer' && !deliverableContent && finalResponse?.trim()) {
      deliverableContent = finalResponse;
    }

    // Step 6: Log interaction for continuous learning (async, non-blocking)
    if (userId) {
      continuousLearning.logInteraction({
        userId,
        conversationId: options?.conversationId || '',
        query,
        response: mainResponse,
        classification,
        modelUsed: routingDecision.primaryModel,
        totalTimeMs: processingTimeMs,
        contextUsed: ragResult?.sources?.map(s => s.id) || []
      }).catch(err => {
        console.error('[Orchestrator] ✗ Failed to log interaction for learning:', err);
      });
    }

    // Extract any ```sheet``` blocks the AI authored directly in its response.
    // We do this BEFORE building whiteboard artifacts so that the resulting
    // SpreadsheetData can feed `precomputed.spreadsheet` and get a whiteboard
    // artifact (which also drives inline chat rendering via <artifact /> tags).
    // Failing silently is fine — the SSE route runs the same extraction as a
    // fallback, so a regression here doesn't break the OutputPane path.
    let aiAuthoredSpreadsheet: any = null;
    try {
      const { extractAndEvaluateSheetBlocks } = await import('./excel/sheetBlockParser');
      const extracted = extractAndEvaluateSheetBlocks(mainResponse);
      if (extracted.blockCount > 0 && extracted.spreadsheetData) {
        mainResponse = extracted.text;
        aiAuthoredSpreadsheet = extracted.spreadsheetData;
        console.log(`[Orchestrator] Extracted ${extracted.blockCount} AI-authored sheet block(s)`);
      }
    } catch (err) {
      console.warn('[Orchestrator] Sheet-block extraction skipped:', (err as Error).message);
    }

    // Prefer AI-authored sheet data over the generator's output for downstream
    // consumers (OutputPane, whiteboard artifact, xlsx download fallback).
    const effectiveSpreadsheetData = aiAuthoredSpreadsheet ?? spreadsheetPreviewData;

    // Add Excel/spreadsheet data to metadata for SSE streaming
    const enrichedMetadata = {
      ...metadata,
      hasExcel: !!excelWorkbook,
      excelBuffer: excelWorkbook?.buffer ? Buffer.from(excelWorkbook.buffer).toString('base64') : undefined,
      excelFilename: excelWorkbook ? `ICAI CAGPT_Calculations_${Date.now()}.xlsx` : undefined,
      spreadsheetData: effectiveSpreadsheetData,
      contentType: chatMode === 'checklist' ? 'checklist'
        : chatMode === 'workflow' ? 'workflow'
        : chatMode === 'calculation' ? 'calculation'
        : 'markdown'
    };

    // PHASE 2.4: Whiteboard artifact extraction
    // Runs only when both conversationId and messageId are provided so we can
    // correctly scope and seed the auto-layout. Failures never break the
    // response — extraction is a best-effort enhancement.
    let whiteboardUpdatedContent: string | undefined;
    let whiteboardArtifactsOut: OrchestrationResult['whiteboardArtifacts'];

    if (isFeatureEnabled('WHITEBOARD_V2') && options?.conversationId && options?.messageId) {
      try {
        // Seed layout state from prior artifacts so appends are stable across turns
        const prior = await listArtifactsByConversation(options.conversationId);
        let seed: LayoutState = { cursorX: 0, rowTop: 0, rowHeight: 0 };
        for (const a of prior) {
          const { state } = placeNext(seed, { width: a.width, height: a.height });
          seed = state;
        }

        // Route the generated visualization into the correct precomputed slot
        // based on its payload type. Stuffing everything into `.visualization`
        // made workflows and mindmaps render correctly (the renderer switches
        // on payload.type) but the persisted artifact kind was always "chart"
        // — so the manifest lied to the agent about what it was looking at.
        const precomputedSlots: {
          visualization?: any;
          workflow?: any;
          mindmap?: any;
          spreadsheet?: any;
          document?: any;
        } = {
          spreadsheet: effectiveSpreadsheetData as any,
        };
        if (visualization) {
          const vizType = (visualization as any).type;
          if (vizType === 'workflow') {
            precomputedSlots.workflow = visualization as any;
          } else if (vizType === 'mindmap') {
            precomputedSlots.mindmap = visualization as any;
          } else {
            precomputedSlots.visualization = visualization as any;
          }
        }
        // Deliverable Composer emits a long-form markdown document via the
        // `deliverableContent` field. Promote it to a persisted artifact so it
        // can be selected, referenced, and exported like any other artifact.
        if (chatMode === 'deliverable-composer' && deliverableContent) {
          precomputedSlots.document = {
            title: 'Deliverable',
            content: deliverableContent,
            mode: chatMode,
          };
        }

        console.log('[whiteboard] starting extraction', {
          chatMode,
          hasVisualization: !!visualization,
          visualizationType: visualization ? (visualization as any).type : null,
          slots: Object.keys(precomputedSlots).filter(k => (precomputedSlots as any)[k]),
        });

        // When workflow mode produces a proper workflow visualization, the AI's
        // prose steps are now redundant — the artifact IS the workflow.
        // Strip the "Start: ... Step N: ... End: ..." block from mainResponse
        // so chat only shows the explanatory narrative (same pattern as
        // Deliverable Composer). Keep the AI's reasoning paragraphs intact.
        let contentForExtraction = mainResponse;
        if (chatMode === 'workflow' && precomputedSlots.workflow) {
          const beforeLen = contentForExtraction.length;
          contentForExtraction = this.stripWorkflowProse(contentForExtraction);
          if (contentForExtraction.length !== beforeLen) {
            console.log('[whiteboard] stripped workflow prose from chat',
              { before: beforeLen, after: contentForExtraction.length });
            mainResponse = contentForExtraction;
          }
        }

        const built = buildArtifactsForMessage({
          content: contentForExtraction,
          conversationId: options.conversationId,
          messageId: options.messageId,
          chatMode,
          precomputed: precomputedSlots,
          layoutState: seed,
          idFactory: () => `art_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        });

        console.log('[whiteboard] extraction complete', {
          artifactsCreated: built.artifacts.length,
          kinds: built.artifacts.map(a => a.kind),
        });

        if (built.artifacts.length > 0) {
          whiteboardUpdatedContent = built.updatedContent;
          whiteboardArtifactsOut = built.artifacts;
        }
      } catch (e) {
        console.error('[whiteboard] extraction failed; skipping:', e);
      }
    } else {
      console.log('[whiteboard] extraction SKIPPED', {
        flagEnabled: isFeatureEnabled('WHITEBOARD_V2'),
        hasConversationId: !!options?.conversationId,
        hasMessageId: !!options?.messageId,
      });
    }

    return {
      response: mainResponse,
      deliverableContent,
      reasoningContent,
      modelUsed: routingDecision.primaryModel,
      routingDecision,
      classification,
      calculationResults,
      metadata: enrichedMetadata,
      clarificationAnalysis,
      needsClarification: clarificationAnalysis?.recommendedApproach === 'partial_answer_then_clarify',
      tokensUsed: aiResponse.tokensUsed,
      processingTimeMs,
      excelWorkbook: excelWorkbook ? {
        buffer: excelWorkbook.buffer,
        filename: `ICAI CAGPT_Calculations_${Date.now()}.xlsx`,
        summary: excelWorkbook.summary
      } : undefined,
      // Include spreadsheet preview data for UI display (with formulas shown as text).
      // Prefer AI-authored sheet data when the AI emitted a ```sheet``` fenced block.
      spreadsheetData: effectiveSpreadsheetData,
      // Whiteboard integration (Phase 2.4)
      whiteboardArtifacts: whiteboardArtifactsOut,
      whiteboardUpdatedContent,
    };
  }

  /**
   * Build response metadata to control output pane display
   * Now includes advanced reasoning metadata
   */
  private buildResponseMetadata(
    query: string,
    response: string,
    classification: QueryClassification,
    routing: RoutingDecision,
    calculations: any,
    attachment?: ProcessQueryOptions['attachment'],
    visualization?: VisualizationData | null,
    chatMode?: string,
    enhancedRouting?: EnhancedRoutingDecision | null,
    cognitiveMonitoring?: CognitiveMonitorResult,
    qualityScore?: number,
    processingTimeMs?: number
  ): ResponseMetadata {
    const lowerQuery = query.toLowerCase();
    
    // Use enhanced routing and classification to determine specialized handling needs
    const isHighComplexity = classification.complexity === 'expert';
    const requiresSpecializedHandling = enhancedRouting?.enableChainOfThought || 
                                        enhancedRouting?.enableMultiAgent ||
                                        isHighComplexity;
    
    if (requiresSpecializedHandling) {
      console.log(`[Orchestrator] Response required specialized handling: CoT=${enhancedRouting?.enableChainOfThought}, MultiAgent=${enhancedRouting?.enableMultiAgent}, Complexity=${classification.complexity}`);
    }
    
    // Check if visualization was generated
    const hasVisualization = !!visualization || this.detectVisualizationRequest(lowerQuery);
    
    // Detect export requests
    const hasExport = this.detectExportRequest(lowerQuery);
    
    // Determine response type based on classification and routing
    let responseType: ResponseType = 'general';
    
    if (classification.requiresDocumentAnalysis || attachment) {
      responseType = 'document';
    } else if (hasVisualization) {
      responseType = 'visualization';
    } else if (hasExport) {
      responseType = 'export';
    } else if (calculations && Object.keys(calculations).length > 0) {
      responseType = 'calculation';
    } else if (classification.requiresResearch || classification.requiresRealTimeData) {
      responseType = 'research';
    } else if (classification.requiresDeepReasoning || classification.complexity === 'expert') {
      responseType = 'analysis';
    }
    
    // CRITICAL: Determine if output pane should show this response
    // Professional modes ALWAYS show in Output Pane:
    // - deep-research: Research results and findings
    // - checklist: Generated checklists
    // - workflow: Workflow descriptions/diagrams
    // - audit-plan: Audit plans and procedures
    // - calculation: Financial calculations
    // Standard chat can also show in Output Pane when response has visualizations or is substantial
    const professionalModes = ['deep-research', 'checklist', 'workflow', 'audit-plan', 'calculation'];
    const isProfessionalMode = chatMode && professionalModes.includes(chatMode);
    
    // Check if response is substantial (has headers, lists, or is long enough)
    const hasSubstantialContent = response && (
      response.includes('##') ||  // Has headers
      response.includes('- ') ||  // Has bullet points
      response.includes('1.') ||  // Has numbered list
      response.length > 500       // Long response
    );
    
    // Debug: Log chat mode detection
    console.log(`[Orchestrator] buildResponseMetadata - chatMode: ${chatMode}, isProfessionalMode: ${isProfessionalMode}, responseType: ${responseType}, hasSubstantialContent: ${hasSubstantialContent}`);
    
    const showInOutputPane = 
      isProfessionalMode ||  // All professional modes → Output Pane
      responseType === 'document' ||
      responseType === 'visualization' ||
      responseType === 'export' ||
      (responseType === 'calculation' && calculations) ||
      hasVisualization ||  // Any response with visualization
      hasSubstantialContent;  // Standard chat with substantial content
    
    // Build reasoning metadata if advanced features were used
    let reasoningMetadata: Partial<ReasoningMetadata> | undefined;
    if (enhancedRouting) {
      reasoningMetadata = {
        profile: enhancedRouting.reasoningProfile,
        governorDecisions: [
          `Reasoning profile: ${enhancedRouting.reasoningProfile}`,
          enhancedRouting.enableChainOfThought ? 'Chain-of-thought enabled' : null,
          enhancedRouting.enableCognitiveMonitoring ? 'Cognitive monitoring enabled' : null,
          enhancedRouting.enableMultiAgent ? 'Multi-agent enabled' : null
        ].filter(Boolean) as string[],
        totalProcessingTimeMs: processingTimeMs || 0,
        totalTokensUsed: 0, // Will be filled by caller
      };
      
      // Add cognitive monitoring results if available
      if (cognitiveMonitoring) {
        reasoningMetadata.cognitiveMonitoring = cognitiveMonitoring;
      }
    }
    
    return {
      responseType,
      showInOutputPane,
      hasDocument: !!attachment || classification.requiresDocumentAnalysis,
      hasVisualization,
      hasExport,
      hasCalculation: !!calculations && Object.keys(calculations).length > 0,
      hasResearch: classification.requiresResearch || classification.requiresRealTimeData,
      classification,
      calculationResults: calculations,
      visualization: visualization || undefined,
      reasoning: reasoningMetadata,
      cognitiveMonitoring,
      qualityScore
    };
  }

  /**
   * Detect if user is requesting a visualization/chart
   */
  private detectVisualizationRequest(query: string): boolean {
    const visualizationKeywords = [
      'chart', 'graph', 'plot', 'visualize', 'visualization', 'diagram',
      'show me', 'display', 'draw', 'create a chart', 'create a graph',
      'bar chart', 'line chart', 'pie chart', 'scatter plot', 'histogram'
    ];
    return visualizationKeywords.some(kw => query.includes(kw));
  }

  /**
   * Detect if user is requesting an export
   */
  private detectExportRequest(query: string): boolean {
    const exportKeywords = [
      'export', 'download', 'save as', 'generate pdf', 'generate csv',
      'export to', 'download as', 'create pdf', 'create csv',
      'excel', 'spreadsheet', '.pdf', '.csv', '.xlsx'
    ];
    return exportKeywords.some(kw => query.includes(kw));
  }

  /**
   * Execute financial calculations based on query analysis
   */
  private async executeCalculations(
    query: string,
    classification: QueryClassification,
    routing: RoutingDecision
  ): Promise<any> {
    const results: any = {};
    
    // Financial Ratio calculations (Current Ratio, Quick Ratio, etc.)
    if (query.toLowerCase().includes('current ratio') || 
        query.toLowerCase().includes('quick ratio') ||
        query.toLowerCase().includes('liquidity ratio')) {
      const ratioParams = this.extractFinancialRatioParameters(query);
      if (ratioParams) {
        results.financialRatios = financialSolverService.calculateFinancialRatios(
          ratioParams.currentAssets,
          ratioParams.currentLiabilities,
          ratioParams.totalAssets || ratioParams.currentAssets,
          ratioParams.totalLiabilities || ratioParams.currentLiabilities,
          ratioParams.inventory || 0,
          ratioParams.netIncome || 0,
          ratioParams.equity || 0,
          ratioParams.historicalData
        );
      }
    }
    
    // Tax calculations
    if (routing.solversNeeded.includes('tax-calculator')) {
      const taxCalc = this.extractTaxParameters(query);
      if (taxCalc?.jurisdiction) {
        results.taxCalculation = financialSolverService.calculateCorporateTax(
          taxCalc.revenue,
          taxCalc.expenses,
          taxCalc.jurisdiction,
          { entityType: taxCalc.entityType }
        );
      }
    }
    
    // NPV/IRR calculations
    if (query.includes('npv') || query.includes('net present value')) {
      const cashFlows = this.extractCashFlows(query);
      const discountRate = this.extractDiscountRate(query);
      if (cashFlows && discountRate) {
        const npv = financialSolverService.calculateNPV(cashFlows, discountRate);
        results.npv = {
          npv,
          cashFlows,
          discountRate,
          initialInvestment: cashFlows[0] || 0
        };
      }
    }
    
    if (query.includes('irr') || query.includes('internal rate of return')) {
      const cashFlows = this.extractCashFlows(query);
      if (cashFlows) {
        const irr = financialSolverService.calculateIRR(cashFlows);
        results.irr = {
          irr,
          cashFlows,
          requiredReturn: 0.10 // Default required return
        };
      }
    }
    
    // Depreciation calculations
    if (query.includes('depreciation') || query.includes('depreciate')) {
      const depParams = this.extractDepreciationParameters(query);
      if (depParams) {
        const annualDepreciation = financialSolverService.calculateDepreciation(
          depParams.cost,
          depParams.salvage,
          depParams.life,
          depParams.method,
          depParams.period
        );
        
        // Build schedule
        const schedule = [];
        let balance = depParams.cost;
        let accumulated = 0;
        
        for (let year = 1; year <= depParams.life; year++) {
          const depreciation = financialSolverService.calculateDepreciation(
            depParams.cost,
            depParams.salvage,
            depParams.life,
            depParams.method,
            year
          );
          accumulated += depreciation;
          const endingBalance = balance - depreciation;
          
          schedule.push({
            year,
            beginningBalance: balance,
            depreciation,
            endingBalance,
            accumulated
          });
          
          balance = endingBalance;
        }
        
        results.depreciation = {
          cost: depParams.cost,
          salvageValue: depParams.salvage,
          usefulLife: depParams.life,
          method: depParams.method,
          annualDepreciation,
          schedule
        };
      }
    }
    
    // Amortization calculations
    if (query.includes('amortization') || query.includes('loan payment')) {
      const loanParams = this.extractLoanParameters(query);
      if (loanParams) {
        const amortizationData = financialSolverService.calculateAmortization(
          loanParams.principal,
          loanParams.rate,
          loanParams.years,
          loanParams.paymentsPerYear
        );
        
        results.amortization = {
          principal: loanParams.principal,
          annualRate: loanParams.rate,
          years: loanParams.years,
          payment: amortizationData.payment,
          schedule: amortizationData.schedule
        };
      }
    }
    
    return Object.keys(results).length > 0 ? results : null;
  }

  /**
   * Detect if the conversation already contains an interview exchange:
   * assistant asked clarifying questions → user answered them.
   * This prevents re-asking the same questions in a loop.
   */
  private hasCompletedInterview(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    if (conversationHistory.length < 2) return false;
    
    // Walk backwards through history looking for the pattern:
    // assistant message with clarification questions → user response
    for (let i = conversationHistory.length - 1; i >= 1; i--) {
      const current = conversationHistory[i];
      const previous = conversationHistory[i - 1];
      
      // Pattern: assistant asked questions, then user responded
      if (previous.role === 'assistant' && current.role === 'user') {
        const assistantMsg = previous.content.toLowerCase();
        
        // Detect clarification question patterns in assistant message
        const isClarificationMessage = (
          // Numbered question list pattern
          (/\b\d+\.\s+.+\?/m.test(previous.content) && (
            assistantMsg.includes('need to understand') ||
            assistantMsg.includes('need a bit more') ||
            assistantMsg.includes('need to build') ||
            assistantMsg.includes('context-building') ||
            assistantMsg.includes('clarifying question') ||
            assistantMsg.includes('more information') ||
            assistantMsg.includes('which jurisdiction') ||
            assistantMsg.includes('what specific') ||
            assistantMsg.includes('what aspect') ||
            assistantMsg.includes('to provide') ||
            assistantMsg.includes('to ensure') ||
            assistantMsg.includes('before i can') ||
            assistantMsg.includes('help me understand')
          )) ||
          // Direct clarification markers
          assistantMsg.includes('context-building questions') ||
          assistantMsg.includes('deep research mode activated')
        );
        
        if (isClarificationMessage) {
          // The user's follow-up (current message) is their answer
          console.log('[AIOrchestrator] Found completed interview exchange in conversation history');
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Build clarification response when critical context is missing
   */
  private buildClarificationResponse(
    questions: string[],
    analysis: ClarificationAnalysis,
    mode?: string
  ): string {
    // Special handling for Deep Research mode
    if (mode === 'deep-research') {
      let response = `## Deep Research\n\n`;
      response += `To conduct thorough, accurate research with proper citations and jurisdiction-specific analysis, I need a few details about your situation.\n\n`;
      response += `---\n\n`;
      
      questions.forEach((question, index) => {
        response += `**${index + 1}.** ${question}\n\n`;
      });
      
      response += `---\n\n`;
      response += `> *Once you provide these details, I'll deliver a comprehensive response with full analysis, citations, and actionable recommendations.*`;
      
      return response;
    }
    
    // Standard clarification response for other modes — clean professional format
    const modeLabels: Record<string, string> = {
      'calculation': 'Calculation',
      'audit-plan': 'Audit Planning',
      'scenario-simulator': 'Scenario Simulator',
      'checklist': 'Checklist',
      'workflow': 'Workflow',
      'deliverable-composer': 'Deliverable Composer',
      'forensic-intelligence': 'Forensic Intelligence',
      'roundtable': 'Roundtable',
      'standard': 'Advisory'
    };
    
    const modeLabel = mode ? (modeLabels[mode] || mode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : 'Advisory';
    
    let response = `## ${modeLabel}\n\n`;
    response += `I need a few details to ensure my advice is accurate, jurisdiction-specific, and tailored to your situation.\n\n`;
    response += `---\n\n`;
    
    questions.forEach((question, index) => {
      response += `**${index + 1}.** ${question}\n\n`;
    });
    
    response += `---\n\n`;
    
    // Add nuances as helpful context
    if (analysis.detectedNuances.length > 0) {
      response += `**Why this matters:**\n\n`;
      analysis.detectedNuances.forEach(nuance => {
        response += `- ${nuance}\n`;
      });
      response += `\n`;
    }
    
    response += `> *Once you provide these details, I'll deliver a comprehensive response with full analysis, citations, and actionable recommendations.*`;
    
    return response;
  }

  /**
   * Build enhanced context with calculation results, clarification insights, and chat mode for AI model
   * Now includes Chain-of-Thought prompt enhancement when enabled
   * Enhanced with RAG pipeline context for knowledge-grounded responses
   */
  private buildEnhancedContext(
    query: string,
    classification: QueryClassification,
    calculations: any,
    clarificationAnalysis?: ClarificationAnalysis,
    chatMode?: string,
    enhancedRouting?: EnhancedRoutingDecision | null,
    ragResult?: RAGResult | null
  ): string {
    let context = `You are CA GPT, an ICAI-aligned accounting superintelligence and expert CA advisor. `;
    context += `You are NOT a generic text generation machine. You are a thoughtful, detail-oriented professional who:\n`;
    context += `- NEVER assumes jurisdiction, entity type, or regulatory framework without explicit confirmation\n`;
    context += `- Asks clarifying questions FIRST when critical context is missing (jurisdiction, entity type, tax year, etc.)\n`;
    context += `- Considers jurisdiction-specific nuances that other LLMs miss\n`;
    context += `- Identifies subtle details that matter in accounting and tax (filing status, entity type, accounting method)\n`;
    context += `- Only provides specific advice AFTER understanding the user's exact context\n`;
    context += `- Demonstrates expertise by recognizing when more information is needed before answering\n\n`;
    
    context += `**CRITICAL: Inquiry-First Professional Behavior**\n`;
    context += `DO NOT make assumptions about:\n`;
    context += `1. **Jurisdiction**: Never default to US/IRS - always ask which country/region applies\n`;
    context += `2. **Entity Type**: Individual, LLC, Corporation, Partnership, etc. - ask if unclear\n`;
    context += `3. **Tax Year**: Rules change annually - confirm the applicable period\n`;
    context += `4. **Regulatory Framework**: GAAP vs IFRS, federal vs state, etc.\n\n`;
    
    context += `**Balance Expert Depth with Accessibility**\n`;
    context += `While maintaining professional-grade quality, make your responses accessible:\n`;
    context += `1. **Layer Your Explanations**: Start with simple, clear summaries before diving into technical details\n`;
    context += `   - Open with a plain-language answer anyone can understand\n`;
    context += `   - Then provide the expert-level technical depth and nuances\n`;
    context += `2. **Define Technical Terms**: When using specialized terminology, briefly explain it in parentheses or a following sentence\n`;
    context += `   - Example: "This qualifies for Section 179 deduction (immediate expensing of equipment purchases)"\n`;
    context += `3. **Use Analogies**: Where helpful, relate complex concepts to everyday situations\n`;
    context += `4. **Provide Concrete Examples**: Illustrate abstract principles with real-world scenarios\n`;
    context += `5. **Structure for Clarity**: Use headings, bullet points, and numbered lists to organize information\n`;
    context += `6. **Highlight Key Takeaways**: Emphasize the most important points so they're easy to spot\n\n`;
    
    context += `Think of your audience as intelligent but not necessarily accounting experts. Your goal is to educate while you advise.\n\n`;
    
    // Add chat mode-specific instructions
    if (chatMode && chatMode !== 'standard') {
      context += `**PROFESSIONAL MODE SELECTED: ${chatMode.toUpperCase().replace(/-/g, ' ')}**\n\n`;
      context += `🚨 CRITICAL: The user has selected ONLY the "${chatMode}" mode. DO NOT provide responses for other modes.\n`;
      context += `- Do NOT generate checklists unless the mode is "checklist"\n`;
      context += `- Do NOT generate workflows unless the mode is "workflow"\n`;
      context += `- Do NOT generate audit plans unless the mode is "audit-plan"\n`;
      context += `- Do NOT generate calculations unless the mode is "calculation"\n`;
      context += `- ONLY provide the specific output format requested for "${chatMode}" mode\n`;
      context += `- If the user wants multiple perspectives, they should use "roundtable" mode instead\n\n`;
      
      switch (chatMode) {
        case 'deep-research':
          context += `INSTRUCTIONS FOR DEEP RESEARCH MODE:\n`;
          context += `**This is NOT a generic answer mode. You MUST provide citations and sources.**\n\n`;
          context += `**BEFORE YOU START: Ask ALL necessary clarifying questions to fully understand the scope:**\n`;
          context += `- Specific jurisdiction or country (if not mentioned)\n`;
          context += `- Entity type or industry specifics\n`;
          context += `- Timeframe or tax year relevant\n`;
          context += `- Any specific aspects they want emphasized\n\n`;
          context += `Only provide the full research report AFTER getting clarifications.\n\n`;
          context += `MANDATORY REQUIREMENTS:\n`;
          context += `1. **Cite Specific Sources**: Every major claim MUST include citations\n`;
          context += `   - Format: [Source Name, Document/Section Number, Year]\n`;
          context += `   - Example: [IRC Section 162(a), IRS Publication 535, 2023]\n`;
          context += `   - Example: [UAE Commercial Companies Law, Federal Law No. 2 of 2015, Article 10]\n`;
          context += `   - Example: [Smith v. Commissioner, 123 TC 456 (2020)]\n\n`;
          context += `2. **Authoritative Sources Only**:\n`;
          context += `   - Government regulations and statutes\n`;
          context += `   - Official tax authority publications (IRS, HMRC, CBDT, etc.)\n`;
          context += `   - Court cases and legal precedents\n`;
          context += `   - Official accounting standards (IFRS, GAAP, Ind AS)\n`;
          context += `   - Regulatory body guidance (SEC, FCA, SEBI)\n\n`;
          context += `3. **Citation Format** (use throughout your response):\n`;
          context += `   - In-text: "According to [Source], companies must..."\n`;
          context += `   - End of section: Include a "References" subsection\n`;
          context += `   - Numbered footnotes where appropriate\n\n`;
          context += `4. **Multi-Source Analysis**: Compare and contrast sources when relevant\n`;
          context += `   - Show different jurisdictional approaches\n`;
          context += `   - Identify conflicting interpretations\n`;
          context += `   - Explain which source is controlling and why\n\n`;
          context += `5. **Transparency About Limitations**:\n`;
          context += `   - If you cannot find a specific regulation, SAY SO explicitly\n`;
          context += `   - Never fabricate case names, section numbers, or citations\n`;
          context += `   - Use phrases like: "Based on general principles of [jurisdiction] law..." when citing broad concepts\n\n`;
          context += `6. **Structure Your Research**:\n`;
          context += `   - Executive Summary (cite 2-3 key sources)\n`;
          context += `   - Detailed Analysis (with citations throughout)\n`;
          context += `   - Jurisdictional Comparisons (if relevant)\n`;
          context += `   - References Section (list all sources cited)\n\n`;
          context += `**ZERO TOLERANCE FOR HALLUCINATION**: If you don't have access to a specific case or regulation, explain what type of source would be authoritative rather than inventing one.\n\n`;
          break;
        case 'checklist':
          context += `INSTRUCTIONS FOR CHECKLIST MODE:\n`;
          context += `You need to provide TWO separate outputs:\n\n`;
          context += `1. DELIVERABLE (for output pane download):\n`;
          context += `Create a professional, structured checklist with:\n`;
          context += `- Clear task items with checkboxes [ ]\n`;
          context += `- Priority levels (High/Medium/Low)\n`;
          context += `- Deadlines and dependencies\n`;
          context += `- Brief descriptions for each item\n`;
          context += `- Organized in logical sections\n\n`;
          context += `2. REASONING (for chat interface):\n`;
          context += `Explain your thought process:\n`;
          context += `- Why you included specific items\n`;
          context += `- How you determined priorities\n`;
          context += `- Sources or standards you considered\n`;
          context += `- Ask for user feedback on your reasoning\n\n`;
          context += `Format your response as:\n`;
          context += `<DELIVERABLE>\n[checklist content here]\n</DELIVERABLE>\n\n`;
          context += `<REASONING>\n[your thought process here]\n</REASONING>\n\n`;
          break;
        case 'workflow':
          context += `INSTRUCTIONS FOR WORKFLOW VISUALIZATION MODE:\n`;
          context += `You need to provide TWO separate outputs:\n\n`;
          context += `1. DELIVERABLE (for output pane visualization):\n`;
          context += `Create a clear, structured workflow using this format:\n`;
          context += `Step 1: [Title]\n- [Substep description]\n- [Another substep]\n\n`;
          context += `Step 2: [Next Title]\n- [Substep description]\n\n`;
          context += `This will generate an interactive flowchart diagram.\n\n`;
          context += `WORKFLOW GUIDELINES:\n`;
          context += `- Use clear, descriptive step titles\n`;
          context += `- Group related activities using substeps (bullet points under each step)\n`;
          context += `- For complex processes, create comprehensive workflows with all necessary steps\n`;
          context += `- The visualization supports large workflows with zoom, search, and compact view\n\n`;
          context += `FORMAT OPTIONS you can mention:\n`;
          context += `- "Linear Process" - Sequential steps (default)\n`;
          context += `- "Decision Tree" - Include decision points with Yes/No branches\n`;
          context += `- "Parallel Workflow" - Multiple simultaneous paths\n`;
          context += `- "Approval Workflow" - Include approval gates and review steps\n\n`;
          context += `2. REASONING (for chat interface):\n`;
          context += `Explain your thought process:\n`;
          context += `- Why you structured the workflow this way\n`;
          context += `- Key considerations for each step\n`;
          context += `- Industry best practices applied\n`;
          context += `- Ask user: "Would you prefer a different format (decision tree, parallel workflow, etc.)?"\n\n`;
          context += `Format your response as:\n`;
          context += `<DELIVERABLE>\n[workflow content here]\n</DELIVERABLE>\n\n`;
          context += `<REASONING>\n[your thought process here]\n</REASONING>\n\n`;
          break;
        case 'audit-plan':
          context += `INSTRUCTIONS FOR AUDIT PLAN MODE:\n`;
          context += `You need to provide TWO separate outputs:\n\n`;
          context += `1. DELIVERABLE (for output pane download):\n`;
          context += `Create a comprehensive audit plan with:\n`;
          context += `- Risk assessment and materiality thresholds\n`;
          context += `- Specific audit procedures and tests\n`;
          context += `- Required documentation and evidence\n`;
          context += `- Timing considerations and resource requirements\n`;
          context += `- Relevant auditing standards (GAAS, ISA, etc.)\n\n`;
          context += `2. REASONING (for chat interface):\n`;
          context += `Explain your thought process:\n`;
          context += `- How you assessed the risk areas\n`;
          context += `- Why you selected specific procedures\n`;
          context += `- Standards and regulations considered\n`;
          context += `- Ask for user feedback on the audit approach\n\n`;
          context += `Format your response as:\n`;
          context += `<DELIVERABLE>\n[audit plan content here]\n</DELIVERABLE>\n\n`;
          context += `<REASONING>\n[your thought process here]\n</REASONING>\n\n`;
          break;
        case 'calculation':
          context += `INSTRUCTIONS FOR FINANCIAL CALCULATION MODE:\n`;
          context += `You are integrated with a full Excel orchestration engine. You can:\n`;
          context += `1. Create Excel workbooks with live formulas (not just static values)\n`;
          context += `2. Build calculation tables with preserved formulas\n`;
          context += `3. Generate depreciation/amortization schedules\n`;
          context += `4. Create tax calculations with breakdown formulas\n`;
          context += `5. Calculate NPV, IRR, and other financial metrics with formulas\n`;
          context += `6. Parse and modify uploaded Excel files\n\n`;
          context += `When responding:\n`;
          context += `- Identify what calculations the user needs\n`;
          context += `- Specify the Excel structure (tables, formulas, charts)\n`;
          context += `- Show formulas that will be created (e.g., "=B2*B3")\n`;
          context += `- Explain your methodology clearly\n`;
          context += `- Note: The system will generate a downloadable Excel file with working formulas\n\n`;
          context += `Available calculation types:\n`;
          context += `- tax: Corporate/personal tax calculations\n`;
          context += `- npv: Net present value with discount rate\n`;
          context += `- irr: Internal rate of return\n`;
          context += `- depreciation: Asset depreciation schedules\n`;
          context += `- amortization: Loan payment schedules\n`;
          context += `- loan: Loan calculations with amortization\n`;
          context += `- custom: Any financial calculation with formulas\n\n`;
          break;
      }
    }
    
    context += `Query Classification:\n`;
    context += `- Domain: ${classification.domain}\n`;
    if (classification.subDomain) {
      context += `- Sub-domain: ${classification.subDomain}\n`;
    }
    if (classification.jurisdiction && classification.jurisdiction.length > 0) {
      context += `- Jurisdiction(s): ${classification.jurisdiction.join(', ')}\n`;
    }
    context += `- Complexity: ${classification.complexity}\n\n`;
    
    // Add clarification context if available
    if (clarificationAnalysis?.conversationContext) {
      const ctx = clarificationAnalysis.conversationContext;
      context += `Detected Context from Conversation:\n`;
      if (ctx.jurisdiction) context += `- Jurisdiction: ${ctx.jurisdiction}\n`;
      if (ctx.taxYear) context += `- Tax Year: ${ctx.taxYear}\n`;
      if (ctx.businessType) context += `- Business Type: ${ctx.businessType}\n`;
      if (ctx.entityType) context += `- Entity Type: ${ctx.entityType}\n`;
      if (ctx.filingStatus) context += `- Filing Status: ${ctx.filingStatus}\n`;
      if (ctx.accountingMethod) context += `- Accounting Method: ${ctx.accountingMethod}\n`;
      context += `\n`;
    }
    
    // Add calculation formatting instructions if calculations were performed
    if (calculations) {
      context += `\n**CALCULATION OUTPUT FORMATTING INSTRUCTIONS:**\n`;
      context += `When presenting financial calculations, use this professional structure:\n\n`;
      context += `1. **Quick Summary Section**\n`;
      context += `   - Lead with key results in plain language\n`;
      context += `   - Use emojis for visual clarity (📊 📈 💰 🎯)\n`;
      context += `   - Include benchmark comparisons where relevant\n\n`;
      context += `2. **Detailed Calculation Breakdown**\n`;
      context += `   - Present data in markdown tables\n`;
      context += `   - Show step-by-step formulas\n`;
      context += `   - Include component descriptions\n\n`;
      context += `3. **Related Metrics** (if applicable)\n`;
      context += `   - Show complementary calculations\n`;
      context += `   - Compare with industry standards\n\n`;
      context += `4. **Trend Analysis** (when historical data exists)\n`;
      context += `   - Show period-over-period changes\n`;
      context += `   - Use trend indicators: 📈 Improving | 📊 Stable | 📉 Declining\n\n`;
      context += `5. **Professional Interpretation**\n`;
      context += `   - Explain what the numbers mean\n`;
      context += `   - Highlight key considerations\n`;
      context += `   - Provide actionable recommendations\n\n`;
      context += `Use clear section headings, bullet points, and tables to organize information professionally.\n\n`;
    }
    
    // CRITICAL: Add missing context information to instruct model to ask questions
    if (clarificationAnalysis?.missingContext && clarificationAnalysis.missingContext.length > 0) {
      context += `MISSING CONTEXT - Important Details to Address:\n`;
      clarificationAnalysis.missingContext
        .filter(m => m.importance === 'high' || m.importance === 'critical')
        .forEach(missing => {
          context += `- ${missing.category} (${missing.importance}): ${missing.reason}\n`;
          context += `  Suggested clarification: "${missing.suggestedQuestion}"\n`;
        });
      context += `\n`;
      
      // Explicit instruction based on recommended approach
      if (clarificationAnalysis.recommendedApproach === 'partial_answer_then_clarify') {
        context += `INSTRUCTION: Provide a brief, general answer to help the user, then ASK for the missing details above. `;
        context += `Format your response as: [General guidance] + "To provide more specific advice, I need to know: [list the questions]"\n\n`;
      }
    }
    
    // Add nuances detected
    if (clarificationAnalysis?.detectedNuances && clarificationAnalysis.detectedNuances.length > 0) {
      context += `Key Nuances to Address in Your Response:\n`;
      clarificationAnalysis.detectedNuances.forEach(nuance => {
        context += `- ${nuance}\n`;
      });
      context += `\n`;
    }
    
    if (calculations) {
      context += `I've performed the following calculations:\n`;
      context += JSON.stringify(calculations, null, 2);
      context += `\n\nUse these calculations in your response. Explain the methodology and provide context.\n\n`;
    }
    
    context += `Core Capabilities you should leverage:\n`;
    context += `- Tax law expertise across US, Canada, UK, EU, Australia, India, China, Singapore, and more\n`;
    context += `- Financial reporting standards (US GAAP, IFRS)\n`;
    context += `- Audit and assurance methodologies\n`;
    context += `- Compliance and regulatory requirements\n`;
    context += `- Advanced financial modeling and analysis\n\n`;
    
    context += `User Query: ${query}\n\n`;
    context += `Provide a comprehensive, expert-level response that:\n`;
    context += `- **Starts with a simple, clear answer** that anyone can understand, then layers in technical depth\n`;
    context += `- Addresses jurisdiction-specific rules and deadlines (with plain-language explanations)\n`;
    context += `- Considers all detected nuances and contextual factors\n`;
    context += `- Goes deeper than typical LLM responses by identifying subtle implications\n`;
    context += `- Cites relevant standards, regulations, tax code sections, or case law when applicable\n`;
    context += `- **Defines technical terms** when first used to maintain accessibility\n`;
    context += `- Explains calculations clearly with methodology (showing both formulas AND what they mean)\n`;
    context += `- Uses concrete examples and analogies to clarify complex concepts\n`;
    context += `- Structures information with clear headings and bullet points for easy scanning\n`;
    context += `- ASK for missing context when instructed above (partial_answer_then_clarify)\n`;
    context += `- Acknowledges limitations and recommends consulting a licensed professional for final decisions\n`;
    context += `- Proactively identifies additional considerations the user should be aware of\n\n`;
    context += `Remember: You are an expert advisor educating intelligent non-experts. Balance deep expertise with accessibility. Make complex topics understandable without sacrificing accuracy or depth.`;
    
    // RAG CONTEXT: Inject retrieved knowledge from knowledge base and vector store
    if (ragResult && ragResult.contexts.length > 0) {
      context += `\n\n---\n**RELEVANT KNOWLEDGE FROM CA GPT KNOWLEDGE BASE:**\n`;
      context += `The following context has been retrieved from our specialized accounting knowledge base (confidence: ${(ragResult.confidence * 100).toFixed(0)}%):\n\n`;
      
      // Format retrieved contexts
      const formattedContext = ragPipeline.formatForPrompt(ragResult);
      context += formattedContext;
      
      context += `\n---\n`;
      context += `**INSTRUCTION**: Use the above knowledge to ground your response. Cite relevant sources when applicable.\n\n`;
    }
    
    // ADVANCED REASONING: Add Chain-of-Thought prompt enhancement if enabled
    if (enhancedRouting?.enableChainOfThought && chatMode) {
      const cotEnhancement = reasoningGovernor.getCoTPromptEnhancement(chatMode);
      context += cotEnhancement;
      console.log('[Orchestrator] Chain-of-thought reasoning enabled for', chatMode);
    }
    
    return context;
  }

  /**
   * Call AI provider with health-aware routing and automatic failover
   */
  private async callAIModel(
    userQuery: string,
    enhancedContext: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    model: string,
    preferredProvider?: AIProviderName,
    fallbackProviders?: AIProviderName[],
    attachment?: ProcessQueryOptions['attachment'],
    classification?: QueryClassification,
    calculations?: any,
    clarificationAnalysis?: ClarificationAnalysis,
    chatMode?: string,
    enhancedRouting?: EnhancedRoutingDecision | null,
    options?: ProcessQueryOptions
  ): Promise<{
    content: string; 
    tokensUsed: number; 
    providerUsed?: string; 
    modelUsed?: string;
    tokenBreakdown?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    // Map custom models to actual OpenAI models (only used for OpenAI/Azure OpenAI)
    const openaiModelMap: Record<string, string> = {
      'luca-tax-expert': 'gpt-4o',
      'luca-audit-expert': 'gpt-4o',
      'luca-financial-expert': 'gpt-4o',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini'
    };
    
    // Provider-specific model mapping - each provider uses its own model
    const providerModelMap: Record<string, string | undefined> = {
      [AIProviderName.OPENAI]: openaiModelMap[model] || 'gpt-4o',
      [AIProviderName.AZURE_OPENAI]: openaiModelMap[model] || 'gpt-4o',
      [AIProviderName.CLAUDE]: undefined, // Use provider default (claude-3-5-sonnet)
      [AIProviderName.GEMINI]: undefined, // Use provider default (gemini-2.0-flash-exp)
      [AIProviderName.PERPLEXITY]: undefined, // Use provider default (llama-3.1-sonar)
    };
    
    // Get model for a specific provider (returns undefined to use provider default)
    const getModelForProvider = (providerName: AIProviderName): string | undefined => {
      return providerModelMap[providerName];
    };
    
    // Whiteboard awareness (Phase 4.6): usage guidance + manifest + selection preamble.
    // Guidance is ALWAYS injected when this is a whiteboard-eligible conversation so the
    // agent learns to emit mermaid / GFM tables instead of ASCII art on the first turn.
    // Manifest is added on top only when prior artifacts exist.
    let whiteboardSystemBlock = "";
    if (isFeatureEnabled('WHITEBOARD_V2') && options?.conversationId) {
      whiteboardSystemBlock = WHITEBOARD_USAGE_GUIDANCE;
      try {
        const priorArtifacts = await listArtifactsByConversation(options.conversationId);
        if (priorArtifacts.length > 0) {
          whiteboardSystemBlock = `${whiteboardSystemBlock}\n\n${formatManifest(priorArtifacts)}`;
        }
      } catch (e) {
        console.error("[whiteboard] manifest fetch failed; skipping:", e);
      }
    }
    // Back-compat: keep the old local name alive so the message-assembly blocks below
    // do not need changes.
    const whiteboardManifestBlock = whiteboardSystemBlock;
    const selectionPreamble = buildSelectionPreamble(options?.selection);
    const effectiveUserQuery = selectionPreamble
      ? `${selectionPreamble}\n\n${userQuery}`
      : userQuery;

    // NEW: Use intelligent prompt builder to avoid length limits (if classification available)
    let messages;
    if (classification) {
      const prompts = promptBuilder.buildPrompts(
        userQuery,
        classification,
        calculations,
        clarificationAnalysis,
        chatMode,
        enhancedRouting
      );

      const systemPromptWithWhiteboard = whiteboardManifestBlock
        ? `${prompts.systemPrompt}\n\n${whiteboardManifestBlock}`
        : prompts.systemPrompt;

      // Build messages with tiered prompts
      messages = [
        // Tier 1: Minimal system prompt (+ whiteboard manifest when present)
        { role: 'system' as const, content: systemPromptWithWhiteboard },
        // Tier 2: Comprehensive instructions as first message
        { role: 'system' as const, content: prompts.instructionsMessage },
        // Conversation history
        ...history.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
        // Tier 3: User query (with selection preamble if present) + context suffix
        { role: 'user' as const, content: effectiveUserQuery + prompts.contextSuffix }
      ];
    } else {
      const enhancedContextWithWhiteboard = whiteboardManifestBlock
        ? `${enhancedContext}\n\n${whiteboardManifestBlock}`
        : enhancedContext;

      // Fallback to simple message structure
      messages = [
        { role: 'system' as const, content: enhancedContextWithWhiteboard },
        ...history.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
        { role: 'user' as const, content: effectiveUserQuery }
      ];
    }
    
    // Build initial provider list from triage decision
    const candidateProviders: AIProviderName[] = [];
    if (preferredProvider) {
      candidateProviders.push(preferredProvider);
    }
    if (fallbackProviders && fallbackProviders.length > 0) {
      candidateProviders.push(...fallbackProviders.filter(p => !candidateProviders.includes(p)));
    }
    
    // Filter out unhealthy providers (unless it's the only option)
    let healthyProviders = candidateProviders.filter(p => providerHealthMonitor.isProviderHealthy(p));
    
    // If all providers are unhealthy, keep the original list (still try them)
    if (healthyProviders.length === 0) {
      console.warn('[AIOrchestrator] All candidate providers are unhealthy - attempting anyway');
      healthyProviders = candidateProviders;
    }
    
    // Sort by health score (descending) - healthier providers first
    healthyProviders.sort((a, b) => 
      providerHealthMonitor.getHealthScore(b) - providerHealthMonitor.getHealthScore(a)
    );
    
    // Ensure Azure OpenAI is in the fallback chain (only Azure OpenAI for now - other providers disabled)
    if (!healthyProviders.includes(AIProviderName.AZURE_OPENAI)) {
      healthyProviders.push(AIProviderName.AZURE_OPENAI);
    }
    // Note: OpenAI, Gemini, Claude, Perplexity disabled - add back when API keys configured
    
    console.log('[AIOrchestrator] Provider chain (by health):', 
      healthyProviders.map(p => `${p}(${providerHealthMonitor.getHealthScore(p)})`).join(' → ')
    );
    
    // DYNAMIC MAX TOKENS based on message type and mode
    // 1. Casual messages (greetings, thanks) - very short responses
    // 2. Professional modes (deep-research, etc.) - comprehensive responses
    // 3. Calculation mode - concise, just show the math
    // 4. Standard queries - balanced responses
    const isCasualMessage = classification?.isCasualMessage === true;
    const isCalculationMode = chatMode === 'calculation';
    const professionalModes = ['deep-research', 'audit-plan', 'forensic-intelligence', 'deliverable-composer', 'roundtable'];
    const isComprehensiveMode = professionalModes.includes(chatMode || '');
    
    let maxTokensForMode: number;
    if (isCasualMessage) {
      maxTokensForMode = 200; // Very short for greetings/thanks
      console.log(`[AIOrchestrator] Casual message detected - using minimal tokens: ${maxTokensForMode}`);
    } else if (isCalculationMode) {
      maxTokensForMode = 2000; // Concise for calculations - just show the math
      console.log(`[AIOrchestrator] Calculation mode - using concise maxTokens: ${maxTokensForMode}`);
    } else if (isComprehensiveMode) {
      maxTokensForMode = 12000; // Comprehensive for research modes
      console.log(`[AIOrchestrator] Professional mode - using maxTokens: ${maxTokensForMode} for mode: ${chatMode}`);
    } else {
      maxTokensForMode = 8000; // Standard queries
      console.log(`[AIOrchestrator] Standard mode - using maxTokens: ${maxTokensForMode}`);
    }
    
    let lastError: any = null;
    
    // Try each provider in the health-ordered chain
    for (let i = 0; i < healthyProviders.length; i++) {
      const providerName = healthyProviders[i];
      const isLastProvider = i === healthyProviders.length - 1;
      
      // Check if provider is in cooldown
      const metrics = providerHealthMonitor.getHealthMetrics(providerName);
      if (metrics.rateLimitUntil && new Date() < metrics.rateLimitUntil) {
        console.log(`[AIOrchestrator] Skipping ${providerName} - in cooldown until ${metrics.rateLimitUntil.toISOString()}`);
        continue;
      }
      
      try {
        const provider = aiProviderRegistry.getProvider(providerName);
        
        // Get the appropriate model for this provider (undefined = use provider default)
        const providerModel = getModelForProvider(providerName);
        
        console.log(`[AIOrchestrator] Attempting ${providerName} (health: ${metrics.healthScore}) [${i + 1}/${healthyProviders.length}]${providerModel ? ` with model ${providerModel}` : ' (using default model)'}`);

        // Build the base request. When we have a conversationId, also attach
        // tool schemas in the provider's native shape and drive a tool-call
        // loop so the model can invoke read_whiteboard (etc).
        const baseRequest = {
          messages,
          model: providerModel, // Provider-specific model or undefined for default
          temperature: 0.7,
          maxTokens: maxTokensForMode, // Dynamic: 12K for deep-research, 8K for others
          attachment: attachment ? {
            buffer: attachment.buffer,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            documentType: attachment.documentType
          } : undefined
        };

        let response: CompletionResponse;
        const conversationId = options?.conversationId;
        if (conversationId && isFeatureEnabled('WHITEBOARD_V2')) {
          const registeredTools = toolRegistry.list();
          let requestWithTools = baseRequest as any;
          if (registeredTools.length > 0) {
            const isAnthropic = providerName === AIProviderName.CLAUDE;
            const toolsSchema = isAnthropic
              ? toolsToAnthropicSchema(registeredTools)
              : toolsToOpenAISchema(registeredTools);
            requestWithTools = { ...baseRequest, tools: toolsSchema };
          }
          response = await completeWithToolLoop(provider, requestWithTools, {
            conversationId,
            userId: options?.userId ?? '',
          });
        } else {
          response = await provider.generateCompletion(baseRequest);
        }
        
        // Record success with health monitor
        providerHealthMonitor.recordSuccess(providerName);
        
        console.log(`[AIOrchestrator] ✓ Success with ${providerName}`);
        
        return {
          content: response.content,
          tokensUsed: response.tokensUsed.total,
          providerUsed: providerName,
          modelUsed: providerModel || 'default',
          tokenBreakdown: {
            promptTokens: response.tokensUsed.input,
            completionTokens: response.tokensUsed.output,
            totalTokens: response.tokensUsed.total
          }
        };
      } catch (error: any) {
        // Record failure with health monitor
        providerHealthMonitor.recordFailure(providerName, error);
        
        lastError = error;
        
        // Log the error
        if (error instanceof ProviderError) {
          console.error(`[AIOrchestrator] ✗ ${error.provider} error: ${error.message}`);
          
          // If this is the last provider in the chain, return a user-friendly error
          if (isLastProvider) {
            return {
              content: this.buildFallbackErrorMessage(error),
              tokensUsed: 0,
              providerUsed: '',
              modelUsed: ''
            };
          }
        } else {
          console.error(`[AIOrchestrator] ✗ ${providerName} error:`, error?.message || error);
          
          // If this is the last provider, return generic error
          if (isLastProvider) {
            return {
              content: "I apologize, but I encountered an error processing your request. Please try again.",
              tokensUsed: 0,
              providerUsed: '',
              modelUsed: ''
            };
          }
        }
        
        // Continue to next provider
        console.log(`[AIOrchestrator] → Failing over to next provider...`);
      }
    }
    
    // All providers failed - return most relevant error
    if (lastError instanceof ProviderError) {
      return {
        content: this.buildFallbackErrorMessage(lastError),
        tokensUsed: 0,
        providerUsed: '',
        modelUsed: ''
      };
    }
    
    return {
      content: "I apologize, but all AI providers are currently unavailable. Please try again later.",
      tokensUsed: 0,
      providerUsed: '',
      modelUsed: ''
    };
  }

  /**
   * Build user-friendly error message from ProviderError
   */
  private buildFallbackErrorMessage(error: ProviderError): string {
    if (error.code === 'RATE_LIMIT_EXCEEDED' || error.message.includes('quota')) {
      return "I'm currently experiencing high demand. The AI service has reached its quota limit. However, I can still help with calculations directly. Please try asking your question again, or contact support for assistance.";
    } else if (error.code === 'AUTHENTICATION_ERROR' || error.message.includes('API key')) {
      return "There's a configuration issue with the AI service. Please contact support.";
    } else if (error.code === 'TIMEOUT_ERROR' || error.message.includes('timeout')) {
      return "The request took too long to process. Please try a simpler question or try again.";
    }
    
    return "I apologize, but I encountered an error processing your request. Please try again.";
  }

  // Helper methods to extract parameters from queries
  private extractFinancialRatioParameters(query: string): any | null {
    // Extract financial data from query
    const currentAssetsMatch = query.match(/(?:current assets?|CA)\s*(?:of|is|=|:)?\s*\$?([0-9,]+)(?:k|m)?/i);
    const currentLiabilitiesMatch = query.match(/(?:current liabilities?|CL)\s*(?:of|is|=|:)?\s*\$?([0-9,]+)(?:k|m)?/i);
    const inventoryMatch = query.match(/(?:inventory)\s*(?:of|is|=|:)?\s*\$?([0-9,]+)(?:k|m)?/i);
    
    if (currentAssetsMatch && currentLiabilitiesMatch) {
      return {
        currentAssets: this.parseNumber(currentAssetsMatch[1]),
        currentLiabilities: this.parseNumber(currentLiabilitiesMatch[1]),
        totalAssets: this.parseNumber(currentAssetsMatch[1]),
        totalLiabilities: this.parseNumber(currentLiabilitiesMatch[1]),
        inventory: inventoryMatch ? this.parseNumber(inventoryMatch[1]) : 0,
        netIncome: 0,
        equity: 0,
        historicalData: undefined
      };
    }
    
    return null;
  }
  
  private extractTaxParameters(query: string): { revenue: number; expenses: number; jurisdiction?: string; entityType: string } | null {
    // Simple extraction - in production this would be more sophisticated
    const revenueMatch = query.match(/(?:revenue|income|earnings)\s*(?:of|is)?\s*\$?([0-9,]+)(?:k|,000)?/i);
    const expensesMatch = query.match(/(?:expenses|costs)\s*(?:of|is)?\s*\$?([0-9,]+)(?:k|,000)?/i);
    
    if (revenueMatch) {
      const revenue = this.parseNumber(revenueMatch[1]);
      const expenses = expensesMatch ? this.parseNumber(expensesMatch[1]) : 0;
      
      let jurisdiction: string | undefined;
      if (query.includes('canada')) jurisdiction = 'canada';
      if (query.includes('uk') || query.includes('britain')) jurisdiction = 'uk';
      if (query.includes('india')) jurisdiction = 'india';
      if (query.includes('australia')) jurisdiction = 'australia';
      if (query.includes('singapore')) jurisdiction = 'singapore';
      
      let entityType = 'c-corp';
      if (query.includes('s-corp') || query.includes('s corp')) entityType = 's-corp';
      
      return { revenue, expenses, jurisdiction, entityType };
    }
    
    return null;
  }

  private extractCashFlows(query: string): number[] | null {
    const matches = query.match(/\[([0-9,.\s-]+)\]/);
    if (matches) {
      return matches[1].split(',').map(n => parseFloat(n.trim()));
    }
    return null;
  }

  private extractDiscountRate(query: string): number | null {
    const match = query.match(/(?:discount rate|rate)\s*(?:of|is)?\s*([0-9.]+)%?/i);
    if (match) {
      return parseFloat(match[1]) / 100;
    }
    return null;
  }

  private extractDepreciationParameters(query: string): any | null {
    const costMatch = query.match(/(?:cost|price)\s*(?:of|is)?\s*\$?([0-9,]+)/i);
    const lifeMatch = query.match(/([0-9]+)\s*(?:year|yr)/i);
    
    if (costMatch && lifeMatch) {
      return {
        cost: this.parseNumber(costMatch[1]),
        salvage: 0,
        life: parseInt(lifeMatch[1]),
        method: 'straight-line' as const,
        period: 1
      };
    }
    return null;
  }

  private extractLoanParameters(query: string): any | null {
    const principalMatch = query.match(/(?:loan|principal|amount)\s*(?:of|is)?\s*\$?([0-9,]+)/i);
    const rateMatch = query.match(/(?:rate|interest)\s*(?:of|is)?\s*([0-9.]+)%?/i);
    const yearsMatch = query.match(/([0-9]+)\s*(?:year|yr)/i);
    
    if (principalMatch && rateMatch && yearsMatch) {
      return {
        principal: this.parseNumber(principalMatch[1]),
        rate: parseFloat(rateMatch[1]) / 100,
        years: parseInt(yearsMatch[1]),
        paymentsPerYear: 12
      };
    }
    return null;
  }

  private parseNumber(str: string): number {
    const clean = str.replace(/,/g, '');
    const num = parseFloat(clean);
    if (str.includes('k') || str.includes('K')) {
      return num * 1000;
    }
    if (str.includes('m') || str.includes('M')) {
      return num * 1000000;
    }
    return num;
  }

  /**
   * Strip the "Start: ... Step N: ... End: ..." block from a workflow-mode
   * response so it isn't duplicated in chat when the whiteboard already shows
   * the structured workflow artifact.
   *
   * Everything AFTER "End: <line>" (typically explanatory narrative paragraphs)
   * is preserved unchanged. If the pattern doesn't match, the response is
   * returned as-is — we only strip when a clean Start:/End: block is present.
   *
   * Public so the SSE cache-hit path in routes.ts can apply the same
   * transformation to cached workflow responses — otherwise the cache path
   * would show the pre-strip prose in chat while the non-cache path wouldn't.
   */
  public stripWorkflowProse(response: string): string {
    const workflowBlock = /^\s*Start\s*:[\s\S]*?^\s*End\s*:[^\n]*\n?/m;
    if (!workflowBlock.test(response)) return response;
    return response.replace(workflowBlock, '').replace(/^\s+/, '');
  }

  /**
   * Parse separated content from professional modes
   * Extracts deliverable content and reasoning content
   */
  private parseSeparatedContent(response: string): {
    deliverable: string | null;
    reasoning: string | null;
    remainingContent: string | null;
  } {
    const deliverableMatch = response.match(/<DELIVERABLE>([\s\S]*?)<\/DELIVERABLE>/i);
    const reasoningMatch = response.match(/<REASONING>([\s\S]*?)<\/REASONING>/i);

    if (deliverableMatch && reasoningMatch) {
      return {
        deliverable: deliverableMatch[1].trim(),
        reasoning: reasoningMatch[1].trim(),
        remainingContent: null
      };
    }

    // Fallback: if no tags found, return original content
    return {
      deliverable: null,
      reasoning: null,
      remainingContent: response
    };
  }
}

export const aiOrchestrator = new AIOrchestrator();

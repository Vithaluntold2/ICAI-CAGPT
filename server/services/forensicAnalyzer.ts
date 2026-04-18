import { db } from "../db";
import { forensicDocuments, forensicFindings, forensicCases } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DocumentAnalyzerAgent } from "./agents/documentAnalyzer";
import { runForensicAgents } from "./agents/forensic";


/**
 * ForensicAnalyzer - Analyzes financial documents for anomalies and fraud indicators
 * 
 * This service uses Azure Document Intelligence to extract data from financial documents,
 * then applies forensic accounting heuristics and AI analysis to detect anomalies.
 */
export class ForensicAnalyzer {
  private static documentAnalyzer = new DocumentAnalyzerAgent();

  /**
   * Analyze a document for forensic findings
   */
  static async analyzeDocument(documentId: string, fileBuffer: Buffer, mimeType: string, filename: string = 'document') {
    try {
      // Use DocumentAnalyzerAgent for document analysis
      const analysisResult = await this.documentAnalyzer.analyzeDocument(fileBuffer, filename, mimeType);
      
      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Document analysis failed');
      }
      
      // Build extracted data payload. Includes:
      //   - items[]: per-row objects (for forensic per-row detection)
      //   - tables[]: preserved for evidence/provenance
      //   - keyValuePairs: field-level extractions
      //   - extractedText: full OCR/text body (for LLM and narrative analysis)
      const a = analysisResult.analysis as any;
      const extractedData = {
        ...(a.structuredData || {}),
        ...(a.keyValuePairs ? { keyValuePairs: a.keyValuePairs } : {}),
        ...(a.tables ? { tables: a.tables } : {}),
        ...(a.extractedText ? { extractedText: a.extractedText } : {}),
      };

      await db.update(forensicDocuments)
        .set({
          extractedData,
          documentMetadata: {
            documentType: a.documentType,
            keyFindings: a.keyFindings,
            provider: analysisResult.provider
          },
          analysisStatus: 'analyzed'
        })
        .where(eq(forensicDocuments.id, documentId));
      
      // Get document and case
      const [document] = await db
        .select()
        .from(forensicDocuments)
        .where(eq(forensicDocuments.id, documentId))
        .limit(1);
      
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Run forensic analysis heuristics on the same payload we just persisted
      // so row-level detection sees items[] when present (PDF tables + CSV/XLSX).
      const findings = await this.detectAnomalies(document, extractedData);
      
      // Store findings
      for (const finding of findings) {
        await db.insert(forensicFindings).values({
          caseId: document.caseId,
          documentId: document.id,
          ...finding
        });
      }
      
      // Update case statistics
      await this.updateCaseStats(document.caseId);
      
    } catch (error) {
      console.error(`[ForensicAnalyzer] Analysis failed for document ${documentId}:`, error);
      
      // Mark document as failed
      await db.update(forensicDocuments)
        .set({ analysisStatus: 'flagged' })
        .where(eq(forensicDocuments.id, documentId));
      
      throw error;
    }
  }
  
  /**
   * Detect anomalies using forensic algorithmic agents
   */
  private static async detectAnomalies(document: any, extractedData: any): Promise<any[]> {
    console.log('[ForensicAnalyzer] Running algorithmic forensic agents...');

    const items = Array.isArray(extractedData?.items) ? extractedData.items : [];

    try {
      const docLevelFindings = await runForensicAgents({
        document,
        extractedData,
      });

      // For tabular datasets, also run per-row detection so the checklist patterns
      // (round amount, weekend, structuring, vendor validation) surface on transactions.
      let rowLevelFindings: any[] = [];
      if (items.length >= 5) {
        rowLevelFindings = await this.runPerRowDetection(document, items);
      }

      const all = [...docLevelFindings, ...rowLevelFindings];
      console.log(`[ForensicAnalyzer] Agents completed: ${docLevelFindings.length} doc-level + ${rowLevelFindings.length} row-level = ${all.length} findings.`);
      return all;
    } catch (error) {
      console.error('[ForensicAnalyzer] Agent processing failed:', error);
      return [];
    }
  }

  /**
   * Per-row forensic detection for tabular datasets.
   * Uses the same agents that operate on a single-document shape, treating each row
   * as a synthetic extractedData object. Caps per-category findings to avoid spam.
   */
  private static async runPerRowDetection(document: any, items: Array<Record<string, any>>): Promise<any[]> {
    const { RoundNumberAgent, WeekendHolidayAgent, ThresholdSplitAgent, VendorValidationAgent } =
      await import('./agents/forensic/statAgents');

    const agents = [
      new RoundNumberAgent(),
      new WeekendHolidayAgent(),
      new ThresholdSplitAgent(),
      new VendorValidationAgent(),
    ];

    const CAP_PER_CATEGORY = 10;
    const bucket: Record<string, any[]> = {};

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      for (const agent of agents) {
        try {
          const findings = await agent.analyze({ document, extractedData: row });
          for (const f of findings) {
            const key = f.title || agent.name;
            bucket[key] = bucket[key] || [];
            if (bucket[key].length >= CAP_PER_CATEGORY) continue;
            bucket[key].push({
              ...f,
              evidenceDetails: { rowIndex: i, row, ...(f.evidenceDetails || {}) },
            });
          }
        } catch (err) {
          // silent; don't let one row kill the pass
        }
      }
    }

    return Object.values(bucket).flat();
  }
  
  /**
   * Update case-level statistics
   */
  private static async updateCaseStats(caseId: string) {
    // Get all findings for this case
    const findings = await db
      .select()
      .from(forensicFindings)
      .where(eq(forensicFindings.caseId, caseId));
    
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    
    // Calculate overall risk score (0-100)
    let riskScore = 0;
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical': riskScore += 25; break;
        case 'high': riskScore += 15; break;
        case 'medium': riskScore += 8; break;
        case 'low': riskScore += 3; break;
      }
    });
    
    riskScore = Math.min(riskScore, 100);
    
    // Determine severity level
    let severityLevel = 'low';
    if (riskScore >= 75) severityLevel = 'critical';
    else if (riskScore >= 50) severityLevel = 'high';
    else if (riskScore >= 25) severityLevel = 'medium';
    
    // Update case
    await db.update(forensicCases)
      .set({
        totalFindings,
        criticalFindings,
        overallRiskScore: riskScore,
        severityLevel
      })
      .where(eq(forensicCases.id, caseId));
  }
}

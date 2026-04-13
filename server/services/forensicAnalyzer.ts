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
      
      // Update document with extracted data
      await db.update(forensicDocuments)
        .set({
          extractedData: analysisResult.analysis.structuredData || analysisResult.analysis.keyValuePairs || {},
          documentMetadata: {
            documentType: analysisResult.analysis.documentType,
            keyFindings: analysisResult.analysis.keyFindings,
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
      
      // Run forensic analysis heuristics using extracted data
      const extractedData = analysisResult.analysis.structuredData || analysisResult.analysis.keyValuePairs || {};
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
    
    try {
      // Run the suite of 8 statistical/algorithmic agents
      const findings = await runForensicAgents({
        document,
        extractedData
      });
      
      console.log(`[ForensicAnalyzer] Agents completed with ${findings.length} findings.`);
      return findings;
      
    } catch (error) {
      console.error('[ForensicAnalyzer] Agent processing failed:', error);
      return [];
    }
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

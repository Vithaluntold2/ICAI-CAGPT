import { ForensicAgent, ForensicContext, ForensicFinding } from "./types";
import { AIProviderRegistry } from "../../../aiProviders/registry";
import { AIProviderName } from "../../../aiProviders/types";

export class DeepForensicAgent implements ForensicAgent {
  name = "Deep Forensic AI Investigator";

  async analyze(context: ForensicContext): Promise<ForensicFinding[]> {
    const findings: ForensicFinding[] = [];
    
    try {
      const registry = AIProviderRegistry.getInstance();
      const availableProviders = registry.getAvailableProviderNames();
      
      // We need a smart model for this.
      const smartModels = [
          AIProviderName.OPENAI, 
          AIProviderName.CLAUDE, 
          AIProviderName.GEMINI, 
          AIProviderName.AZURE_OPENAI
      ];
      
      const providerName = smartModels.find(p => availableProviders.includes(p));
      
      if (!providerName) {
        console.warn('[DeepForensicAgent] No advanced AI provider available. Skipping deep analysis.');
        return [];
      }
      
      const provider = registry.getProvider(providerName);
      
      const prompt = `
        You are an elite Forensic Accountant and Fraud Examiner (CFE) with decades of experience.
        Your goal is to detect financial irregularities, potential fraud, and compliance risks in the provided document data.
        
        CONTEXT:
        Document Type: ${context.document.documentMetadata?.documentType || 'Unknown'}
        
        EXTRACTED DATA:
        ${JSON.stringify(context.extractedData, null, 2)}
        
        INSTRUCTIONS:
        1. Analyze the data for:
           - Inconsistencies between line items and totals
           - Unusual or high-risk line item descriptions
           - Tax calculation errors or irregularities
           - Indicators of shell companies or phantom vendors
           - Logical timestamp anomalies (e.g. invoice date after due date)
           - Contextual oddities that statistical rules miss
        
        2. STRICTLY IGNORE these common heuristic findings (already covered by other agents):
           - Round numbers
           - Weekend/Holiday dates
           - Benford's law
           - Simple duplicate checks
           - Missing basic fields (Vendor, Date, Amount)
        
        3. Output your findings in valid JSON format only.
        
        OUTPUT SCHEMA:
        {
          "findings": [
            {
              "findingType": "anomaly" | "fraud_indicator" | "compliance_issue",
              "severity": "low" | "medium" | "high" | "critical",
              "title": "Short, Punchy Title",
              "description": "Detailed technical explanation of why this is suspicious.",
              "impactedMetrics": { "metric": "value" }, 
              "remediationJson": { "action": "specific_action_code", "priority": "severity" }
            }
          ]
        }
      `;

      const response = await provider.generateCompletion({
          messages: [
              { role: 'system', content: 'You are a forensic accounting AI. Return JSON only.' },
              { role: 'user', content: prompt }
          ],
          temperature: 0.1, // Low temp for precision
          jsonMode: true
      });

      const content = response.choices[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const result = JSON.parse(cleanJson);
      
      if (result.findings && Array.isArray(result.findings)) {
          // Add source attribution
          result.findings.forEach((f: any) => {
              findings.push({
                  ...f,
                  evidenceDetails: { 
                      source: `Deep Forensic AI (${providerName})`, 
                      ...f.evidenceDetails 
                  }
              });
          });
      }

    } catch (error) {
      console.error('[DeepForensicAgent] Analysis failed:', error);
    }

    return findings;
  }
}

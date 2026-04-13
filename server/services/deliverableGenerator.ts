import { db } from "../db";
import { deliverableTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { aiOrchestrator } from "./aiOrchestrator";
import { 
  SituationSummarizer, 
  OptionsGenerator, 
  ProConAnalyzer, 
  RecommendationFormulator, 
  ActionPlanDeveloper 
} from "./agents/deliverableComposerPart2";
import { ExecutiveSummaryGenerator } from "./agents/deliverableComposerPart1";

/**
 * DeliverableGenerator - Generates professional accounting documents using AI
 * 
 * This service creates expert-level deliverables (audit plans, tax memos, checklists)
 * by combining template structures with AI-generated content and real-world citations.
 */
export class DeliverableGenerator {
  /**
   * Generate a professional deliverable from a template
   */
  static async generate(templateId: string, variables: Record<string, any>, userId: string) {
    // Fetch template
    const [template] = await db
      .select()
      .from(deliverableTemplates)
      .where(eq(deliverableTemplates.id, templateId))
      .limit(1);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Check if this is an advisory/strategy document suitable for the Agent Chain
    const isAdvisory = template.type === 'advisory_letter' || template.name.toLowerCase().includes('strategy') || template.name.toLowerCase().includes('advisory');

    if (isAdvisory) {
        console.log('[DeliverableGenerator] Detected Advisory/Strategy request. Engaging Multi-Agent Workflow.');
        return this.generateWithAgents(template, variables, userId);
    }
    
    // Default: Single Prompt Generation
    const prompt = this.buildGenerationPrompt(template, variables);
    
    // Generate content using AI
    const response = await aiOrchestrator.processQuery(
      prompt,
      [],
      'premium',
      userId
    );
    
    // Extract citations if present
    const citations = this.extractCitations(response.response);
    
    return {
      title: variables.deliverableTitle || template.name,
      type: template.type,
      content: response.response,
      citations,
      modelUsed: response.modelUsed,
      tokensUsed: response.tokensUsed
    };
  }

  /**
   * Execute the Multi-Agent Chain for Deep Advisory
   */
  private static async generateWithAgents(template: any, variables: any, userId: string) {
      const startTime = Date.now();
      
      // 1. Situation Analysis
      const summarizer = new SituationSummarizer();
      const sitResult = await summarizer.execute({ 
          query: "Analyze Situation", 
          data: { situation: { 
              description: variables.situation_description || `Client ${variables.client_name} requires strategic advice on ${template.name}.`,
              issues: variables.key_issues ? [variables.key_issues] : [],
              urgent: variables.urgency === 'high'
          }}, 
          timestamp: Date.now() 
      });

      // 2. Options Generation
      const optionsGen = new OptionsGenerator();
      const optResult = await optionsGen.execute({
          query: "Generate Options",
          data: { situation: sitResult.data.summary },
          timestamp: Date.now()
      });

      // 3. Pro/Con Analysis
      const complexAnalyzer = new ProConAnalyzer();
      const analResult = await complexAnalyzer.execute({
          query: "Analyze Options",
          data: { options: optResult.data.options },
          timestamp: Date.now()
      });

      // 4. Recommendation
      const recommender = new RecommendationFormulator();
      const recResult = await recommender.execute({
          query: "Formulate Recommendation",
          data: { analysis: analResult.data.analysis },
          timestamp: Date.now()
      });

      // 5. Action Plan
      const planner = new ActionPlanDeveloper();
      const planResult = await planner.execute({
          query: "Develop Action Plan",
          data: { recommendation: recResult.data.recommendation },
          timestamp: Date.now()
      });

      // 6. Executive Summary (Drafting final doc)
      // We manually compose the markdown from the structured agents output
      const md = `
# ${variables.deliverableTitle || template.name}

**Prepared for:** ${variables.client_name || 'Valued Client'}
**Date:** ${new Date().toLocaleDateString()}
**Advisory Type:** Strategic Analysis (AI-Enhanced)

---

## 1. Executive Situation Summary
${sitResult.data.summary.background}

**Current State:** ${sitResult.data.summary.currentState}
**Key Issues:**
${(sitResult.data.summary.keyIssues || []).map((i: any) => `- ${i}`).join('\n')}

---

## 2. Strategic Options Analyzed

We have evaluated the following strategic paths:

${(optResult.data.options || []).map((o: any) => `### Option ${o.id}: ${o.name}
${o.description}
* **Pros:** ${o.pros.join(', ')}
* **Cons:** ${o.cons.join(', ')}
* **Suitability:** ${o.suitability}
`).join('\n')}

---

## 3. Professional Recommendation

**Recommended Path:** ${recResult.data.recommendation.recommended}

### Rationale
${recResult.data.recommendation.rationale}

### Expected Benefits
${(recResult.data.recommendation.expectedBenefits || []).map((b: any) => `- ${b}`).join('\n')}

---

## 4. Implementation Action Plan

**Timeline:** ${planResult.data.recommendationContext.timeline}
**Estimated Budget:** ${planResult.data.actionPlan.budget}

### Phased Execution
${(planResult.data.actionPlan.phases || []).map((p: any) => `
**Phase ${p.phase}: ${p.name}** (${p.duration})
${p.tasks.map((t: any) => `- [ ] ${t}`).join('\n')}
`).join('\n')}

---
*Generated by ICAI CAGPT Multi-Agent Advisory System*
      `;

      return {
        title: variables.deliverableTitle || template.name,
        type: template.type,
        content: md,
        citations: [], // Agents don't support citations yet
        modelUsed: 'ICAI CAGPT-Swarm-v1', // Virtual model name
        tokensUsed: 0
      };
  }
  
  /**
   * Build AI generation prompt from template and variables
   */
  private static buildGenerationPrompt(template: any, variables: Record<string, any>): string {
    const variableList = Object.entries(variables)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    
    return `You are an expert CPA generating a professional ${template.type} document.

Document Type: ${template.name}
Description: ${template.description || 'Professional accounting deliverable'}

Client Variables:
${variableList}

Template Structure:
${template.contentTemplate}

Instructions:
1. Generate a complete, professional ${template.type} using the template structure above
2. Replace all {{variable_name}} placeholders with actual values from the client variables
3. Include specific, actionable content appropriate for this client
4. Add relevant citations to authoritative sources (IRS codes, GAAP standards, PCAOB guidance)
5. Use professional language and proper formatting
6. For checklists, provide detailed action items with deadlines
7. For memos, include executive summary, analysis, and recommendations
8. For audit plans, specify procedures, timing, and responsible parties

Format the output in clean Markdown with appropriate headers, lists, and emphasis.
Include [Citation: Source Name, Section X.X] format for all authoritative references.

Generate the complete deliverable now:`;
  }
  
  /**
   * Extract citations from generated content
   */
  private static extractCitations(content: string): any[] {
    const citationRegex = /\[Citation: ([^\]]+)\]/g;
    const citations: any[] = [];
    let match;
    
    while ((match = citationRegex.exec(content)) !== null) {
      citations.push({
        source: match[1],
        location: match.index
      });
    }
    
    return citations;
  }
}

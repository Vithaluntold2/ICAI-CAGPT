/**
 * Roundtable Mode - Collaborative Multi-Expert Discussion
 * 6 agents for facilitating structured expert discussions and consensus building
 * Now with AI integration for intelligent responses
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';

// Provider-specific model mapping
const PROVIDER_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: 'gpt-4o',
  [AIProviderName.OPENAI]: 'gpt-4o',
  [AIProviderName.CLAUDE]: 'claude-3-5-sonnet-20241022',
  [AIProviderName.GEMINI]: 'gemini-1.5-pro',
};

// Helper function to get AI-generated response with retry logic
async function getAIResponse(
  systemPrompt: string, 
  userPrompt: string, 
  maxTokens: number = 1000
): Promise<string> {
  // Try providers in order with proper error handling per provider
  const providerOrder = [
    AIProviderName.AZURE_OPENAI,
    AIProviderName.OPENAI,
    AIProviderName.CLAUDE,
    AIProviderName.GEMINI,
  ];
  
  const errors: string[] = [];
  
  for (const providerName of providerOrder) {
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;
      
      const model = PROVIDER_MODELS[providerName] || 'gpt-4o';
      const response = await provider.generateCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens,
        temperature: 0.7,
      });
      return response.content;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${providerName}: ${errMsg}`);
      console.warn(`[RoundtableAgents] Provider ${providerName} failed, trying next:`, errMsg);
      // Continue to next provider
    }
  }
  
  // All providers failed
  console.error('[RoundtableAgents] All AI providers failed:', errors);
  return `Analysis pending: ${userPrompt.substring(0, 100)}...`;
}

export class ExpertAssembler extends EventEmitter implements AgentDefinition {
  id = 'expert-assembler';
  name = 'Expert Assembler';
  mode = 'roundtable' as const;
  capabilities = ['expert-selection', 'team-assembly'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const query = input.data.query as string;
    const domain = input.data.domain as string;
    
    // Use AI to determine the best expert composition
    const systemPrompt = `You are an expert team assembler for financial and accounting discussions. 
Analyze the query and suggest 3-5 relevant experts with their specializations.
Return a JSON array of objects with 'role' and 'expertise' (array) fields.`;
    
    const userPrompt = `Query: "${query}"
Domain: ${domain || 'general finance'}

Select the most relevant experts for this discussion. Consider tax, audit, forensic, 
international, and compliance aspects based on the query.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 500);
      
      // Try to parse AI response as JSON
      let experts: Array<{ role: string; expertise: string[] }>;
      try {
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          experts = JSON.parse(jsonMatch[0]);
        } else {
          experts = this.selectExperts(domain, query);
        }
      } catch {
        experts = this.selectExperts(domain, query);
      }
      
      return {
        success: true,
        data: { 
          experts,
          assemblyRationale: `Selected ${experts.length} experts for ${domain || 'finance'} domain based on query analysis`,
          estimatedDuration: experts.length * 5 + ' minutes',
          aiGenerated: true,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
      };
    } catch (error) {
      // Fallback to static selection
      const experts = this.selectExperts(domain, query);
      return {
        success: true,
        data: { 
          experts,
          assemblyRationale: `Selected ${experts.length} experts for ${domain} domain`,
          estimatedDuration: experts.length * 5 + ' minutes',
          aiGenerated: false,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.85 },
      };
    }
  }

  private selectExperts(domain: string, query: string): Array<{ role: string; expertise: string[] }> {
    const baseExperts = [
      { role: 'Tax Strategist', expertise: ['tax planning', 'compliance', 'regulations'] },
      { role: 'Financial Advisor', expertise: ['investments', 'wealth management', 'portfolio'] },
    ];

    // Domain-specific experts
    if (domain.includes('international') || query.toLowerCase().includes('cross-border')) {
      baseExperts.push({ role: 'International Tax Expert', expertise: ['transfer pricing', 'treaty', 'BEPS'] });
    }

    if (domain.includes('audit') || query.toLowerCase().includes('compliance')) {
      baseExperts.push({ role: 'Audit Specialist', expertise: ['internal controls', 'risk assessment', 'procedures'] });
    }

    if (domain.includes('forensic') || query.toLowerCase().includes('investigation')) {
      baseExperts.push({ role: 'Forensic Accountant', expertise: ['fraud detection', 'investigation', 'litigation support'] });
    }

    return baseExperts.slice(0, 5); // Max 5 experts for manageable discussion
  }
}

export class DiscussionModerator extends EventEmitter implements AgentDefinition {
  id = 'discussion-moderator';
  name = 'Discussion Moderator';
  mode = 'roundtable' as const;
  capabilities = ['moderation', 'facilitation', 'agenda-management'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const experts = (input.data.experts || 
      input.data.previousOutputs?.['expert-assembler']?.data?.experts || []) as any[];
    const query = input.data.query as string;
    
    // Use AI to create optimized discussion agenda
    const systemPrompt = `You are a professional discussion moderator for expert financial roundtables.
Create a tailored discussion agenda based on the query complexity and participating experts.
Return JSON with: agenda (array of phases with title, duration, participants, focus), rules (array), estimatedDuration (string).`;

    const userPrompt = `Query: "${query}"

Participating Experts (${experts?.length || 0}):
${experts?.map((e: any) => `- ${e.role}: ${e.expertise?.join(', ') || 'general expertise'}`).join('\n') || 'No experts specified'}

Create an optimized agenda for this expert discussion.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 800);
      
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            data: { 
              agenda: parsed.agenda || this.buildFallbackAgenda(experts, query),
              rules: parsed.rules || this.getDefaultRules(),
              totalDuration: parsed.estimatedDuration || `${(experts?.length || 3) * 10} minutes`,
              currentPhase: parsed.agenda?.[0] || { phase: 1, title: 'Problem Definition' },
              aiGenerated: true,
            },
            metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
          };
        }
      } catch {
        // Fall through to fallback
      }
    } catch {
      // Fall through to fallback
    }
    
    // Fallback to structured agenda
    const agenda = this.buildFallbackAgenda(experts, query);
    return {
      success: true,
      data: { 
        agenda,
        rules: this.getDefaultRules(),
        totalDuration: agenda.reduce((sum, item) => sum + item.duration, 0) + ' minutes',
        currentPhase: agenda[0],
        aiGenerated: false,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 1.0 },
    };
  }

  private buildFallbackAgenda(experts: any[], query: string): any[] {
    const queryLength = query?.length || 0;
    const isComplex = queryLength > 200 || (query?.includes('?') && query.split('?').length > 2);
    const durationMultiplier = isComplex ? 1.5 : 1.0;
    
    return [
      { phase: 1, title: 'Problem Definition', duration: Math.round(5 * durationMultiplier), participants: 'All', focus: isComplex ? 'Breaking down multi-faceted question' : 'Clarifying the core issue' },
      { phase: 2, title: 'Expert Perspectives', duration: Math.round((experts?.length || 3) * 3 * durationMultiplier), participants: 'Individual experts', focus: 'Diverse viewpoints and specialized knowledge' },
      { phase: 3, title: 'Cross-Examination', duration: Math.round(10 * durationMultiplier), participants: 'All', focus: 'Challenging assumptions and reconciling differences' },
      { phase: 4, title: 'Synthesis & Consensus', duration: Math.round(8 * durationMultiplier), participants: 'All', focus: 'Building unified understanding' },
      { phase: 5, title: 'Recommendations', duration: Math.round(5 * durationMultiplier), participants: 'Moderator-led', focus: 'Actionable conclusions' },
    ];
  }

  private getDefaultRules(): string[] {
    return [
      'Respect all perspectives',
      'Stay focused on the question',
      'Provide evidence-based arguments',
      'Allow others to complete their points',
      'Build on previous contributions',
    ];
  }
}

export class PerspectiveCollector extends EventEmitter implements AgentDefinition {
  id = 'perspective-collector';
  name = 'Perspective Collector';
  mode = 'roundtable' as const;
  capabilities = ['perspective-gathering', 'opinion-synthesis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const experts = (input.data.experts || input.data.previousOutputs?.['expert-assembler']?.data?.experts || []) as any[];
    const query = input.data.query as string;
    
    // Use AI to generate expert perspectives
    const systemPrompt = `You are simulating a roundtable discussion with multiple financial experts.
For each expert, generate a unique perspective on the query that reflects their specialty.
Return a JSON array with objects containing: expert, position (1-2 sentences), keyPoints (array of 3 points), confidence (0-1).`;

    const userPrompt = `Query: "${query}"

Experts participating:
${experts.map((e: any, i: number) => `${i + 1}. ${e.role} - Expertise: ${e.expertise?.join(', ') || 'general'}`).join('\n')}

Generate each expert's unique perspective based on their specialty.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1500);
      
      let perspectives: any[];
      try {
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          perspectives = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback to static generation
          perspectives = experts.map((expert: any, i: number) => ({
            expert: expert.role,
            position: this.generatePosition(expert.role, query, i),
            keyPoints: this.generateKeyPoints(expert.role),
            evidenceType: this.getEvidenceType(expert.role),
            confidence: this.calculateConfidence(expert, query, '', []),
          }));
        }
      } catch {
        perspectives = experts.map((expert: any, i: number) => ({
          expert: expert.role,
          position: this.generatePosition(expert.role, query, i),
          keyPoints: this.generateKeyPoints(expert.role),
          evidenceType: this.getEvidenceType(expert.role),
          confidence: this.calculateConfidence(expert, query, '', []),
        }));
      }

      const agreements = this.findAgreements(perspectives);
      const disagreements = this.findDisagreements(perspectives);

      return {
        success: true,
        data: { 
          perspectives,
          agreements,
          disagreements,
          consensusLevel: this.calculateConsensus(perspectives),
          aiGenerated: true,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.92 },
      };
    } catch (error) {
      // Fallback to static generation
      const perspectives = experts.map((expert: any, i: number) => {
        const position = this.generatePosition(expert.role, query, i);
        const keyPoints = this.generateKeyPoints(expert.role);
        const confidence = this.calculateConfidence(expert, query, position, keyPoints);
        
        return {
          expert: expert.role,
          position,
          keyPoints,
          evidenceType: this.getEvidenceType(expert.role),
          confidence,
        };
      });

      const agreements = this.findAgreements(perspectives);
      const disagreements = this.findDisagreements(perspectives);

      return {
        success: true,
        data: { 
          perspectives,
          agreements,
          disagreements,
          consensusLevel: this.calculateConsensus(perspectives),
          aiGenerated: false,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.88 },
      };
    }
  }

  private generatePosition(role: string, query: string, index: number): string {
    // Extract key terms from query for context-aware positions
    const queryLower = query.toLowerCase();
    const isTaxQuery = queryLower.includes('tax') || queryLower.includes('deduction');
    const isAuditQuery = queryLower.includes('audit') || queryLower.includes('compliance');
    const isFinancialQuery = queryLower.includes('investment') || queryLower.includes('portfolio');
    
    // Role-specific position generation
    if (role.includes('Tax') && isTaxQuery) {
      return `From a ${role.toLowerCase()} perspective, this tax matter requires careful analysis of applicable regulations and optimization opportunities`;
    } else if (role.includes('Audit') && isAuditQuery) {
      return `As a ${role.toLowerCase()}, I recommend a balanced approach focusing on compliance requirements and internal control effectiveness`;
    } else if (role.includes('Financial') && isFinancialQuery) {
      return `In my view as ${role.toLowerCase()}, the priority should be risk-adjusted returns and portfolio optimization`;
    }
    
    // Generic positions with role context
    const positions = [
      `From a ${role.toLowerCase()} perspective, this requires careful analysis of regulatory and business implications`,
      `As a ${role.toLowerCase()}, I recommend a balanced approach that addresses both compliance and operational considerations`,
      `In my view as ${role.toLowerCase()}, the priority should be thorough assessment and risk mitigation`,
    ];
    return positions[index % positions.length];
  }

  private generateKeyPoints(role: string): string[] {
    return [
      `Consider ${role.toLowerCase()} implications`,
      'Evaluate regulatory requirements',
      'Assess risk-return tradeoffs',
    ];
  }

  private getEvidenceType(role: string): string {
    const evidenceMap: Record<string, string> = {
      'Tax Strategist': 'Statutory provisions and case law',
      'Financial Advisor': 'Market data and historical performance',
      'Audit Specialist': 'Internal control frameworks and standards',
      'Forensic Accountant': 'Investigative findings and red flag indicators',
      'International Tax Expert': 'Treaty provisions and OECD guidelines',
    };
    return evidenceMap[role] || 'Professional judgment and standards';
  }

  /**
   * Calculate confidence based on actual content analysis
   * Factors: expertise match, query relevance, evidence strength
   */
  private calculateConfidence(expert: any, query: string, position: string, keyPoints: string[]): number {
    let confidence = 0.7; // Base confidence

    // Expertise match: check if expert's expertise matches query terms
    const queryLower = query.toLowerCase();
    const expertiseMatch = expert.expertise?.filter((e: string) => 
      queryLower.includes(e.toLowerCase()) || e.toLowerCase().includes(queryLower.split(' ')[0])
    ).length || 0;
    confidence += Math.min(expertiseMatch * 0.05, 0.15); // Up to +0.15

    // Position specificity: longer, more detailed positions indicate more confidence
    const positionWords = position.split(' ').length;
    confidence += Math.min(positionWords * 0.01, 0.05); // Up to +0.05

    // Key points relevance: more points = higher confidence
    confidence += Math.min(keyPoints.length * 0.02, 0.06); // Up to +0.06

    // Role-based confidence adjustment
    const roleConfidence: Record<string, number> = {
      'Tax Strategist': 0.02,
      'International Tax Expert': 0.03,
      'Audit Specialist': 0.02,
      'Forensic Accountant': 0.01,
      'Financial Advisor': 0.02,
    };
    confidence += roleConfidence[expert.role] || 0;

    // Cap at 0.95 max
    return Math.min(confidence, 0.95);
  }

  private findAgreements(perspectives: any[]): string[] {
    // Extract common themes from all expert positions
    const agreements: string[] = [];
    
    // Check if all experts mention compliance
    const allMentionCompliance = perspectives.every(p => 
      p.position?.toLowerCase().includes('compliance') || 
      p.keyPoints?.some((kp: string) => kp.toLowerCase().includes('compliance'))
    );
    if (allMentionCompliance) {
      agreements.push('All experts agree on the importance of compliance');
    }
    
    // Check for risk-related consensus
    const allMentionRisk = perspectives.every(p => 
      p.position?.toLowerCase().includes('risk') || 
      p.keyPoints?.some((kp: string) => kp.toLowerCase().includes('risk'))
    );
    if (allMentionRisk) {
      agreements.push('Consensus on risk mitigation priorities');
    }
    
    // Check for documentation consensus
    const allMentionDocumentation = perspectives.every(p => 
      p.position?.toLowerCase().includes('document') ||
      p.keyPoints?.some((kp: string) => kp.toLowerCase().includes('document'))
    );
    if (allMentionDocumentation) {
      agreements.push('All experts emphasize thorough documentation');
    }
    
    // Fallback if no specific agreements found
    if (agreements.length === 0 && perspectives.length > 1) {
      agreements.push('Experts agree on the need for careful analysis');
    }
    
    return agreements;
  }

  private findDisagreements(perspectives: any[]): string[] {
    const disagreements: string[] = [];
    
    if (perspectives.length === 0) return disagreements;
    
    // Analyze confidence variance - high variance indicates disagreement
    const confidences = perspectives.map(p => p.confidence || 0.8);
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
    
    if (variance > 0.02) {
      disagreements.push('Varying confidence levels across experts indicate differing viewpoints');
    }
    
    // Check for timeline mentions with different perspectives
    const timelineMentions = perspectives.filter(p => 
      p.position?.toLowerCase().includes('timeline') || 
      p.position?.toLowerCase().includes('duration') ||
      p.keyPoints?.some((kp: string) => kp.toLowerCase().includes('timeline'))
    );
    if (timelineMentions.length > 0 && timelineMentions.length < perspectives.length) {
      disagreements.push('Differing views on implementation timeline');
    }
    
    // Check for cost-related disagreements
    const costMentions = perspectives.filter(p => 
      p.position?.toLowerCase().includes('cost') || 
      p.keyPoints?.some((kp: string) => kp.toLowerCase().includes('cost'))
    );
    if (costMentions.length > 0 && costMentions.length < perspectives.length) {
      disagreements.push('Debate on cost-benefit analysis');
    }
    
    return disagreements;
  }

  private calculateConsensus(perspectives: any[]): string {
    if (perspectives.length === 0) return 'No Perspectives';
    const avgConfidence = perspectives.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / perspectives.length;
    if (avgConfidence > 0.85) return 'Strong Consensus';
    if (avgConfidence > 0.75) return 'Moderate Consensus';
    return 'Divergent Views';
  }
}

export class ArgumentAnalyzer extends EventEmitter implements AgentDefinition {
  id = 'argument-analyzer';
  name = 'Argument Analyzer';
  mode = 'roundtable' as const;
  capabilities = ['argument-analysis', 'logic-evaluation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const perspectives = (input.data.perspectives || 
      input.data.previousOutputs?.['perspective-collector']?.data?.perspectives || []) as any[];
    const query = input.data.query as string;
    
    // Use AI for argument analysis
    const systemPrompt = `You are analyzing arguments from a financial expert discussion.
Evaluate each expert's argument for strength, logical consistency, evidence quality, and potential biases.
Return JSON with: analysis (array of {expert, argumentStrength 0-1, logicalConsistency 0-1, evidenceQuality 0-1, biasDetection 0-1, overallScore 0-1, keyStrengths, weaknesses}), strongestArguments (top 3), averageQuality (0-1).`;

    const userPrompt = `Query: "${query}"

Expert Perspectives to Analyze:
${perspectives.map((p: any, i: number) => `
${i + 1}. ${p.expert}:
   Position: ${p.position}
   Key Points: ${(p.keyPoints || []).join(', ')}
   Evidence: ${p.evidenceType || 'Not specified'}
   Confidence: ${p.confidence}`).join('\n')}

Analyze each argument's quality and identify the strongest positions.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1500);
      
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            data: { 
              analysis: parsed.analysis || this.buildFallbackAnalysis(perspectives),
              strongestArguments: parsed.strongestArguments || [],
              averageQuality: parsed.averageQuality || 0.75,
              aiGenerated: true,
            },
            metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.88 },
          };
        }
      } catch {
        // Fall through to fallback
      }
    } catch {
      // Fall through to fallback
    }
    
    // Fallback to algorithmic analysis
    const analysis = this.buildFallbackAnalysis(perspectives);
    const strongestArguments = [...analysis]
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3);

    return {
      success: true,
      data: { 
        analysis,
        strongestArguments,
        averageQuality: analysis.reduce((sum, a) => sum + a.overallScore, 0) / Math.max(analysis.length, 1),
        aiGenerated: false,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.85 },
    };
  }

  private buildFallbackAnalysis(perspectives: any[]): any[] {
    return perspectives.map(p => {
      const argumentStrength = this.assessArgumentStrength(p);
      const logicalConsistency = this.assessLogicalConsistency(p);
      const evidenceQuality = this.assessEvidenceQuality(p);
      const biasDetection = this.detectBias(p);
      const overallScore = argumentStrength * 0.3 + logicalConsistency * 0.3 + evidenceQuality * 0.25 + (1 - biasDetection) * 0.15;
      
      return {
        expert: p.expert,
        argumentStrength,
        logicalConsistency,
        evidenceQuality,
        biasDetection,
        overallScore,
      };
    });
  }

  private assessArgumentStrength(perspective: any): number {
    // Based on clarity, specificity, and actionability
    let strength = 0.7; // Base score

    // Check position length and specificity
    const position = perspective.position || '';
    const words = position.split(' ').length;
    strength += Math.min(words * 0.01, 0.1); // Up to +0.1 for detailed position

    // Check for actionable language
    const actionableTerms = ['recommend', 'should', 'must', 'implement', 'consider', 'evaluate'];
    const hasActionable = actionableTerms.some(term => position.toLowerCase().includes(term));
    if (hasActionable) strength += 0.05;

    // Check key points count and quality
    const keyPoints = perspective.keyPoints || [];
    strength += Math.min(keyPoints.length * 0.02, 0.08); // Up to +0.08

    // Expert role weight
    const roleWeight: Record<string, number> = {
      'Tax Strategist': 0.03,
      'International Tax Expert': 0.04,
      'Audit Specialist': 0.02,
    };
    strength += roleWeight[perspective.expert] || 0.01;

    return Math.min(strength, 0.95);
  }

  private assessLogicalConsistency(perspective: any): number {
    // Check for internal consistency in the perspective
    let consistency = 0.8; // Base score (assume consistent unless proven otherwise)

    const position = (perspective.position || '').toLowerCase();
    const keyPoints = (perspective.keyPoints || []).map((p: string) => p.toLowerCase());

    // Check if key points align with position
    const alignedPoints = keyPoints.filter((point: string) => {
      // Check for thematic consistency
      const positionTerms = position.split(' ').filter((w: string) => w.length > 3);
      return positionTerms.some((term: string) => point.includes(term));
    }).length;

    const alignmentRatio = keyPoints.length > 0 ? alignedPoints / keyPoints.length : 0.5;
    consistency += alignmentRatio * 0.1; // Up to +0.1

    // Check evidence type matches expert role
    const evidenceType = perspective.evidenceType || '';
    if (evidenceType && evidenceType.length > 10) {
      consistency += 0.03;
    }

    return Math.min(consistency, 0.95);
  }

  private assessEvidenceQuality(perspective: any): number {
    // Quality and relevance of supporting evidence
    let quality = 0.7; // Base score

    const evidenceType = perspective.evidenceType || '';
    
    // Higher quality for authoritative evidence types
    const authorityScore: Record<string, number> = {
      'Statutory provisions and case law': 0.15,
      'Treaty provisions and OECD guidelines': 0.12,
      'Internal control frameworks and standards': 0.10,
      'Market data and historical performance': 0.08,
      'Investigative findings and red flag indicators': 0.10,
      'Professional judgment and standards': 0.05,
    };
    quality += authorityScore[evidenceType] || 0.05;

    // Check for specificity in key points (suggests evidence backing)
    const keyPoints = perspective.keyPoints || [];
    const specificPoints = keyPoints.filter((p: string) => 
      p.includes('requirement') || p.includes('regulation') || 
      p.includes('standard') || p.includes('compliance')
    ).length;
    quality += Math.min(specificPoints * 0.03, 0.09); // Up to +0.09

    return Math.min(quality, 0.95);
  }

  private detectBias(perspective: any): number {
    // Detect cognitive biases (lower is better)
    let bias = 0.1; // Base low bias

    const position = (perspective.position || '').toLowerCase();
    
    // Check for absolute language (indicates potential confirmation bias)
    const absoluteTerms = ['always', 'never', 'definitely', 'certainly', 'must'];
    const absoluteCount = absoluteTerms.filter(term => position.includes(term)).length;
    bias += absoluteCount * 0.05; // +0.05 per absolute term

    // Check for hedging language (reduces bias score - shows nuance)
    const hedgingTerms = ['may', 'might', 'could', 'potentially', 'consider'];
    const hedgingCount = hedgingTerms.filter(term => position.includes(term)).length;
    bias -= Math.min(hedgingCount * 0.03, 0.06); // -0.03 per hedge, max -0.06

    // Expert role bias tendency
    const roleBias: Record<string, number> = {
      'Tax Strategist': 0.02, // Slight bias toward aggressive positions
      'Financial Advisor': 0.03, // May favor investment-friendly views
      'Audit Specialist': 0.01, // Generally neutral
      'Forensic Accountant': 0.02, // May over-detect issues
      'International Tax Expert': 0.02,
    };
    bias += roleBias[perspective.expert] || 0.02;

    // Clamp between 0.05 and 0.35
    return Math.max(0.05, Math.min(bias, 0.35));
  }
}

export class ConsensusSynthesizer extends EventEmitter implements AgentDefinition {
  id = 'consensus-synthesizer';
  name = 'Consensus Synthesizer';
  mode = 'roundtable' as const;
  capabilities = ['synthesis', 'consensus-building'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const perspectives = (input.data.perspectives || 
      input.data.previousOutputs?.['perspective-collector']?.data?.perspectives || []) as any[];
    const analysis = (input.data.analysis || 
      input.data.previousOutputs?.['argument-analyzer']?.data?.analysis || []) as any[];
    const query = input.data.query as string;
    
    // Use AI to synthesize consensus
    const systemPrompt = `You are synthesizing consensus from a multi-expert financial discussion.
Analyze the expert perspectives and create a unified recommendation.
Return JSON with: primaryRecommendation (string), keyAgreements (array of strings), 
resolvedDisagreements (array), minorityViews (array), confidenceLevel (0-1), actionItems (array).`;

    const userPrompt = `Query: "${query}"

Expert Perspectives:
${perspectives.map((p: any, i: number) => `${i + 1}. ${p.expert}: ${p.position}
   Key Points: ${(p.keyPoints || []).join(', ')}`).join('\n\n')}

${analysis.length > 0 ? `\nArgument Analysis:\n${analysis.map((a: any) => a.conclusion || '').join('\n')}` : ''}

Synthesize a consensus view with actionable recommendations.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 1500);
      
      let consensus: any;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          consensus = JSON.parse(jsonMatch[0]);
        } else {
          consensus = this.buildFallbackConsensus(perspectives, analysis);
        }
      } catch {
        consensus = this.buildFallbackConsensus(perspectives, analysis);
      }

      return {
        success: true,
        data: { 
          consensus,
          participantSatisfaction: 'High',
          consensusQuality: 'Strong - AI-synthesized from multiple expert views',
          aiGenerated: true,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.92 },
      };
    } catch (error) {
      // Fallback to static synthesis
      const consensus = this.buildFallbackConsensus(perspectives, analysis);

      return {
        success: true,
        data: { 
          consensus,
          participantSatisfaction: 'High',
          consensusQuality: 'Strong - Multiple experts aligned',
          aiGenerated: false,
        },
        metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.9 },
      };
    }
  }

  private buildFallbackConsensus(perspectives: any[], analysis: any[]): any {
    return {
      primaryRecommendation: this.synthesizePrimaryRecommendation(perspectives),
      keyAgreements: this.extractKeyAgreements(perspectives),
      resolvedDisagreements: this.resolveDisagreements(perspectives),
      minorityViews: this.captureMinorityViews(perspectives),
      confidenceLevel: this.calculateOverallConfidence(perspectives, analysis),
      actionItems: this.generateActionItems(perspectives),
    };
  }

  private synthesizePrimaryRecommendation(perspectives: any[]): string {
    // Find highest confidence perspective
    const topPerspective = perspectives.reduce((max, p) => 
      (p.confidence || 0) > (max.confidence || 0) ? p : max
    , perspectives[0]);
    
    // Extract key themes from all perspectives
    const hasComplianceFocus = perspectives.some(p => 
      p.position?.toLowerCase().includes('compliance') || 
      p.expert?.role?.toLowerCase().includes('audit')
    );
    const hasEfficiencyFocus = perspectives.some(p => 
      p.position?.toLowerCase().includes('efficient') || 
      p.position?.toLowerCase().includes('optimize')
    );
    
    // Build recommendation based on themes
    let recommendation = `Based on expert consensus, recommend `;
    
    if (topPerspective.position) {
      // Extract action-oriented phrases from top perspective
      if (topPerspective.position.includes('balanced')) {
        recommendation += 'a balanced approach';
      } else if (topPerspective.position.includes('careful')) {
        recommendation += 'proceeding with careful analysis';
      } else {
        recommendation += 'proceeding with structured implementation';
      }
    } else {
      recommendation += 'proceeding with structured implementation';
    }
    
    if (hasComplianceFocus && hasEfficiencyFocus) {
      recommendation += ' that balances compliance requirements with operational efficiency';
    } else if (hasComplianceFocus) {
      recommendation += ' prioritizing compliance and regulatory requirements';
    } else if (hasEfficiencyFocus) {
      recommendation += ' focusing on operational efficiency and optimization';
    }
    
    return recommendation;
  }

  private extractKeyAgreements(perspectives: any[]): string[] {
    const agreements: string[] = [];
    
    // Analyze key points across all perspectives
    const allKeyPoints = perspectives.flatMap(p => p.keyPoints || []);
    
    // If we have sufficient key points, do deeper analysis
    const hasRichData = allKeyPoints.length >= perspectives.length * 2;
    
    // Find common keywords in key points
    const keywords = ['documentation', 'compliance', 'risk', 'phased', 'implementation', 'regulatory'];
    
    keywords.forEach(keyword => {
      const mentionCount = perspectives.filter(p => 
        p.position?.toLowerCase().includes(keyword) ||
        p.keyPoints?.some((kp: string) => kp.toLowerCase().includes(keyword))
      ).length;
      
      // If majority mention it, it's an agreement
      const threshold = hasRichData ? 0.7 : 0.6; // Lower threshold if less data
      if (mentionCount >= perspectives.length * threshold) {
        if (keyword === 'documentation') {
          agreements.push('All experts agree on need for thorough documentation');
        } else if (keyword === 'compliance' || keyword === 'regulatory') {
          if (!agreements.some(a => a.includes('compliance') || a.includes('regulatory'))) {
            agreements.push('Consensus on importance of regulatory compliance');
          }
        } else if (keyword === 'phased' || keyword === 'implementation') {
          if (!agreements.some(a => a.includes('phased') || a.includes('implementation'))) {
            agreements.push('Agreement on phased implementation approach');
          }
        } else if (keyword === 'risk') {
          agreements.push('Shared view on risk mitigation priorities');
        }
      }
    });
    
    // Ensure at least one agreement
    if (agreements.length === 0 && perspectives.length > 0) {
      agreements.push('All experts agree on the need for careful consideration');
    }
    
    return agreements.slice(0, 4); // Return top 4
  }

  private resolveDisagreements(perspectives: any[]): Array<{ issue: string; resolution: string }> {
    const resolutions: Array<{ issue: string; resolution: string }> = [];
    
    // Analyze confidence variance
    const confidences = perspectives.map(p => p.confidence || 0.8);
    const maxConf = Math.max(...confidences);
    const minConf = Math.min(...confidences);
    
    if (maxConf - minConf > 0.15) {
      resolutions.push({
        issue: `Confidence gap between experts (${(minConf * 100).toFixed(0)}% to ${(maxConf * 100).toFixed(0)}%)`,
        resolution: 'Weight recommendations by expert confidence and domain relevance',
      });
    }
    
    // Check for timeline-related disagreements
    const timelineMentions = perspectives.filter(p => 
      p.position?.toLowerCase().includes('timeline') ||
      p.position?.toLowerCase().includes('duration') ||
      p.position?.toLowerCase().includes('month')
    );
    
    if (timelineMentions.length > 1 && timelineMentions.length < perspectives.length) {
      resolutions.push({
        issue: 'Timeline disagreement across experts',
        resolution: 'Adopt phased approach with review checkpoints at each milestone',
      });
    }
    
    // Check for approach disagreements
    const approachVariance = perspectives.some(p => 
      p.position?.toLowerCase().includes('conservative')
    ) && perspectives.some(p => 
      p.position?.toLowerCase().includes('aggressive') ||
      p.position?.toLowerCase().includes('bold')
    );
    
    if (approachVariance) {
      resolutions.push({
        issue: 'Conservative vs aggressive approach debate',
        resolution: 'Adopt hybrid approach balancing both perspectives with risk mitigation',
      });
    }
    
    return resolutions;
  }

  private captureMinorityViews(perspectives: any[]): string[] {
    const minorityViews: string[] = [];
    
    if (perspectives.length === 0) return minorityViews;
    
    // Find perspectives with notably lower confidence
    const avgConfidence = perspectives.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / perspectives.length;
    const lowConfidencePerspectives = perspectives.filter(p => 
      (p.confidence || 0.8) < avgConfidence - 0.1
    );
    
    lowConfidencePerspectives.forEach(p => {
      if (p.expert?.role && p.position) {
        const viewSnippet = p.position.substring(0, 60);
        minorityViews.push(`${p.expert.role} suggested: "${viewSnippet}..." (noted for consideration)`);
      }
    });
    
    // Find unique perspectives (mentioned by only one expert)
    const allKeywords = ['aggressive', 'alternative', 'innovative', 'unconventional', 'cautious'];
    
    allKeywords.forEach(keyword => {
      const mentions = perspectives.filter(p => 
        p.position?.toLowerCase().includes(keyword)
      );
      
      if (mentions.length === 1) {
        const expert = mentions[0].expert?.role || 'One expert';
        minorityViews.push(`${expert} proposed ${keyword} approach (noted but not adopted in primary recommendation)`);
      }
    });
    
    // Limit to most relevant minority views
    return minorityViews.slice(0, 3);
  }

  private calculateOverallConfidence(perspectives: any[], analysis: any[]): number {
    const perspectiveConfidence = perspectives.length > 0 
      ? perspectives.reduce((sum, p) => sum + (p.confidence || 0.8), 0) / perspectives.length 
      : 0.75;
    const analysisQuality = analysis.length > 0 
      ? analysis.reduce((sum, a) => sum + (a.overallScore || 0.8), 0) / analysis.length 
      : 0.75;
    return (perspectiveConfidence + analysisQuality) / 2;
  }

  private generateActionItems(perspectives: any[]): Array<{ action: string; owner: string; deadline: string }> {
    const actionItems: Array<{ action: string; owner: string; deadline: string }> = [];
    
    // Generate actions based on expert roles and their recommendations
    perspectives.forEach((p, index) => {
      const role = p.expert?.role || `Expert ${index + 1}`;
      
      // Map role to appropriate action
      if (role.includes('Tax')) {
        actionItems.push({ 
          action: 'Prepare detailed tax implementation plan', 
          owner: role, 
          deadline: '2 weeks' 
        });
      } else if (role.includes('Audit')) {
        actionItems.push({ 
          action: 'Conduct comprehensive risk assessment', 
          owner: role, 
          deadline: '1 week' 
        });
      } else if (role.includes('Financial')) {
        actionItems.push({ 
          action: 'Develop financial projections and analysis', 
          owner: role, 
          deadline: '1 week' 
        });
      } else if (role.includes('Forensic')) {
        actionItems.push({ 
          action: 'Review compliance and documentation', 
          owner: role, 
          deadline: '5 days' 
        });
      } else if (role.includes('International')) {
        actionItems.push({ 
          action: 'Review international regulatory requirements', 
          owner: role, 
          deadline: '3 days' 
        });
      }
    });
    
    // Add general coordination action
    if (actionItems.length > 0) {
      actionItems.push({
        action: 'Coordinate expert recommendations and prepare summary report',
        owner: 'Discussion Moderator',
        deadline: '3 days'
      });
    }
    
    return actionItems.slice(0, 5); // Limit to 5 most important
  }
}

export class RecommendationFinalizer extends EventEmitter implements AgentDefinition {
  id = 'recommendation-finalizer';
  name = 'Recommendation Finalizer';
  mode = 'roundtable' as const;
  capabilities = ['finalization', 'documentation', 'executive-summary'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    // ConsensusSynthesizer returns { consensus: {...}, participantSatisfaction, ... }
    // We need to extract the nested consensus object
    const consensusOutput = input.data.previousOutputs?.['consensus-synthesizer']?.data || {};
    const consensus = (input.data.consensus || consensusOutput.consensus || consensusOutput) as any;
    const query = (input.data.originalQuery || input.data.query) as string;
    const experts = (input.data.experts || 
      input.data.previousOutputs?.['expert-assembler']?.data?.experts || []) as any[];
    
    // Use AI to generate executive summary and recommendations
    const systemPrompt = `You are finalizing a professional expert roundtable report.
Create an executive summary and actionable recommendations based on the consensus reached.
Return JSON with: executiveSummary (2-3 paragraphs), detailedRecommendations (array of {priority, recommendation, rationale}), implementationRoadmap (array of {phase, duration, milestones}), riskConsiderations (array of {risk, severity, mitigation}).`;

    const userPrompt = `Original Query: "${query}"

Consensus Reached:
- Primary Recommendation: ${consensus.primaryRecommendation || 'Not specified'}
- Key Agreements: ${(consensus.keyAgreements || []).join('; ')}
- Confidence Level: ${consensus.confidenceLevel || 0.8}
- Action Items: ${(consensus.actionItems || []).map((a: any) => a.action || a).join('; ')}
- Minority Views: ${(consensus.minorityViews || []).join('; ') || 'None'}

Participating Experts: ${experts.map((e: any) => e.role).join(', ')}

Generate a professional final report.`;

    try {
      const aiResponse = await getAIResponse(systemPrompt, userPrompt, 2000);
      
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const finalReport = {
            title: 'Roundtable Discussion - Expert Consensus Report',
            date: new Date().toISOString(),
            originalQuestion: query,
            participants: experts.map((e: any) => e.role),
            executiveSummary: parsed.executiveSummary || this.generateExecutiveSummary(consensus),
            detailedRecommendations: parsed.detailedRecommendations || this.formatRecommendations(consensus),
            implementationRoadmap: parsed.implementationRoadmap || this.createRoadmap(consensus.actionItems || []),
            riskConsiderations: parsed.riskConsiderations || this.identifyRisks(consensus),
            nextSteps: consensus.actionItems || [],
            confidenceAssessment: {
              level: (consensus.confidenceLevel || 0.8) > 0.85 ? 'High' : 'Moderate',
              rationale: this.explainConfidence(consensus),
            },
            dissenting: consensus.minorityViews || [],
            approvals: experts.map((e: any) => ({ expert: e.role, status: 'Approved' })),
            aiGenerated: true,
          };

          return {
            success: true,
            data: { 
              finalReport,
              deliverable: 'Comprehensive expert consensus document',
              format: 'Professional report with executive summary',
            },
            metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
          };
        }
      } catch {
        // Fall through to fallback
      }
    } catch {
      // Fall through to fallback
    }
    
    // Fallback to template-based report
    const finalReport = {
      title: 'Roundtable Discussion - Expert Consensus Report',
      date: new Date().toISOString(),
      originalQuestion: query,
      participants: experts.map((e: any) => e.role),
      executiveSummary: this.generateExecutiveSummary(consensus),
      detailedRecommendations: this.formatRecommendations(consensus),
      implementationRoadmap: this.createRoadmap(consensus.actionItems || []),
      riskConsiderations: this.identifyRisks(consensus),
      nextSteps: consensus.actionItems || [],
      confidenceAssessment: {
        level: (consensus.confidenceLevel || 0.8) > 0.85 ? 'High' : 'Moderate',
        rationale: this.explainConfidence(consensus),
      },
      dissenting: consensus.minorityViews || [],
      approvals: experts.map((e: any) => ({ expert: e.role, status: 'Approved' })),
      aiGenerated: false,
    };

    return {
      success: true,
      data: { 
        finalReport,
        deliverable: 'Comprehensive expert consensus document',
        format: 'Professional report with executive summary',
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: 0.95 },
    };
  }

  private generateExecutiveSummary(consensus: any): string {
    return `Following collaborative discussion among ${consensus.keyAgreements?.length || 4} experts, ` +
           `we have reached ${consensus.confidenceLevel > 0.85 ? 'strong' : 'moderate'} consensus on the recommended approach. ` +
           `Key recommendation: ${consensus.primaryRecommendation}. ` +
           `Implementation timeline: 4-6 months with phased rollout.`;
  }

  private formatRecommendations(consensus: any): Array<{ priority: number; recommendation: string; rationale: string }> {
    return [
      {
        priority: 1,
        recommendation: consensus.primaryRecommendation,
        rationale: 'Supported by all experts with high confidence',
      },
      {
        priority: 2,
        recommendation: 'Implement comprehensive documentation procedures',
        rationale: 'Critical for compliance and audit trail',
      },
      {
        priority: 3,
        recommendation: 'Establish regular review checkpoints',
        rationale: 'Enables course correction and risk management',
      },
    ];
  }

  private createRoadmap(actionItems: any[]): Array<{ phase: string; duration: string; milestones: string[] }> {
    const roadmap: Array<{ phase: string; duration: string; milestones: string[] }> = [];
    
    // Phase 1: Planning - group all 'prepare', 'develop', 'review' actions
    const planningActions = actionItems.filter(item => 
      item.action?.toLowerCase().includes('prepare') ||
      item.action?.toLowerCase().includes('develop') ||
      item.action?.toLowerCase().includes('review') ||
      item.action?.toLowerCase().includes('plan')
    );
    
    if (planningActions.length > 0) {
      roadmap.push({
        phase: 'Planning & Assessment',
        duration: '4 weeks',
        milestones: planningActions.slice(0, 3).map(a => a.action || 'Complete assessment'),
      });
    }
    
    // Phase 2: Implementation - remaining actions
    const implementationActions = actionItems.filter(item => 
      !planningActions.includes(item) &&
      (item.action?.toLowerCase().includes('implement') ||
       item.action?.toLowerCase().includes('execute') ||
       item.action?.toLowerCase().includes('conduct'))
    );
    
    if (implementationActions.length > 0 || actionItems.length > planningActions.length) {
      roadmap.push({
        phase: 'Implementation',
        duration: '12 weeks',
        milestones: [
          'Phase 1 rollout',
          ...implementationActions.slice(0, 2).map(a => a.action || 'Execute phase milestone'),
          'Complete implementation'
        ].slice(0, 3),
      });
    }
    
    // Phase 3: Review & Optimization - always included
    roadmap.push({
      phase: 'Review & Optimization',
      duration: '4 weeks',
      milestones: [
        'Performance evaluation',
        'Process refinement',
        'Final documentation and sign-off'
      ],
    });
    
    return roadmap;
  }

  private identifyRisks(consensus: any): Array<{ risk: string; severity: string; mitigation: string }> {
    const risks: Array<{ risk: string; severity: string; mitigation: string }> = [];
    
    // Analyze consensus quality to determine risk level
    const hasDisagreements = consensus.disagreements && consensus.disagreements.length > 0;
    const hasMinorityViews = consensus.minorityViews && consensus.minorityViews.length > 0;
    const lowConfidence = consensus.overallConfidence < 0.75;
    
    // Risk based on disagreements
    if (hasDisagreements) {
      risks.push({
        risk: 'Expert disagreement on approach may lead to implementation challenges',
        severity: 'Medium',
        mitigation: 'Regular expert checkpoints and adaptive approach with flexibility',
      });
    }
    
    // Risk based on confidence level
    if (lowConfidence) {
      risks.push({
        risk: 'Lower expert confidence indicates potential unforeseen complications',
        severity: 'Medium-High',
        mitigation: 'Enhanced monitoring, conservative assumptions, and contingency planning',
      });
    }
    
    // Standard implementation risks
    risks.push({
      risk: 'Timeline slippage due to dependencies or resource constraints',
      severity: 'Medium',
      mitigation: 'Regular checkpoint reviews, buffer time, and contingency planning',
    });
    
    risks.push({
      risk: 'Regulatory changes during implementation',
      severity: 'Medium',
      mitigation: 'Continuous monitoring of regulatory landscape and adaptive approach',
    });
    
    // Risk based on minority views
    if (hasMinorityViews) {
      risks.push({
        risk: 'Minority expert perspectives may indicate overlooked considerations',
        severity: 'Low-Medium',
        mitigation: 'Document and periodically review minority views for validity',
      });
    }
    
    return risks.slice(0, 4); // Return top 4 risks
  }

  private explainConfidence(consensus: any): string {
    const level = consensus.confidenceLevel || 0.85;
    if (level > 0.9) return 'Very high agreement among all experts with strong supporting evidence';
    if (level > 0.8) return 'Strong agreement with minor variations in implementation approach';
    return 'Moderate agreement with some areas requiring further discussion';
  }
}

// Export all Roundtable agents (6 agents)
export const roundtableAgents: AgentDefinition[] = [
  new ExpertAssembler(),
  new DiscussionModerator(),
  new PerspectiveCollector(),
  new ArgumentAnalyzer(),
  new ConsensusSynthesizer(),
  new RecommendationFinalizer(),
];

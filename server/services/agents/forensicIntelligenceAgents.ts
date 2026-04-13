/**
 * Forensic Intelligence Mode
 * 8 specialized agents for forensic accounting, fraud detection, and investigation
 * WITH AI INTEGRATION - Uses aiProviderRegistry for intelligent analysis
 */

import { EventEmitter } from 'events';
import type { AgentDefinition, AgentInput, AgentOutput } from '@shared/types/agentTypes';
import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';

// Provider to model mapping for forensic intelligence
const PROVIDER_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: 'gpt-4o',
  [AIProviderName.OPENAI]: 'gpt-4o',
  [AIProviderName.CLAUDE]: 'claude-sonnet-4-20250514',
  [AIProviderName.GEMINI]: 'gemini-1.5-pro',
};

/**
 * Helper function to get AI response with fallback
 */
async function getAIResponse(systemPrompt: string, userPrompt: string): Promise<{ content: string; provider: string } | null> {
  const providerOrder: AIProviderName[] = [
    AIProviderName.AZURE_OPENAI,
    AIProviderName.OPENAI,
    AIProviderName.CLAUDE,
    AIProviderName.GEMINI,
  ];

  for (const providerName of providerOrder) {
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;

      const model = PROVIDER_MODELS[providerName];
      if (!model) continue;

      const response = await provider.generateCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      if (response.content) {
        return { content: response.content, provider: providerName };
      }
    } catch (error) {
      console.warn(`[ForensicAgents] Provider ${providerName} failed:`, error);
      continue;
    }
  }

  return null;
}

export class PatternDetector extends EventEmitter implements AgentDefinition {
  id = 'pattern-detector';
  name = 'Pattern Detector';
  mode = 'forensic-intelligence' as const;
  capabilities = ['pattern-recognition', 'data-mining', 'statistical-analysis'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const transactions = input.data.transactions as any[] || [];
    
    // Statistical pattern detection
    const patterns = {
      roundAmounts: transactions.filter(t => t.amount % 1000 === 0).length,
      afterHours: transactions.filter(t => {
        const hour = new Date(t.timestamp).getHours();
        return hour < 6 || hour > 22;
      }).length,
      weekendActivity: transactions.filter(t => {
        const day = new Date(t.timestamp).getDay();
        return day === 0 || day === 6;
      }).length,
      highFrequency: this.detectHighFrequency(transactions),
    };

    const suspicionScore = transactions.length > 0 ? (
      (patterns.roundAmounts / transactions.length) * 20 +
      (patterns.afterHours / transactions.length) * 30 +
      (patterns.weekendActivity / transactions.length) * 25 +
      (patterns.highFrequency ? 25 : 0)
    ) : 0;

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic accounting expert specializing in fraud pattern detection.
Analyze the following transaction patterns and provide:
1. Risk assessment of each pattern type
2. Potential fraud indicators
3. Recommended investigation priorities
4. Similar fraud cases this pattern resembles`,
        `Transaction Pattern Analysis:
- Total transactions: ${transactions.length}
- Round amounts (divisible by 1000): ${patterns.roundAmounts} (${transactions.length > 0 ? (patterns.roundAmounts/transactions.length*100).toFixed(1) : 0}%)
- After-hours activity: ${patterns.afterHours} (${transactions.length > 0 ? (patterns.afterHours/transactions.length*100).toFixed(1) : 0}%)
- Weekend activity: ${patterns.weekendActivity} (${transactions.length > 0 ? (patterns.weekendActivity/transactions.length*100).toFixed(1) : 0}%)
- High frequency detected: ${patterns.highFrequency}
- Initial suspicion score: ${Math.min(100, Math.round(suspicionScore))}

Provide expert forensic analysis of these patterns.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[PatternDetector] AI analysis failed, using statistical analysis only');
    }

    return {
      success: true,
      data: { 
        patterns,
        suspicionScore: Math.min(100, Math.round(suspicionScore)),
        flagged: suspicionScore > 50,
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.92 : 0.85 },
    };
  }

  private detectHighFrequency(transactions: any[]): boolean {
    if (transactions.length < 2) return false;
    
    const times = transactions.map(t => new Date(t.timestamp).getTime()).sort();
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval < 60000; // Less than 1 minute average
  }
}

export class AnomalyIdentifier extends EventEmitter implements AgentDefinition {
  id = 'anomaly-identifier';
  name = 'Anomaly Identifier';
  mode = 'forensic-intelligence' as const;
  capabilities = ['anomaly-detection', 'outlier-analysis', 'statistical-modeling'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const data = input.data.dataset as any[] || [];
    const values = data.map(d => d.value || 0);
    
    // Statistical analysis
    const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const stdDev = values.length > 0 ? Math.sqrt(
      values.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / values.length
    ) : 0;
    
    // Identify outliers (beyond 2 standard deviations)
    const anomalies = stdDev > 0 ? data.filter(d => {
      const zScore = Math.abs((d.value - mean) / stdDev);
      return zScore > 2;
    }).map(d => ({
      id: d.id,
      value: d.value,
      zScore: Math.abs((d.value - mean) / stdDev).toFixed(2),
      deviation: ((d.value - mean) / mean * 100).toFixed(1) + '%',
    })) : [];

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic data scientist specializing in financial anomaly detection.
Analyze the statistical anomalies and provide:
1. Risk classification for each anomaly type
2. Likely causes (fraud vs legitimate)
3. Investigation priorities
4. Related compliance concerns`,
        `Anomaly Analysis Results:
- Dataset size: ${data.length} records
- Mean value: ${mean.toFixed(2)}
- Standard deviation: ${stdDev.toFixed(2)}
- Anomalies detected: ${anomalies.length}
- Anomaly rate: ${data.length > 0 ? (anomalies.length / data.length * 100).toFixed(1) : 0}%

Top anomalies:
${anomalies.slice(0, 5).map(a => `- ID: ${a.id}, Value: ${a.value}, Z-Score: ${a.zScore}, Deviation: ${a.deviation}`).join('\n')}

Provide expert analysis of these anomalies and their forensic significance.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[AnomalyIdentifier] AI analysis failed, using statistical analysis only');
    }

    return {
      success: true,
      data: { 
        anomalies,
        statistics: { mean, stdDev },
        anomalyCount: anomalies.length,
        anomalyRate: data.length > 0 ? (anomalies.length / data.length * 100).toFixed(1) + '%' : '0%',
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.94 : 0.9 },
    };
  }
}

export class TransactionTracer extends EventEmitter implements AgentDefinition {
  id = 'transaction-tracer';
  name = 'Transaction Tracer';
  mode = 'forensic-intelligence' as const;
  capabilities = ['transaction-tracing', 'flow-analysis', 'link-detection'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTxn = input.data.transactionId as string;
    const allTransactions = input.data.transactions as any[] || [];
    
    // Trace transaction flow
    const chain = this.traceChain(startTxn, allTransactions);
    
    const analysis = {
      origin: chain[0],
      hops: chain.length - 1,
      destination: chain[chain.length - 1],
      totalAmount: chain.reduce((sum, t) => sum + (t.amount || 0), 0),
      intermediaries: chain.slice(1, -1).map(t => t.account),
      suspiciousHops: chain.filter(t => t.suspicious).length,
    };

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic investigator specializing in money trail analysis.
Analyze the following transaction chain and provide:
1. Assessment of the transaction flow complexity
2. Indicators of money laundering or fraud
3. Key entities requiring investigation
4. Recommended next steps for forensic examination`,
        `Transaction Chain Analysis:
- Starting transaction: ${startTxn}
- Chain length: ${chain.length} hops
- Total amount moved: ${analysis.totalAmount}
- Suspicious hops identified: ${analysis.suspiciousHops}
- Intermediary accounts: ${analysis.intermediaries.length}
- Complexity assessment: ${chain.length > 5 ? 'High' : chain.length > 3 ? 'Medium' : 'Low'}

Chain details:
${chain.slice(0, 10).map((t, i) => `${i + 1}. ${t.id || 'Unknown'} -> Amount: ${t.amount || 'N/A'}, Account: ${t.account || 'N/A'}`).join('\n')}

Provide expert analysis of this money trail.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[TransactionTracer] AI analysis failed, using algorithmic analysis only');
    }

    return {
      success: true,
      data: { 
        chain,
        analysis,
        complexity: chain.length > 5 ? 'High' : chain.length > 3 ? 'Medium' : 'Low',
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.92 : 0.88 },
    };
  }

  private traceChain(txnId: string, transactions: any[]): any[] {
    const chain: any[] = [];
    let currentId = txnId;
    const maxDepth = 20;
    
    while (currentId && chain.length < maxDepth) {
      const txn = transactions.find(t => t.id === currentId);
      if (!txn) break;
      
      chain.push(txn);
      currentId = txn.nextTransaction;
    }
    
    return chain;
  }
}

export class EntityRelationshipMapper extends EventEmitter implements AgentDefinition {
  id = 'entity-relationship-mapper';
  name = 'Entity Relationship Mapper';
  mode = 'forensic-intelligence' as const;
  capabilities = ['network-analysis', 'entity-mapping', 'relationship-detection'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const entities = input.data.entities as any[] || [];
    const transactions = input.data.transactions as any[] || [];
    
    // Build relationship graph
    const relationships = new Map<string, Set<string>>();
    
    transactions.forEach(t => {
      if (!relationships.has(t.from)) relationships.set(t.from, new Set());
      if (!relationships.has(t.to)) relationships.set(t.to, new Set());
      
      relationships.get(t.from)!.add(t.to);
      relationships.get(t.to)!.add(t.from);
    });
    
    // Identify key nodes (high connectivity)
    const entityCount = entities.length || relationships.size || 1;
    const nodes = Array.from(relationships.entries()).map(([entity, connections]) => ({
      entity,
      connectionCount: connections.size,
      connections: Array.from(connections),
      centrality: (connections.size / entityCount * 100).toFixed(1) + '%',
    })).sort((a, b) => b.connectionCount - a.connectionCount);

    // Identify clusters
    const clusters = this.detectClusters(nodes);
    
    const networkDensity = entityCount > 1 
      ? (transactions.length / (entityCount * (entityCount - 1)) * 100).toFixed(2) + '%'
      : '0%';

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic network analyst specializing in entity relationship mapping.
Analyze the following network and provide:
1. Assessment of network structure and centrality
2. Identification of potential shell companies or intermediaries
3. Risk assessment based on connection patterns
4. Entities requiring priority investigation`,
        `Entity Relationship Network Analysis:
- Total entities: ${entityCount}
- Total transactions: ${transactions.length}
- Network density: ${networkDensity}
- Clusters identified: ${clusters.length}

Key Players (Top 5 by connections):
${nodes.slice(0, 5).map((n, i) => `${i + 1}. ${n.entity} - ${n.connectionCount} connections (${n.centrality} centrality)`).join('\n')}

Cluster Summary:
${clusters.slice(0, 3).map((c, i) => `Cluster ${i + 1}: ${c.size} members`).join('\n')}

Provide expert analysis of this entity network and potential fraud indicators.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[EntityRelationshipMapper] AI analysis failed, using graph analysis only');
    }

    return {
      success: true,
      data: { 
        nodes,
        keyPlayers: nodes.slice(0, 5),
        clusters,
        networkDensity,
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.91 : 0.87 },
    };
  }

  private detectClusters(nodes: any[]): any[] {
    // Simplified clustering: group by connection patterns
    const clusters: any[] = [];
    const processed = new Set<string>();
    
    nodes.forEach(node => {
      if (processed.has(node.entity)) return;
      
      const cluster = [node.entity];
      processed.add(node.entity);
      
      // Add connected entities
      node.connections.forEach((conn: string) => {
        if (!processed.has(conn)) {
          cluster.push(conn);
          processed.add(conn);
        }
      });
      
      if (cluster.length > 1) {
        clusters.push({ id: clusters.length + 1, members: cluster, size: cluster.length });
      }
    });
    
    return clusters.slice(0, 5); // Top 5 clusters
  }
}

export class TimelineConstructor extends EventEmitter implements AgentDefinition {
  id = 'timeline-constructor';
  name = 'Timeline Constructor';
  mode = 'forensic-intelligence' as const;
  capabilities = ['chronology', 'timeline-analysis', 'event-sequencing'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const events = input.data.events as any[] || [];
    
    // Sort chronologically
    const sorted = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const timeline = sorted.map((event, i) => ({
      sequence: i + 1,
      timestamp: event.timestamp,
      event: event.description,
      actor: event.actor,
      significance: event.suspicious ? 'High' : 'Medium',
      timeSincePrevious: i > 0 
        ? this.formatDuration(new Date(event.timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime())
        : 'First event',
    }));

    // Identify critical periods (high activity)
    const criticalPeriods = this.identifyCriticalPeriods(timeline);
    
    const totalDuration = sorted.length > 1 
      ? this.formatDuration(new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime())
      : 'Single event';

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic investigator specializing in timeline reconstruction.
Analyze the following event timeline and provide:
1. Assessment of the chronological sequence
2. Identification of suspicious timing patterns
3. Critical time periods requiring focus
4. Potential gaps or missing events`,
        `Event Timeline Analysis:
- Total events: ${events.length}
- Investigation period: ${totalDuration}
- Critical periods identified: ${criticalPeriods.length}
- High significance events: ${timeline.filter(t => t.significance === 'High').length}

Critical Periods:
${criticalPeriods.map(p => `- ${p.date}: ${p.eventCount} events (${p.deviation} above average)`).join('\n')}

Timeline Summary (first 10 events):
${timeline.slice(0, 10).map(t => `${t.sequence}. [${t.timestamp}] ${t.event} - Actor: ${t.actor}`).join('\n')}

Provide expert forensic analysis of this timeline.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[TimelineConstructor] AI analysis failed, using chronological analysis only');
    }

    return {
      success: true,
      data: { 
        timeline,
        criticalPeriods,
        totalDuration,
        eventCount: events.length,
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.96 : 0.95 },
    };
  }

  private formatDuration(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days} days ${hours} hours`;
    if (hours > 0) return `${hours} hours`;
    return `${Math.floor(ms / (60 * 1000))} minutes`;
  }

  private identifyCriticalPeriods(timeline: any[]): any[] {
    // Group by day and identify high-activity periods
    const byDay = new Map<string, number>();
    
    timeline.forEach(t => {
      const day = new Date(t.timestamp).toISOString().split('T')[0];
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });
    
    const values = Array.from(byDay.values());
    const avgActivity = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    
    return Array.from(byDay.entries())
      .filter(([_, count]) => count > avgActivity * 1.5)
      .map(([date, count]) => ({ date, eventCount: count, deviation: '+' + Math.round((count / avgActivity - 1) * 100) + '%' }))
      .slice(0, 5);
  }
}

export class EvidenceLinker extends EventEmitter implements AgentDefinition {
  id = 'evidence-linker';
  name = 'Evidence Linker';
  mode = 'forensic-intelligence' as const;
  capabilities = ['evidence-correlation', 'link-analysis', 'case-building'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const evidence = input.data.evidence as any[] || [];
    
    // Link evidence by common attributes
    const links = this.findLinks(evidence);
    
    // Build evidence chains
    const chains = this.buildChains(evidence, links);
    
    const linkedEvidenceCount = new Set(links.flatMap(l => [l.source, l.target])).size;
    
    const analysis = {
      totalEvidence: evidence.length,
      linkedEvidence: linkedEvidenceCount,
      linkCount: links.length,
      strongestChain: chains[0],
      corroborationRate: evidence.length > 0 ? (links.length / evidence.length * 100).toFixed(1) + '%' : '0%',
    };

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic evidence analyst specializing in evidence correlation.
Analyze the following evidence links and provide:
1. Assessment of evidence chain strength
2. Gaps in evidence that need to be addressed
3. Corroboration assessment
4. Recommendations for building a stronger case`,
        `Evidence Linkage Analysis:
- Total evidence items: ${evidence.length}
- Linked evidence items: ${linkedEvidenceCount}
- Total links identified: ${links.length}
- Corroboration rate: ${analysis.corroborationRate}

Evidence Chains:
${chains.slice(0, 5).map((c, i) => `Chain ${i + 1}: ${c.evidence?.length || 0} items, Strength: ${(c.strength * 100).toFixed(0)}%`).join('\n')}

Link Types:
${[...new Set(links.map(l => l.linkType))].map(t => `- ${t}: ${links.filter(l => l.linkType === t).length} links`).join('\n')}

Provide expert analysis of this evidence and recommendations for case building.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[EvidenceLinker] AI analysis failed, using link analysis only');
    }

    return {
      success: true,
      data: { 
        links,
        chains: chains.slice(0, 5),
        analysis,
        recommendation: links.length > 3 ? 'Strong case for investigation' : 'Requires additional evidence',
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.92 : 0.88 },
    };
  }

  private findLinks(evidence: any[]): any[] {
    const links: any[] = [];
    
    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const e1 = evidence[i];
        const e2 = evidence[j];
        
        // Check for common entities, dates, or amounts
        if (e1.entity === e2.entity || 
            e1.amount === e2.amount ||
            Math.abs(new Date(e1.date).getTime() - new Date(e2.date).getTime()) < 86400000) {
          links.push({
            source: e1.id,
            target: e2.id,
            linkType: e1.entity === e2.entity ? 'Same Entity' : 'Temporal',
            strength: 0.8,
          });
        }
      }
    }
    
    return links;
  }

  private buildChains(evidence: any[], links: any[]): any[] {
    const chains: any[] = [];
    const processed = new Set<string>();
    
    evidence.forEach(e => {
      if (processed.has(e.id)) return;
      
      const chain = [e.id];
      const relatedLinks = links.filter(l => l.source === e.id || l.target === e.id);
      
      relatedLinks.forEach(link => {
        const nextId = link.source === e.id ? link.target : link.source;
        if (!chain.includes(nextId)) {
          chain.push(nextId);
          processed.add(nextId);
        }
      });
      
      if (chain.length > 1) {
        chains.push({ evidence: chain, strength: chain.length / evidence.length });
      }
    });
    
    return chains.sort((a, b) => b.evidence.length - a.evidence.length);
  }
}

export class SuspicionScorer extends EventEmitter implements AgentDefinition {
  id = 'suspicion-scorer';
  name = 'Suspicion Scorer';
  mode = 'forensic-intelligence' as const;
  capabilities = ['risk-scoring', 'suspicion-assessment', 'red-flag-detection'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const entity = input.data.entity as any || {};
    const findings = input.data.findings as any || {};
    
    // Score based on multiple factors
    const scores = {
      patterns: findings.patterns ? findings.patterns.suspicionScore || 0 : 0,
      anomalies: findings.anomalies ? (parseFloat(findings.anomalies.anomalyRate) || 0) : 0,
      complexity: findings.transactionChain?.complexity === 'High' ? 30 : 
                  findings.transactionChain?.complexity === 'Medium' ? 15 : 0,
      relationships: findings.network ? Math.min(30, (findings.network.keyPlayers?.length || 0) * 6) : 0,
    };
    
    const totalScore = Math.min(100, Object.values(scores).reduce((a, b) => a + b, 0));
    
    const redFlags = [];
    if (scores.patterns > 30) redFlags.push('Suspicious transaction patterns');
    if (scores.anomalies > 20) redFlags.push('High anomaly rate');
    if (scores.complexity > 20) redFlags.push('Complex transaction chains');
    if (scores.relationships > 20) redFlags.push('Extensive network connections');

    // AI-enhanced analysis
    let aiAnalysis: any = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a forensic risk assessment expert specializing in fraud detection.
Analyze the following suspicion scores and provide:
1. Detailed risk assessment
2. Priority investigation areas
3. Potential fraud schemes suggested by the patterns
4. Regulatory reporting recommendations`,
        `Suspicion Score Analysis for: ${entity.name || 'Unknown Entity'}

Component Scores:
- Pattern Score: ${scores.patterns}/100
- Anomaly Score: ${scores.anomalies}/100
- Complexity Score: ${scores.complexity}/100
- Relationship Score: ${scores.relationships}/100

Total Score: ${Math.round(totalScore)}/100
Risk Level: ${totalScore > 70 ? 'HIGH' : totalScore > 40 ? 'MEDIUM' : 'LOW'}

Red Flags Identified:
${redFlags.length > 0 ? redFlags.map(f => `- ${f}`).join('\n') : '- No major red flags detected'}

Provide expert forensic assessment and recommendations.`
      );

      if (aiResponse) {
        aiAnalysis = {
          expertAnalysis: aiResponse.content,
          provider: aiResponse.provider,
        };
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[SuspicionScorer] AI analysis failed, using score-based assessment only');
    }
    
    return {
      success: true,
      data: { 
        entity: entity.name || 'Unknown',
        totalScore: Math.round(totalScore),
        riskLevel: totalScore > 70 ? 'High' : totalScore > 40 ? 'Medium' : 'Low',
        scores,
        redFlags,
        recommendation: totalScore > 70 
          ? 'Immediate investigation recommended'
          : totalScore > 40
          ? 'Enhanced monitoring required'
          : 'Standard monitoring sufficient',
        aiAnalysis,
        aiGenerated,
      },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.90 : 0.85 },
    };
  }
}

export class InvestigationReporter extends EventEmitter implements AgentDefinition {
  id = 'investigation-reporter';
  name = 'Investigation Reporter';
  mode = 'forensic-intelligence' as const;
  capabilities = ['report-generation', 'executive-summary', 'findings-documentation'];
  version = '1.0.0';

  async execute(input: AgentInput): Promise<AgentOutput> {
    const investigation = input.data.investigation as any || {};
    
    // AI-generated professional report
    let aiReport: string | null = null;
    let aiGenerated = false;

    try {
      const aiResponse = await getAIResponse(
        `You are a senior forensic accountant generating a professional investigation report.
Generate a comprehensive forensic investigation report that includes:
1. Executive Summary
2. Scope and Methodology
3. Key Findings with severity ratings
4. Evidence Analysis
5. Risk Assessment
6. Recommendations
7. Conclusion

Format as a professional document suitable for legal and compliance review.`,
        `Forensic Investigation Data:
Subject: ${investigation.subject || 'Investigation Subject'}
Findings Count: ${investigation.findings?.length || 0}
Evidence Items: ${investigation.evidence?.length || 0}
Risk Level: ${investigation.riskAssessment?.riskLevel || 'Under Assessment'}

Key Findings:
${(investigation.findings || []).slice(0, 5).map((f: any, i: number) => `${i + 1}. ${f.title || f.description || 'Finding ' + (i + 1)}`).join('\n')}

Risk Assessment Details:
- Total Score: ${investigation.riskAssessment?.totalScore || 'N/A'}
- Red Flags: ${investigation.riskAssessment?.redFlags?.join(', ') || 'None identified'}

Generate a complete professional forensic investigation report.`
      );

      if (aiResponse) {
        aiReport = aiResponse.content;
        aiGenerated = true;
      }
    } catch (error) {
      console.warn('[InvestigationReporter] AI report generation failed, using template');
    }

    const report = {
      title: 'Forensic Investigation Report',
      date: new Date().toISOString(),
      subject: investigation.subject || 'Investigation Subject',
      executiveSummary: aiGenerated ? 'See AI-generated report below' : this.generateExecutiveSummary(investigation),
      findings: investigation.findings || [],
      evidence: investigation.evidence || [],
      riskAssessment: investigation.riskAssessment || {},
      recommendations: this.generateRecommendations(investigation),
      nextSteps: [
        'Further investigation of identified entities',
        'Enhanced monitoring protocols',
        'Regulatory notification if warranted',
        'Internal control improvements',
      ],
      investigator: 'ICAI CAGPT Forensic Intelligence',
      confidentiality: 'Highly Confidential - Attorney Work Product',
      aiGeneratedReport: aiReport,
      aiGenerated,
    };

    return {
      success: true,
      data: { report },
      metadata: { agentId: this.id, executionTime: Date.now() - input.timestamp, confidence: aiGenerated ? 0.96 : 0.95 },
    };
  }

  private generateExecutiveSummary(investigation: any): string {
    const riskLevel = investigation.riskAssessment?.riskLevel || 'Unknown';
    const findings = investigation.findings?.length || 0;
    
    return `Investigation of ${investigation.subject || 'the subject'} identified ${findings} suspicious findings. ` +
           `Overall risk assessment: ${riskLevel}. ` +
           `${riskLevel === 'High' ? 'Immediate action required.' : 'Continued monitoring recommended.'}`;
  }

  private generateRecommendations(investigation: any): string[] {
    const recommendations = [];
    const riskLevel = investigation.riskAssessment?.riskLevel;
    
    if (riskLevel === 'High') {
      recommendations.push('Suspend related transactions pending review');
      recommendations.push('Notify legal and compliance teams');
      recommendations.push('Consider regulatory reporting obligations');
    } else if (riskLevel === 'Medium') {
      recommendations.push('Implement enhanced monitoring');
      recommendations.push('Request additional documentation');
    }
    
    recommendations.push('Document all findings and actions taken');
    recommendations.push('Review internal controls for gaps');
    
    return recommendations;
  }
}

// Export all Forensic Intelligence agents (8 agents)
export const forensicIntelligenceAgents: AgentDefinition[] = [
  new PatternDetector(),
  new AnomalyIdentifier(),
  new TransactionTracer(),
  new EntityRelationshipMapper(),
  new TimelineConstructor(),
  new EvidenceLinker(),
  new SuspicionScorer(),
  new InvestigationReporter(),
];


export interface ForensicFinding {
  findingType: 'anomaly' | 'fraud_indicator' | 'compliance_issue' | 'missing_data' | 'pattern_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impactedMetrics?: Record<string, any>;
  evidenceDetails?: Record<string, any>;
  remediationJson?: { action: string; priority: string };
}

export interface ForensicContext {
  document: any;
  extractedData: any;
  historicalData?: any[]; // For cross-reference
}

export interface ForensicAgent {
  name: string;
  analyze(context: ForensicContext): Promise<ForensicFinding[]>;
}

import { ForensicAgent, ForensicContext, ForensicFinding } from './types';
import { DeepForensicAgent } from './aiAgent';
import { 
    BenfordLawAgent, 
    RoundNumberAgent, 
    WeekendHolidayAgent, 
    DuplicateTransactionAgent, 
    SequenceAnalysisAgent, 
    ThresholdSplitAgent, 
    DataCompletenessAgent, 
    VendorValidationAgent 
} from './statAgents';

export const forensicAgents: ForensicAgent[] = [
    new BenfordLawAgent(),
    new RoundNumberAgent(),
    new WeekendHolidayAgent(),
    new DuplicateTransactionAgent(),
    new SequenceAnalysisAgent(),
    new ThresholdSplitAgent(),
    new DataCompletenessAgent(),
    new VendorValidationAgent(),
    new DeepForensicAgent()
];

export async function runForensicAgents(context: ForensicContext): Promise<ForensicFinding[]> {
    const allFindings: ForensicFinding[] = [];
    
    // Run agents in parallel
    const promises = forensicAgents.map(async agent => {
        try {
            console.log(`[ForensicAgent] Running ${agent.name}...`);
            const findings = await agent.analyze(context);
            if (findings.length > 0) {
                console.log(`[ForensicAgent] ${agent.name} found ${findings.length} issues.`);
            }
            return findings;
        } catch (error) {
            console.error(`[ForensicAgent] Error in ${agent.name}:`, error);
            return [];
        }
    });

    const results = await Promise.all(promises);
    results.forEach(f => allFindings.push(...f));
    
    return allFindings;
}

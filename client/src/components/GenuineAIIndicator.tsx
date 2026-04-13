import React, { useState, useEffect } from 'react';

interface OrchestrationStep {
  timestamp: number;
  action: 'analyzing' | 'consulting' | 'deciding' | 'executing';
  agent?: string;
  reasoning: string;
  confidence: number;
}

interface Props {
  isProcessing: boolean;
  steps: OrchestrationStep[];
}

export const GenuineAIIndicator: React.FC<Props> = ({ isProcessing, steps }) => {
  const [currentStep, setCurrentStep] = useState<OrchestrationStep | null>(null);

  useEffect(() => {
    if (steps.length > 0) {
      setCurrentStep(steps[steps.length - 1]);
    }
  }, [steps]);

  if (!isProcessing && steps.length === 0) return null;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'analyzing': return '🔍';
      case 'consulting': return '👥';
      case 'deciding': return '🤔';
      case 'executing': return '⚡';
      default: return '🧠';
    }
  };

  return (
    <div className="bg-rai-50 border border-rai-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-rai-500 animate-pulse' : 'bg-green-500'}`} />
        <span className="font-medium text-rai-900">
          {isProcessing ? 'AI Orchestrator Working' : 'Analysis Complete'}
        </span>
      </div>
      
      {currentStep && (
        <div className="text-sm text-rai-700 mb-2">
          <span className="mr-2">{getActionIcon(currentStep.action)}</span>
          {currentStep.reasoning}
          {currentStep.agent && <span className="font-medium"> ({currentStep.agent})</span>}
        </div>
      )}

      {steps.length > 0 && (
        <details className="text-xs text-rai-600">
          <summary className="cursor-pointer hover:text-rai-800">
            View {steps.length} orchestration steps
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2 py-1">
                <span>{getActionIcon(step.action)}</span>
                <div className="flex-1">
                  <div>{step.reasoning}</div>
                  {step.agent && <div className="text-rai-500">Agent: {step.agent}</div>}
                  <div className="text-gray-500">
                    Confidence: {Math.round(step.confidence * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
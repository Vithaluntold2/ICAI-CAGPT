import React, { useState, useEffect } from 'react';
import { Brain, Zap, Users, CheckCircle, Clock } from 'lucide-react';

interface OrchestrationStep {
  id: string;
  phase: 'analyzing' | 'selecting' | 'consulting' | 'validating' | 'synthesizing' | 'complete';
  message: string;
  agentsInvolved?: number;
  timestamp: Date;
  duration?: number;
}

interface AIThinkingIndicatorProps {
  isActive: boolean;
  query?: string;
  onComplete?: () => void;
}

export const AIThinkingIndicator: React.FC<AIThinkingIndicatorProps> = ({
  isActive,
  query,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<OrchestrationStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<OrchestrationStep[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);

  // Simulate orchestration steps (in production, this would come from WebSocket/SSE)
  useEffect(() => {
    if (!isActive) {
      setCurrentStep(null);
      setCompletedSteps([]);
      setTotalAgents(0);
      return;
    }

    const orchestrationSteps: Omit<OrchestrationStep, 'timestamp'>[] = [
      {
        id: '1',
        phase: 'analyzing',
        message: 'Analyzing query complexity and domain requirements...',
        duration: 1500
      },
      {
        id: '2', 
        phase: 'selecting',
        message: 'Identifying relevant experts across 103 specialized agents...',
        agentsInvolved: 12,
        duration: 2000
      },
      {
        id: '3',
        phase: 'consulting',
        message: 'Consulting primary experts and gathering insights...',
        agentsInvolved: 8,
        duration: 3000
      },
      {
        id: '4',
        phase: 'validating',
        message: 'Validating analysis with compliance and quality experts...',
        agentsInvolved: 3,
        duration: 1500
      },
      {
        id: '5',
        phase: 'synthesizing',
        message: 'Synthesizing multi-agent perspectives into comprehensive response...',
        agentsInvolved: 12,
        duration: 2000
      },
      {
        id: '6',
        phase: 'complete',
        message: 'Analysis complete - presenting comprehensive expert consultation',
        agentsInvolved: 12,
        duration: 500
      }
    ];

    let stepIndex = 0;
    let runningTotal = 0;

    const executeStep = () => {
      if (stepIndex >= orchestrationSteps.length) {
        onComplete?.();
        return;
      }

      const step = orchestrationSteps[stepIndex];
      const stepWithTimestamp: OrchestrationStep = {
        ...step,
        timestamp: new Date()
      };

      setCurrentStep(stepWithTimestamp);
      
      if (step.agentsInvolved) {
        runningTotal += step.agentsInvolved;
        setTotalAgents(runningTotal);
      }

      setTimeout(() => {
        setCompletedSteps(prev => [...prev, stepWithTimestamp]);
        setCurrentStep(null);
        stepIndex++;
        executeStep();
      }, step.duration);
    };

    executeStep();
  }, [isActive, onComplete]);

  if (!isActive && completedSteps.length === 0) {
    return null;
  }

  const getPhaseIcon = (phase: OrchestrationStep['phase']) => {
    switch (phase) {
      case 'analyzing': return <Brain className="w-4 h-4" />;
      case 'selecting': return <Users className="w-4 h-4" />;
      case 'consulting': return <Zap className="w-4 h-4" />;
      case 'validating': return <CheckCircle className="w-4 h-4" />;
      case 'synthesizing': return <Brain className="w-4 h-4" />;
      case 'complete': return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getPhaseColor = (phase: OrchestrationStep['phase']) => {
    switch (phase) {
      case 'analyzing': return 'text-rai-600 bg-rai-50';
      case 'selecting': return 'text-primary bg-primary/10';
      case 'consulting': return 'text-orange-600 bg-orange-50';
      case 'validating': return 'text-green-600 bg-green-50';
      case 'synthesizing': return 'text-rai-600 bg-rai-50';
      case 'complete': return 'text-green-600 bg-green-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Brain className={`w-6 h-6 text-rai-600 ${isActive ? 'animate-pulse' : ''}`} />
            {isActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-rai-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isActive ? 'AI Orchestrator Thinking...' : 'AI Analysis Complete'}
            </h3>
            <p className="text-sm text-gray-600">
              {query ? `Analyzing: "${query.substring(0, 60)}..."` : 'Multi-agent consultation in progress'}
            </p>
          </div>
        </div>
        
        {totalAgents > 0 && (
          <div className="text-right">
            <div className="text-lg font-bold text-rai-600">{totalAgents}</div>
            <div className="text-xs text-gray-500">agents consulted</div>
          </div>
        )}
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className={`flex items-center space-x-3 p-3 rounded-lg ${getPhaseColor(currentStep.phase)} mb-3`}>
          <div className="animate-spin">
            {getPhaseIcon(currentStep.phase)}
          </div>
          <div className="flex-1">
            <p className="font-medium">{currentStep.message}</p>
            {currentStep.agentsInvolved && (
              <p className="text-sm opacity-75">
                Consulting {currentStep.agentsInvolved} specialized agents...
              </p>
            )}
          </div>
          <Clock className="w-4 h-4 opacity-50" />
        </div>
      )}

      {/* Completed Steps */}
      {completedSteps.length > 0 && (
        <div className="space-y-2">
          {completedSteps.slice(-3).map((step) => (
            <div key={step.id} className="flex items-center space-x-3 p-2 text-sm">
              <div className={`p-1 rounded ${getPhaseColor(step.phase)}`}>
                {getPhaseIcon(step.phase)}
              </div>
              <div className="flex-1">
                <span className="text-gray-700">{step.message}</span>
                {step.agentsInvolved && (
                  <span className="text-gray-500 ml-2">
                    ({step.agentsInvolved} agents)
                  </span>
                )}
              </div>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          ))}
          
          {completedSteps.length > 3 && (
            <div className="text-center text-sm text-gray-500 py-2">
              ... and {completedSteps.length - 3} more steps completed
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {isActive && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Orchestration Progress</span>
            <span>{Math.round((completedSteps.length / 6) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-rai-600 h-2 rounded-full transition-all duration-500"
              ref={(el) => { if (el) el.style.width = `${Math.round((completedSteps.length / 6) * 100)}%`; }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
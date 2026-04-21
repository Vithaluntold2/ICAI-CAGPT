import { register } from '@antv/x6-react-shape';
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { StepNode } from './nodes/StepNode';
import { DecisionNode } from './nodes/DecisionNode';

let registered = false;

/**
 * Register the 4 workflow shapes with x6. Safe to call repeatedly — guarded
 * so multiple renderer mounts don't double-register the shape ids.
 */
export function registerWorkflowShapes() {
  if (registered) return;
  registered = true;

  register({
    shape: 'wf-start',
    width: 180,
    height: 48,
    component: StartNode,
    effect: ['data'],
  });
  register({
    shape: 'wf-end',
    width: 180,
    height: 48,
    component: EndNode,
    effect: ['data'],
  });
  register({
    shape: 'wf-step',
    width: 220,
    height: 120,
    component: StepNode,
    effect: ['data'],
  });
  register({
    shape: 'wf-decision',
    width: 180,
    height: 180,
    component: DecisionNode,
    effect: ['data'],
  });
}

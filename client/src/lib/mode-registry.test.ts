// client/src/lib/mode-registry.test.ts
import { describe, it, expect } from 'vitest';
import { MODES, getMode, MODE_IDS } from './mode-registry';

describe('mode-registry', () => {
  it('lists 9 modes in canonical order', () => {
    expect(MODE_IDS).toEqual([
      'standard',
      'deep-research',
      'checklist',
      'workflow',
      'audit-plan',
      'calculation',
      'forensic-intelligence',
      'deliverable-composer',
      'roundtable',
    ]);
  });

  it('every mode has label, icon, description, and starters', () => {
    for (const m of MODES) {
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.starters).toHaveLength(3);
    }
  });

  it('getMode returns undefined for unknown id', () => {
    expect(getMode('nonsense')).toBeUndefined();
  });

  it('getMode returns the matching entry', () => {
    expect(getMode('workflow')?.label).toBe('Workflow');
  });
});

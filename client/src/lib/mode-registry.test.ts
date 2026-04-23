// client/src/lib/mode-registry.test.ts
import { describe, it, expect } from 'vitest';
import { MODES, getMode, MODE_IDS } from './mode-registry';

describe('mode-registry', () => {
  it('lists 11 modes in canonical order', () => {
    expect(MODE_IDS).toEqual([
      'standard',
      'deep-research',
      'checklist',
      'workflow',
      'audit-plan',
      'calculation',
      'scenario-simulator',
      'forensic-intelligence',
      'deliverable-composer',
      'roundtable',
      'spreadsheet',
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

  it('spreadsheet mode is registered with auditable-workbook description', () => {
    const m = getMode('spreadsheet');
    expect(m).toBeDefined();
    expect(m!.label).toBe('Spreadsheet');
    expect(m!.description.toLowerCase()).toContain('workbook');
  });
});

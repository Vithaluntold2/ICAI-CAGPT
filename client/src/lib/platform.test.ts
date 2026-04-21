import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('platform', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = navigator.platform;
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    vi.resetModules();
  });

  it('renders mac glyphs on MacIntel', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    const { isMac, MOD, SHIFT, RETURN, OPTION } = await import('./platform');
    expect(isMac).toBe(true);
    expect(MOD).toBe('⌘');
    expect(SHIFT).toBe('⇧');
    expect(RETURN).toBe('↵');
    expect(OPTION).toBe('⌥');
  });

  it('renders windows glyphs on Win32', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    const { isMac, MOD, SHIFT, RETURN, OPTION } = await import('./platform');
    expect(isMac).toBe(false);
    expect(MOD).toBe('Ctrl');
    expect(SHIFT).toBe('Shift');
    expect(RETURN).toBe('Enter');
    expect(OPTION).toBe('Alt');
  });

  it('treats iPad/iPhone as mac', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'iPad', configurable: true });
    const { isMac } = await import('./platform');
    expect(isMac).toBe(true);
  });
});

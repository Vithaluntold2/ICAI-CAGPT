import { describe, it, expect } from 'vitest';
import { quoteCostTool } from './quoteCost.tool';

describe('quote_cost tool', () => {
  const ctx = { conversationId: 'c1', userId: 'u1' };

  it('returns integer USD cents with breakdown and note', async () => {
    const out = await quoteCostTool.handler(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_tokens: 1_000_000,
        expected_output_tokens: 500_000,
      },
      ctx,
    );
    // 15¢/M input × 1M + 60¢/M output × 0.5M = 15 + 30 = 45¢
    expect(out.usd_cents).toBe(45);
    expect(out.breakdown.input_cents).toBe(15);
    expect(out.breakdown.output_cents).toBe(30);
    expect(out.breakdown.round_trips).toBe(1);
    expect(out.breakdown.price_basis).toContain('gpt-4o-mini');
  });

  it('multiplies by round_trips', async () => {
    const out = await quoteCostTool.handler(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_tokens: 1_000_000,
        expected_output_tokens: 500_000,
        round_trips: 3,
      },
      ctx,
    );
    // 45¢ × 3 = 135¢
    expect(out.usd_cents).toBe(135);
    expect(out.breakdown.round_trips).toBe(3);
  });

  it('falls back to conservative pricing for unknown provider/model', async () => {
    const out = await quoteCostTool.handler(
      {
        provider: 'openai',
        model: 'nonexistent-xyz',
        prompt_tokens: 1_000_000,
        expected_output_tokens: 1_000_000,
      },
      ctx,
    );
    // Fallback: 500¢/M input + 1500¢/M output = 500 + 1500 = 2000¢
    expect(out.usd_cents).toBe(2000);
    expect(out.breakdown.price_basis).toBe('fallback-conservative');
  });

  it('clamps round_trips to minimum 1', async () => {
    const out = await quoteCostTool.handler(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_tokens: 0,
        expected_output_tokens: 0,
        round_trips: 0,
      },
      ctx,
    );
    expect(out.breakdown.round_trips).toBe(1);
  });
});

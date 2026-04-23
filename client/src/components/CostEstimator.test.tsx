// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { CostEstimator } from './CostEstimator';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        // Mirror the production default so the component's queryKeys
        // (['api/cost', id] / ['api/cost', id, 'telemetry']) resolve
        // to the right URL without every test re-declaring queryFn.
        queryFn: async ({ queryKey }) => {
          const res = await fetch(queryKey.join('/'));
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        },
      },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const summaryPayload = {
  conversationId: 'conv-1',
  budget: {
    budgetUsdCents: 1000,
    spentUsdCents: 250,
    reservedUsdCents: 50,
    enforce: true,
    displayCurrency: 'INR',
  },
  aggregate: {
    totalCostCents: 250,
    totalCalls: 4,
    totalPromptTokens: 1200,
    totalCompletionTokens: 300,
  },
};

const telemetryPayload = {
  conversationId: 'conv-1',
  rows: [
    {
      id: 'r1',
      toolName: 'runSolver',
      agentId: 'npv-calculator',
      outcome: 'ok' as const,
      durationMs: 120,
      promptTokens: 0,
      completionTokens: 0,
      costUsdCents: 5,
      roundTrips: 1,
      meta: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: 'r2',
      toolName: 'buildSpreadsheet',
      agentId: null,
      outcome: 'error' as const,
      durationMs: 95,
      promptTokens: 0,
      completionTokens: 0,
      costUsdCents: 0,
      roundTrips: 1,
      meta: {},
      createdAt: new Date().toISOString(),
    },
  ],
  byTool: [
    { toolName: 'runSolver', calls: 3, costCents: 15, avgDurationMs: 110 },
    { toolName: 'buildSpreadsheet', calls: 1, costCents: 0, avgDurationMs: 95 },
  ],
};

describe('CostEstimator', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/telemetry')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => telemetryPayload,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => summaryPayload,
      });
    }) as any;
  });

  it('renders nothing when no conversationId is provided', () => {
    const { container } = wrap(<CostEstimator conversationId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders spent amount converted to the display currency', async () => {
    wrap(<CostEstimator conversationId="conv-1" refetchIntervalMs={0} />);
    // 250 cents = $2.50 → INR @ 83 ≈ ₹207.50
    await waitFor(() => {
      const spent = screen.getByTestId('cost-estimator-spent');
      expect(spent.textContent).toMatch(/₹\s?207/);
    });
  });

  it('renders enforced badge when budget enforcement is on', async () => {
    wrap(<CostEstimator conversationId="conv-1" refetchIntervalMs={0} />);
    await waitFor(() => {
      expect(screen.getByText(/enforced/i)).toBeInTheDocument();
    });
  });

  it('shows per-tool breakdown and recent-call rows', async () => {
    wrap(<CostEstimator conversationId="conv-1" refetchIntervalMs={0} />);
    await waitFor(() => {
      expect(screen.getByTestId('cost-estimator-tool-runSolver')).toBeInTheDocument();
      expect(screen.getByTestId('cost-estimator-row-r1')).toBeInTheDocument();
      expect(screen.getByTestId('cost-estimator-row-r2')).toBeInTheDocument();
    });
  });
});

/**
 * Cost estimator panel for Spreadsheet Mode and other paid-path flows.
 *
 * Plan §7 Step 8. Shows:
 *   - Budget / spent / reserved (USD cents, converted for display)
 *   - Per-tool call breakdown (calls, cost, avg duration)
 *   - Last 10 tool invocations (tool + outcome + duration + cost)
 *
 * Data source: GET /api/cost/:conversationId and
 * /api/cost/:conversationId/telemetry. Both read-only; writes happen
 * server-side via telemetry.recordToolCall.
 *
 * This component is intentionally compact so it can sit in a sidebar
 * or as a popover. It hides itself when there's no conversationId
 * (e.g. first load before the first message is sent).
 */

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Wallet, Activity, Timer, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BudgetSummary {
  conversationId: string;
  budget: {
    budgetUsdCents: number;
    spentUsdCents: number;
    reservedUsdCents: number;
    enforce: boolean;
    displayCurrency: string;
  };
  aggregate: {
    totalCostCents: number;
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
}

interface TelemetryPayload {
  conversationId: string;
  rows: Array<{
    id: string;
    toolName: string;
    agentId: string | null;
    outcome: 'ok' | 'error' | 'refused' | 'short_circuit';
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    costUsdCents: number;
    roundTrips: number;
    meta: Record<string, unknown>;
    createdAt: string;
  }>;
  byTool: Array<{
    toolName: string;
    calls: number;
    costCents: number;
    avgDurationMs: number;
  }>;
}

/**
 * Static approximation of per-USD exchange rates. Kept client-side
 * because storage is always USD cents — this is cosmetic. Backend
 * pricing logic never sees these numbers.
 */
const RATE_PER_USD: Record<string, number> = {
  USD: 1,
  INR: 83,
  EUR: 0.92,
  GBP: 0.78,
  AED: 3.67,
};

const SYMBOL: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
};

function formatCurrency(cents: number, currency: string): string {
  const usd = cents / 100;
  const rate = RATE_PER_USD[currency] ?? 1;
  const value = usd * rate;
  const symbol = SYMBOL[currency] ?? '$';
  if (value === 0) return `${symbol}0`;
  if (value < 0.01) return `${symbol}<0.01`;
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'ok':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'refused':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    case 'short_circuit':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export interface CostEstimatorProps {
  conversationId: string | null | undefined;
  /** Poll interval in ms. Defaults to 8s for live updates during a
   *  running Spreadsheet Mode session. Set to 0 to disable polling. */
  refetchIntervalMs?: number;
  className?: string;
}

export function CostEstimator({
  conversationId,
  refetchIntervalMs = 8000,
  className,
}: CostEstimatorProps) {
  const enabled = Boolean(conversationId);

  const summaryQuery = useQuery<BudgetSummary>({
    queryKey: ['api/cost', conversationId ?? ''],
    enabled,
    refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
    staleTime: refetchIntervalMs > 0 ? refetchIntervalMs / 2 : Infinity,
  });

  const telemetryQuery = useQuery<TelemetryPayload>({
    queryKey: ['api/cost', conversationId ?? '', 'telemetry'],
    enabled,
    refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
    staleTime: refetchIntervalMs > 0 ? refetchIntervalMs / 2 : Infinity,
  });

  if (!enabled) {
    return null;
  }

  const currency = summaryQuery.data?.budget.displayCurrency ?? 'INR';
  const spent = summaryQuery.data?.budget.spentUsdCents ?? summaryQuery.data?.aggregate.totalCostCents ?? 0;
  const reserved = summaryQuery.data?.budget.reservedUsdCents ?? 0;
  const budget = summaryQuery.data?.budget.budgetUsdCents ?? 0;
  const enforce = summaryQuery.data?.budget.enforce ?? false;

  const percentUsed = budget > 0 ? Math.min(100, Math.round(((spent + reserved) / budget) * 100)) : 0;
  const overBudget = enforce && budget > 0 && spent + reserved >= budget;

  return (
    <Card className={className} data-testid="cost-estimator">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4" />
          Conversation cost
          {enforce && (
            <Badge variant="outline" className="ml-auto text-[10px] uppercase">
              Enforced
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {summaryQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : summaryQuery.isError ? (
          <div className="flex items-center gap-2 text-destructive" data-testid="cost-estimator-error">
            <AlertCircle className="h-4 w-4" />
            Unable to load cost summary.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-semibold" data-testid="cost-estimator-spent">
                {formatCurrency(spent, currency)}
              </span>
            </div>
            {reserved > 0 && (
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Reserved (in flight)</span>
                <span>{formatCurrency(reserved, currency)}</span>
              </div>
            )}
            {budget > 0 && (
              <>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Budget</span>
                  <span>{formatCurrency(budget, currency)}</span>
                </div>
                <Progress value={percentUsed} className={overBudget ? 'bg-destructive/20' : undefined} />
                {overBudget && (
                  <p className="text-xs text-destructive">
                    Budget exhausted. Paid operations are blocked until the envelope is increased.
                  </p>
                )}
              </>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
              <div className="flex flex-col items-start rounded-md border bg-muted/30 p-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="h-3 w-3" /> Calls
                </span>
                <span className="font-semibold" data-testid="cost-estimator-total-calls">
                  {summaryQuery.data?.aggregate.totalCalls ?? 0}
                </span>
              </div>
              <div className="flex flex-col items-start rounded-md border bg-muted/30 p-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Coins className="h-3 w-3" /> Tokens
                </span>
                <span className="font-semibold">
                  {(
                    (summaryQuery.data?.aggregate.totalPromptTokens ?? 0) +
                    (summaryQuery.data?.aggregate.totalCompletionTokens ?? 0)
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-start rounded-md border bg-muted/30 p-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-3 w-3" /> Avg ms
                </span>
                <span className="font-semibold">
                  {(() => {
                    const rows = telemetryQuery.data?.rows ?? [];
                    if (rows.length === 0) return '0';
                    const avg = rows.reduce((s, r) => s + r.durationMs, 0) / rows.length;
                    return Math.round(avg).toLocaleString();
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}

        {telemetryQuery.data && telemetryQuery.data.byTool.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">By tool</p>
            <ul className="space-y-1 text-xs">
              {telemetryQuery.data.byTool
                .slice()
                .sort((a, b) => b.costCents - a.costCents)
                .map((t) => (
                  <li
                    key={t.toolName}
                    className="flex items-baseline justify-between"
                    data-testid={`cost-estimator-tool-${t.toolName}`}
                  >
                    <span className="truncate">{t.toolName}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span>{t.calls}×</span>
                      <span>{Math.round(t.avgDurationMs)}ms</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(t.costCents, currency)}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {telemetryQuery.data && telemetryQuery.data.rows.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent calls</p>
            <ul className="space-y-1 text-xs">
              {telemetryQuery.data.rows.slice(0, 10).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2"
                  data-testid={`cost-estimator-row-${r.id}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Badge className={`text-[10px] ${outcomeColor(r.outcome)}`} variant="secondary">
                      {r.outcome}
                    </Badge>
                    <span className="truncate">{r.toolName}</span>
                    {r.agentId && (
                      <span className="truncate text-muted-foreground">({r.agentId})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span>{r.durationMs}ms</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(r.costUsdCents, currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CostEstimator;

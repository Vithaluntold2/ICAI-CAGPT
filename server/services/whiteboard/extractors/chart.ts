export interface ExtractedChart {
  payload: any;
  rawMatch: string;
  title: string;
  summary: string;
}

/**
 * Matches chart specs emitted by the AI in one of three forms:
 *
 *   ```chart
 *   { "type": "bar", ... }
 *   ```
 *
 *   ```json
 *   { "type": "bar", ... }
 *   ```
 *
 *   {bare JSON object starting with "type"}
 *
 * The third form is a safety net — earlier responses emitted chart JSON as
 * a pretty-printed paragraph with no fence, which leaked into chat as prose.
 * We only strip bare JSON when the first non-whitespace key is `type` and
 * the value is a known chart kind, to avoid false-positive matches on
 * arbitrary JSON-looking text.
 */
const CHART_FENCE_RE = /```(?:chart|json)\s*\n([\s\S]*?)\n```/g;
const BARE_CHART_RE = /(\{\s*"type"\s*:\s*"(?:bar|line|pie|area|combo|waterfall|gauge|table|kpi-card|scatter|radar)"[\s\S]*?\n\})/g;

const CHART_TYPES = new Set([
  "bar", "line", "pie", "area", "combo", "waterfall", "gauge", "table", "kpi-card", "scatter", "radar",
]);

function isChartPayload(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  return typeof obj.type === "string" && CHART_TYPES.has(obj.type);
}

/**
 * Normalise the compact chart shape the AI commonly emits
 *   { type, title, xAxis:{categories}, yAxis:{label}, series:[{name, data:[]}] }
 * into the flat row-shape that FinancialBarChart / FinancialLineChart /
 * FinancialAreaChart expect:
 *   { type, title, data:[{category, <seriesName>: n, ...}], config:{ bars|lines|areas, xAxisLabel, yAxisLabel } }
 *
 * Pie and table-style charts have a different native shape and are left
 * alone. Advanced types (combo/waterfall/gauge/kpi-card) likewise pass
 * through — they already emit their own native payload schema.
 */
function normaliseChartPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const type = raw.type;
  if (!['bar', 'line', 'area'].includes(type)) return raw;
  // Already normalised — nothing to do.
  if (Array.isArray(raw.data) && raw.config) return raw;

  const categories: string[] = Array.isArray(raw?.xAxis?.categories) ? raw.xAxis.categories : [];
  const series: Array<{ name?: string; data?: number[] }> = Array.isArray(raw?.series) ? raw.series : [];
  if (categories.length === 0 || series.length === 0) return raw;

  const data = categories.map((cat, i) => {
    const row: Record<string, any> = { category: cat };
    for (const s of series) {
      const key = (s?.name ?? 'value').toString();
      row[key] = s?.data?.[i];
    }
    return row;
  });

  const configKey = type === 'bar' ? 'bars' : type === 'line' ? 'lines' : 'areas';
  const config: Record<string, any> = {
    [configKey]: series.map((s, idx) => ({
      dataKey: (s?.name ?? `series_${idx + 1}`).toString(),
      name: (s?.name ?? `Series ${idx + 1}`).toString(),
    })),
    xAxisLabel: raw?.xAxis?.label,
    yAxisLabel: raw?.yAxis?.label,
  };

  return { type, title: raw.title, data, config };
}

function summarise(p: any): { title: string; summary: string } {
  const title = typeof p?.title === "string" && p.title.trim() ? p.title.trim() : `${(p?.type ?? "Chart").toString()} chart`;
  const hint = (() => {
    if (Array.isArray(p?.series) && p.series.length > 0) return `${p.series.length} series`;
    if (Array.isArray(p?.data)) return `${p.data.length} data points`;
    return p?.type ? `${p.type} chart` : "chart";
  })();
  const summary = hint.length > 100 ? hint.slice(0, 97) + "…" : hint;
  return { title, summary };
}

export function extractCharts(content: string): ExtractedChart[] {
  const results: ExtractedChart[] = [];
  const seen = new Set<string>();

  // Pass 1: explicit fenced blocks
  for (const match of content.matchAll(CHART_FENCE_RE)) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (!isChartPayload(parsed)) continue;
      seen.add(match[0]);
      const payload = normaliseChartPayload(parsed);
      const { title, summary } = summarise(payload);
      results.push({ payload, rawMatch: match[0], title, summary });
    } catch {
      // Ignore unparseable fences — they fall through and render as code.
      continue;
    }
  }

  // Pass 2: bare JSON chart objects outside fences. We intentionally run this
  // AFTER the fence pass so fenced blocks are already consumed from `seen`.
  for (const match of content.matchAll(BARE_CHART_RE)) {
    const raw = match[0].trim();
    // Skip if already captured by a fence (the fence contains this JSON).
    if (Array.from(seen).some(f => f.includes(raw))) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!isChartPayload(parsed)) continue;
      const payload = normaliseChartPayload(parsed);
      const { title, summary } = summarise(payload);
      results.push({ payload, rawMatch: match[0], title, summary });
    } catch {
      continue;
    }
  }

  return results;
}

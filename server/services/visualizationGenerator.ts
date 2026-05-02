/**
 * Visualization Generation Service
 * Analyzes AI responses containing financial data and generates chart configurations
 */

import type { VisualizationData } from '../../shared/types/visualization';

export interface VisualizationContext {
  query: string;
  response: string;
  classification?: any;
}

export class VisualizationGenerator {
  /**
   * Analyze response and generate visualization if financial data is present
   */
  generateVisualization(context: VisualizationContext): VisualizationData | null {
    const { response, query } = context;
    
    // Skip visualization for template/example requests - they're instructional, not data
    if (this.isTemplateOrInstructionalContent(query, response)) {
      console.log('[VisualizationGenerator] Skipping - detected template/instructional content');
      return null;
    }
    
    // Extract tables from markdown
    const tables = this.extractMarkdownTables(response);
    
    if (tables.length === 0) {
      // Try to extract data from narrative text
      const narrativeData = this.extractNarrativeData(response);
      if (narrativeData) {
        return this.createVisualizationFromData(narrativeData, query);
      }
      return null;
    }
    
    // Use the first table with valid numerical data (not formula references)
    const financialTable = tables.find(t => this.hasValidChartData(t));
    if (!financialTable) {
      console.log('[VisualizationGenerator] No valid chart data found in tables');
      return null;
    }
    
    return this.createVisualizationFromTable(financialTable, query);
  }
  
  /**
   * Check if content is a template or instructional example (not real data)
   */
  private isTemplateOrInstructionalContent(query: string, response: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerResponse = response.toLowerCase();
    
    // Template/example indicators in query
    const templateQueryIndicators = [
      'template',
      'example',
      'how to',
      'create a spreadsheet',
      'build a model',
      'excel formula',
      'set up',
      'tutorial',
      'show me how'
    ];
    
    if (templateQueryIndicators.some(ind => lowerQuery.includes(ind))) {
      return true;
    }
    
    // Content contains Excel formulas (instructional)
    const hasFormulaReferences = /=\w+\([^)]*\)|=\w+\d+[-+*/]\w+\d+/i.test(response);
    if (hasFormulaReferences) {
      return true;
    }
    
    // Content is describing how to set up something
    const instructionalPhrases = [
      'step 1:',
      'step 2:',
      'how to create',
      'input the following',
      'enter the formula',
      'sample structure',
      'example layout',
      'cell reference'
    ];
    
    if (instructionalPhrases.some(phrase => lowerResponse.includes(phrase))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if table has valid data for charting (not formula refs or placeholders)
   */
  private hasValidChartData(table: { headers: string[], rows: string[][] }): boolean {
    // Must have at least 2 rows of actual data
    if (table.rows.length < 2) {
      return false;
    }
    
    // Check for formula references (instructional content)
    const hasFormulaRefs = table.rows.some(row =>
      row.some(cell => /^=/.test(cell.trim()))
    );
    if (hasFormulaRefs) {
      return false;
    }
    
    // Check that we have actual numerical data (not just labels)
    let numericCellCount = 0;
    let totalCells = 0;
    
    for (const row of table.rows) {
      for (const cell of row) {
        totalCells++;
        const num = this.parseNumber(cell);
        if (num !== null) {
          numericCellCount++;
        }
      }
    }
    
    // At least 30% of cells should be numeric for a meaningful chart
    const numericRatio = numericCellCount / totalCells;
    if (numericRatio < 0.3) {
      return false;
    }
    
    // Check that numeric values are reasonable (not cell references like "B2")
    const hasReasonableValues = table.rows.some(row =>
      row.some(cell => {
        const num = this.parseNumber(cell);
        // Value should be either 0 or have reasonable magnitude
        return num !== null && (num === 0 || Math.abs(num) >= 1 || Math.abs(num) < 0.001);
      })
    );
    
    return hasReasonableValues;
  }

  /**
   * Extract markdown tables from response
   */
  private extractMarkdownTables(response: string): Array<{ headers: string[], rows: string[][] }> {
    const tables: Array<{ headers: string[], rows: string[][] }> = [];
    const lines = response.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Check if this line is a table header
      if (line.startsWith('|') && line.endsWith('|')) {
        const headers = line
          .split('|')
          .slice(1, -1)
          .map(h => h.trim())
          .filter(h => h.length > 0);
        
        // Check for separator line
        if (i + 1 < lines.length) {
          const separatorLine = lines[i + 1].trim();
          if (separatorLine.match(/^\|[\s\-:|]+\|$/)) {
            // This is a valid table, extract rows
            const rows: string[][] = [];
            i += 2; // Skip header and separator
            
            while (i < lines.length) {
              const rowLine = lines[i].trim();
              if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) {
                break;
              }
              
              const cells = rowLine
                .split('|')
                .slice(1, -1)
                .map(c => c.trim());
              
              if (cells.length === headers.length) {
                rows.push(cells);
              }
              i++;
            }
            
            if (rows.length > 0) {
              tables.push({ headers, rows });
            }
            continue;
          }
        }
      }
      i++;
    }
    
    return tables;
  }

  /**
   * Check if table has numerical data
   */
  private hasNumericalData(table: { headers: string[], rows: string[][] }): boolean {
    return table.rows.some(row =>
      row.some(cell => {
        const cleaned = cell.replace(/[$,\s%]/g, '');
        return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
      })
    );
  }

  /**
   * Parse cell value to number
   */
  private parseNumber(cell: string): number | null {
    if (typeof cell !== 'string') return null;
    let s = cell.trim();
    if (!s) return null;

    // Accounting negatives in parens: "(1,200)" → -1200
    let negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1);
    }

    // Indian/Western grouped numbers → strip separators + currency symbols.
    // We preserve the decimal point and leading minus.
    s = s.replace(/[₹$€£¥,\s]/g, '').replace(/^rs\.?/i, '').replace(/^inr/i, '');

    // Unit suffixes the AI commonly attaches: %, k, m, bn, L (lakh), cr (crore).
    // Normalise to a scalar multiplier then strip the suffix.
    let multiplier = 1;
    const unitMatch = /^(-?\d+(?:\.\d+)?)\s*(%|k|m|bn|b|l|cr)$/i.exec(s);
    if (unitMatch) {
      s = unitMatch[1];
      const unit = unitMatch[2].toLowerCase();
      if (unit === 'k') multiplier = 1_000;
      else if (unit === 'm' || unit === 'b' || unit === 'bn') {
        multiplier = unit === 'm' ? 1_000_000 : 1_000_000_000;
      } else if (unit === 'l') multiplier = 100_000;           // lakh
      else if (unit === 'cr') multiplier = 10_000_000;         // crore
      // `%` keeps multiplier=1 — the bare number is what we want to chart.
    }

    const num = parseFloat(s);
    if (isNaN(num) || !isFinite(num)) return null;
    return (negative ? -num : num) * multiplier;
  }

  /**
   * Create visualization from table data
   */
  private createVisualizationFromTable(
    table: { headers: string[], rows: string[][] },
    query: string
  ): VisualizationData | null {
    const { headers, rows } = table;
    
    if (headers.length < 2 || rows.length === 0) {
      return null;
    }
    
    // Detect chart type based on data structure and query
    const chartType = this.detectChartType(table, query);
    
    // dataKeys must be valid CSS-property suffixes — shadcn's ChartContainer
    // emits `--color-<dataKey>: hsl(...)`, which Recharts then reads via
    // `fill={`var(--color-${dataKey})`}`. Raw markdown headers like
    // "Share (%)" or "Amount (₹)" produce invalid CSS variable names, the
    // var() resolves to nothing, and bars/lines/areas render solid black.
    // We map header → safe key and keep the original string as the legend
    // name. The first column is the category axis ("name").
    const safeKeys = headers.map((h, i) => {
      if (i === 0) return 'name';
      const cleaned = String(h).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return cleaned ? `series_${cleaned}` : `series_${i}`;
    });

    // Convert table to data array
    const data: Array<Record<string, any>> = [];

    for (const row of rows) {
      const dataPoint: Record<string, any> = {};

      for (let i = 0; i < headers.length; i++) {
        const cell = row[i] || '';

        // Try to parse as number
        const num = this.parseNumber(cell);
        dataPoint[safeKeys[i]] = num !== null ? num : cell;
      }

      data.push(dataPoint);
    }

    // Build visualization config (passes both raw headers — for legend names —
    // and the safe keys that match the data row shape).
    const config = this.buildChartConfig(chartType, headers, query, safeKeys);
    const title = this.generateTitle(query, chartType);
    
    // For pie charts, coerce the header-keyed rows into the {name, value}
    // shape that FinancialPieChart expects. Rows coming out of the table
    // parser look like {Category: "Monthly", Percentage: 17.4} — the chart
    // can't compute slice angles from that because it reads `value`, not
    // `Percentage`. Pick the first non-numeric column as the label, the
    // first numeric column as the value, and drop slices that have no
    // usable value (would render as invisible 0-angle slices).
    if (chartType === 'pie') {
      const colors = [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
        'hsl(var(--chart-5))'
      ];

      // Pick label + value columns by scanning headers in order. First
      // header with text values → label column. First header with numeric
      // values → value column. Lookups happen against the sanitised keys in
      // the data rows (CSS-safe), not the raw header strings.
      let labelKey = safeKeys[0];
      let valueKey = safeKeys[1];
      for (const k of safeKeys) {
        if (data.some(r => typeof r[k] === 'number')) {
          valueKey = k;
          break;
        }
      }
      for (const k of safeKeys) {
        if (k !== valueKey && data.some(r => typeof r[k] === 'string' && r[k].length > 0)) {
          labelKey = k;
          break;
        }
      }

      const normalised = data
        .map((row, index) => {
          const rawValue = row[valueKey];
          const value = typeof rawValue === 'number' ? rawValue : this.parseNumber(String(rawValue ?? ''));
          const name = typeof row[labelKey] === 'string' && row[labelKey].length > 0
            ? row[labelKey]
            : `Slice ${index + 1}`;
          return value !== null && value > 0
            ? { name, value, fill: colors[index % colors.length] }
            : null;
        })
        .filter((x): x is { name: string; value: number; fill: string } => x !== null);

      // Bail out with null if nothing usable came through — the caller
      // treats null as "no viable visualization" and falls back to prose.
      if (normalised.length === 0) {
        console.warn('[visualizationGenerator] Pie chart skipped — no slices had usable numeric values');
        return null;
      }

      return {
        type: chartType,
        title,
        data: normalised,
        config
      };
    }
    
    return {
      type: chartType,
      title,
      data,
      config
    };
  }

  /**
   * Detect appropriate chart type based on data and query
   */
  private detectChartType(
    table: { headers: string[], rows: string[][] },
    query: string
  ): 'line' | 'bar' | 'pie' | 'area' {
    const lowerQuery = query.toLowerCase();
    
    // Explicit chart type requests
    if (lowerQuery.includes('line chart') || lowerQuery.includes('trend')) {
      return 'line';
    }
    if (lowerQuery.includes('pie chart') || lowerQuery.includes('distribution')) {
      return 'pie';
    }
    if (lowerQuery.includes('area chart')) {
      return 'area';
    }
    if (lowerQuery.includes('bar chart') || lowerQuery.includes('comparison')) {
      return 'bar';
    }
    
    const { headers, rows } = table;
    
    // Auto-detect based on data structure
    const firstHeader = headers[0].toLowerCase();
    
    // Time-based data → line or area chart
    if (firstHeader.includes('year') || 
        firstHeader.includes('month') || 
        firstHeader.includes('quarter') ||
        firstHeader.includes('date') ||
        firstHeader.includes('period')) {
      return 'line';
    }
    
    // Percentage data → pie chart
    const hasPercentages = rows.some(row =>
      row.some(cell => cell.includes('%'))
    );
    if (hasPercentages && rows.length <= 10) {
      return 'pie';
    }
    
    // Few categories → bar chart
    if (rows.length <= 8) {
      return 'bar';
    }
    
    // Default to line chart
    return 'line';
  }

  /**
   * Build chart configuration
   */
  private buildChartConfig(
    chartType: 'line' | 'bar' | 'pie' | 'area',
    headers: string[],
    query: string,
    safeKeys?: string[],
  ): any {
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))'
    ];

    const config: any = {
      xAxisLabel: headers[0]
    };

    // For pie charts, no need to build series arrays
    if (chartType === 'pie') {
      config.showPercentage = true;
      return config;
    }

    // Build series arrays for line, bar, and area charts. dataKey must match
    // the sanitised key in the data rows (CSS-safe); name keeps the original
    // header text for the legend / tooltip.
    const numericHeaders = headers.slice(1); // Skip first column (category)
    const series = numericHeaders.map((header, index) => ({
      dataKey: safeKeys ? safeKeys[index + 1] : header,
      name: header,
      color: colors[index % colors.length]
    }));
    
    if (chartType === 'line') {
      config.lines = series;
    } else if (chartType === 'bar') {
      config.bars = series;
      config.layout = 'vertical';
    } else if (chartType === 'area') {
      config.areas = series;
    }
    
    return config;
  }

  /**
   * Generate chart title from query
   */
  private generateTitle(query: string, chartType: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Extract title hints from query
    if (lowerQuery.includes('revenue')) {
      return 'Revenue Analysis';
    }
    if (lowerQuery.includes('expense')) {
      return 'Expense Breakdown';
    }
    if (lowerQuery.includes('profit') || lowerQuery.includes('income')) {
      return 'Profit Analysis';
    }
    if (lowerQuery.includes('tax')) {
      return 'Tax Calculation';
    }
    if (lowerQuery.includes('deduction')) {
      return 'Deductions Overview';
    }
    
    // Generic title based on chart type
    const typeMap: Record<string, string> = {
      line: 'Trend Analysis',
      bar: 'Comparison',
      pie: 'Distribution',
      area: 'Cumulative Analysis'
    };
    
    return typeMap[chartType] || 'Financial Data';
  }

  /**
   * Extract numerical data from narrative text
   * (For responses that describe data without tables)
   */
  private extractNarrativeData(response: string): Array<Record<string, any>> | null {
    // Look for bullet point lists with numerical data
    // Exclude numbered list markers (1., 2., 3., etc.) to avoid false positives
    const bulletPattern = /[•\-*]\s*([^:]+):\s*\$?([0-9,]+(?:\.[0-9]+)?)/g;
    const matches = Array.from(response.matchAll(bulletPattern));
    
    if (matches.length < 3) { // Require at least 3 data points for meaningful chart
      return null;
    }
    
    const data: Array<Record<string, any>> = [];
    
    for (const match of matches) {
      const label = match[1].trim();
      const value = parseFloat(match[2].replace(/,/g, ''));
      
      // Skip if this looks like a numbered list item (e.g., "1. Information Request")
      if (/^[0-9]+[\.\)]?\s/.test(label)) {
        continue;
      }
      
      // Skip non-numeric or unreasonably small values
      if (isNaN(value) || value < 10) {
        continue;
      }
      
      data.push({
        name: label,
        value: value
      });
    }
    
    // Additional validation: check if data has meaningful variation
    if (data.length < 3) {
      return null;
    }
    
    // Check if values are just sequential (1, 2, 3, etc.) - likely not real data
    const values = data.map(d => d.value);
    const isSequential = values.every((val, idx) => idx === 0 || val === values[idx - 1] + 1);
    if (isSequential) {
      return null;
    }
    
    // Check for minimum value variation (at least 20% difference between min and max)
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const variation = (maxValue - minValue) / maxValue;
    if (variation < 0.2) {
      return null; // Not enough variation to make visualization meaningful
    }
    
    return data;
  }

  /**
   * Create visualization from extracted narrative data
   */
  private createVisualizationFromData(
    data: Array<Record<string, any>>,
    query: string
  ): VisualizationData | null {
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))'
    ];

    // Narrative-extracted rows may already be in {name, value} shape OR in
    // ad-hoc {label, count} / {category, amount} shape. Normalise to
    // {name, value} and drop entries with no usable value — same rules as
    // the table path above.
    const coloredData = data
      .map((item, index) => {
        const name = typeof item.name === 'string' && item.name.length > 0
          ? item.name
          : typeof item.label === 'string' && item.label.length > 0
          ? item.label
          : typeof item.category === 'string' && item.category.length > 0
          ? item.category
          : `Slice ${index + 1}`;
        const rawValue = item.value ?? item.count ?? item.amount ?? item.percentage;
        const value = typeof rawValue === 'number' ? rawValue : this.parseNumber(String(rawValue ?? ''));
        return value !== null && value > 0
          ? { name, value, fill: colors[index % colors.length] }
          : null;
      })
      .filter((x): x is { name: string; value: number; fill: string } => x !== null);

    if (coloredData.length === 0) {
      console.warn('[visualizationGenerator] Narrative pie skipped — no slices had usable numeric values');
      return null;
    }

    return {
      type: 'pie',
      title: this.generateTitle(query, 'pie'),
      data: coloredData,
      config: {
        showPercentage: true
      }
    };
  }
}

export const visualizationGenerator = new VisualizationGenerator();

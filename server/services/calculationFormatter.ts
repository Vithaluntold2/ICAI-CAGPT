/**
 * Calculation Output Formatter
 * Transforms raw financial calculations into professional, well-structured outputs
 * Provides consistent formatting for all computation types
 */

export interface FormattedCalculationOutput {
  title: string;
  sections: OutputSection[];
  summary: string;
  markdown: string;
}

export interface OutputSection {
  heading: string;
  subsections?: Array<{
    label: string;
    value: string | number;
    description?: string;
  }>;
  table?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
  note?: string;
}

export class CalculationFormatter {
  /**
   * Format any calculation result with professional structure
   */
  formatCalculation(
    calculationType: string,
    calculationData: any,
    query: string
  ): FormattedCalculationOutput {
    switch (calculationType) {
      case 'currentRatio':
      case 'financialRatios':
        return this.formatFinancialRatios(calculationData, query);
      
      case 'taxCalculation':
        return this.formatTaxCalculation(calculationData, query);
      
      case 'npv':
        return this.formatNPVIRR(calculationData, query);
      
      case 'irr':
        return this.formatNPVIRR(calculationData, query);
      
      case 'depreciation':
        return this.formatDepreciation(calculationData, query);
      
      case 'amortization':
        return this.formatAmortization(calculationData, query);
      
      default:
        return this.formatGenericCalculation(calculationType, calculationData, query);
    }
  }

  /**
   * Format financial ratios (Current Ratio, Quick Ratio, etc.) - EXCEL FORMULA FIRST
   */
  private formatFinancialRatios(data: any, _query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];

    // Section 1: Input Data with Cell References
    sections.push({
      heading: '📊 Input Data (Excel Cell References)',
      table: {
        headers: ['Cell', 'Description', 'Value'],
        rows: [
          ['B1', 'Current Assets', this.formatCurrency(data.currentAssets || 0)],
          ['B2', 'Current Liabilities', this.formatCurrency(data.currentLiabilities || 0)],
          ['B3', 'Inventory (for Quick Ratio)', this.formatCurrency(data.inventory || 0)],
          ['B4', 'Total Debt', this.formatCurrency(data.totalDebt || 0)],
          ['B5', 'Total Equity', this.formatCurrency(data.totalEquity || 0)]
        ]
      },
      note: 'Enter these values in Excel cells as shown'
    });

    // Section 2: Excel Formulas
    sections.push({
      heading: '🔢 Excel Formulas for Financial Ratios',
      table: {
        headers: ['Ratio', 'Excel Formula', 'Result Cell', 'Benchmark'],
        rows: [
          ['Current Ratio', '=B1/B2', 'D1', '1.5 - 3.0'],
          ['Quick Ratio', '=(B1-B3)/B2', 'D2', '1.0 - 2.0'],
          ['Debt-to-Equity', '=B4/B5', 'D3', '< 1.5'],
          ['Working Capital', '=B1-B2', 'D4', '> 0']
        ]
      },
      note: 'Copy these formulas into Excel to compute the ratios'
    });

    // Calculate ratios for interpretation
    const currentRatio = data.currentAssets && data.currentLiabilities ? data.currentAssets / data.currentLiabilities : undefined;
    const quickRatio = data.currentAssets && data.currentLiabilities && data.inventory ? 
      (data.currentAssets - data.inventory) / data.currentLiabilities : undefined;
    const debtToEquity = data.totalDebt && data.totalEquity ? data.totalDebt / data.totalEquity : undefined;

    // Section 3: Interpretation Guide with assessments
    const assessments = [
      ['Current Ratio', this.assessRatio(currentRatio, 1.5, 3.0), this.getRatioInterpretation(currentRatio, 1.5, 3.0), '1.5 - 3.0'],
      ['Quick Ratio', this.assessRatio(quickRatio, 1.0, 2.0), this.getRatioInterpretation(quickRatio, 1.0, 2.0), '1.0 - 2.0'],
      ['Debt-to-Equity', this.assessRatio(debtToEquity, 0, 1.5, true), 
        debtToEquity !== undefined ? (debtToEquity > 1.5 ? 'High leverage indicates risk' : 'Conservative financing') : 'Insufficient data', 
        '< 1.5']
    ];

    sections.push({
      heading: '💡 Ratio Interpretation & Assessment',
      table: {
        headers: ['Ratio', 'Status', 'Interpretation', 'Ideal Range'],
        rows: assessments
      },
      note: 'Download Excel file to see computed values and compare against benchmarks'
    });

    // Add detailed interpretation if currentRatio is available
    if (data.currentAssets && data.currentLiabilities) {
      const interpretation = this.getDetailedInterpretation(data);
      sections.push({
        heading: '📋 Detailed Analysis',
        subsections: [
          { label: 'Meaning', value: interpretation.meaning },
          { label: 'Considerations', value: interpretation.considerations },
          { label: 'Recommendations', value: interpretation.recommendations }
        ]
      });
    }

    // Add trend analysis if historical data available
    if (data.historicalData && Array.isArray(data.historicalData) && data.historicalData.length > 0) {
      const trendData = this.buildTrendTable(data.historicalData, 'currentRatio');
      sections.push({
        heading: '📈 Historical Trend Analysis',
        table: {
          headers: ['Period', 'Current Ratio', 'Change', 'Trend'],
          rows: trendData
        },
        note: 'Track ratio changes over time to identify trends'
      });
    }

    const markdown = this.sectionsToMarkdown(sections);
    const summary = this.generateSummary('Financial Ratio Analysis', currentRatio);

    return {
      title: 'Financial Ratio Analysis (Excel Formulas)',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format tax calculation results - EXCEL FORMULA FIRST
   */
  private formatTaxCalculation(data: any, _query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];

    // Input Data with Cell References
    sections.push({
      heading: '📊 Input Data (Excel Cell References)',
      table: {
        headers: ['Cell', 'Description', 'Value'],
        rows: [
          ['B1', 'Gross Revenue', this.formatCurrency(data.revenue || data.taxableIncome || 0)],
          ['B2', 'Total Expenses', this.formatCurrency(data.expenses || 0)],
          ['B3', 'Federal Tax Rate', this.formatPercent(data.breakdown?.federalRate || 0.21)],
          ['B4', 'State Tax Rate', this.formatPercent(data.breakdown?.stateRate || 0)],
          ['B5', 'Local Tax Rate', this.formatPercent(data.breakdown?.localRate || 0)]
        ]
      },
      note: `Jurisdiction: ${data.jurisdiction || 'N/A'}`
    });

    // Excel Formulas
    sections.push({
      heading: '🔢 Excel Formulas for Tax Calculation',
      table: {
        headers: ['Metric', 'Excel Formula', 'Result Cell'],
        rows: [
          ['Taxable Income', '=B1-B2', 'D1'],
          ['Federal Tax', '=D1*B3', 'D2'],
          ['State Tax', '=D1*B4', 'D3'],
          ['Local Tax', '=D1*B5', 'D4'],
          ['Total Tax Liability', '=SUM(D2:D4)', 'D5'],
          ['Effective Tax Rate', '=D5/D1', 'D6'],
          ['Net Income After Tax', '=D1-D5', 'D7']
        ]
      },
      note: 'Copy these formulas into Excel to compute the tax amounts'
    });

    // Tax Rate Reference
    sections.push({
      heading: '📝 Tax Rate Reference',
      table: {
        headers: ['Level', 'Rate', 'Notes'],
        rows: [
          ['Federal (US C-Corp)', '21%', 'Flat rate since TCJA 2017'],
          ['State (varies)', '0% - 12%', 'Depends on state of incorporation'],
          ['Local', '0% - 4%', 'City/county taxes if applicable']
        ]
      }
    });

    // Important Notes
    if (data.notes && data.notes.length > 0) {
      sections.push({
        heading: '📝 Important Notes',
        note: data.notes.map((note: string, i: number) => `${i + 1}. ${note}`).join('\n')
      });
    }

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `Tax liability calculated at ${this.formatPercent(data.effectiveRate)} effective rate`;

    return {
      title: 'Tax Calculation Results',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format NPV calculation - EXCEL FORMULA FIRST (no LLM arithmetic)
   */
  private formatNPVIRR(data: any, _query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];
    const discountRate = data.discountRate || 0.10;
    const cashFlows = data.cashFlows || [];
    const initialInvestment = data.initialInvestment || cashFlows[0] || 0;

    // Section 1: Input Data with Cell References
    sections.push({
      heading: '📊 Input Data (Excel Cell References)',
      table: {
        headers: ['Cell', 'Description', 'Value'],
        rows: [
          ['B1', 'Discount Rate', this.formatPercent(discountRate)],
          ['B2', 'Initial Investment', this.formatCurrency(initialInvestment)],
          ...cashFlows.slice(1).map((cf: number, i: number) => [
            `C${i + 3}`,
            `Year ${i + 1} Cash Flow`,
            this.formatCurrency(cf)
          ])
        ]
      },
      note: 'Enter these values in Excel cells as shown'
    });

    // Section 2: Excel Formulas (NO computed values)
    const lastCashFlowRow = cashFlows.length + 1;
    sections.push({
      heading: '🔢 Excel Formulas',
      table: {
        headers: ['Metric', 'Excel Formula', 'Result Cell'],
        rows: [
          ['NPV', `=NPV(B1,C3:C${lastCashFlowRow})+B2`, 'D1'],
          ['IRR', `=IRR(B2:C${lastCashFlowRow})`, 'D2'],
          ['Payback Period', `=MATCH(TRUE,INDEX(SUBTOTAL(9,OFFSET(B2,0,0,ROW(C3:C${lastCashFlowRow})-ROW(B2)+1,1)),0)>0,0)-1`, 'D3']
        ]
      },
      note: 'Copy these formulas into Excel to compute the results'
    });

    // Section 3: Present Value Breakdown with FORMULAS (not computed values)
    if (cashFlows.length > 1) {
      sections.push({
        heading: '📈 Present Value Formulas (Per Year)',
        table: {
          headers: ['Year', 'Cash Flow Cell', 'Discount Factor Formula', 'Present Value Formula'],
          rows: cashFlows.slice(1).map((_cf: number, i: number) => [
            `Year ${i + 1}`,
            `=C${i + 3}`,
            `=1/(1+$B$1)^${i + 1}`,
            `=C${i + 3}/(1+$B$1)^${i + 1}`
          ])
        },
        note: 'Each PV is calculated by Excel using the formula: PV = CF ÷ (1 + r)^t'
      });
    }

    // Section 4: Interpretation (without computed values)
    sections.push({
      heading: '🎯 Investment Decision Interpretation',
      subsections: [
        {
          label: 'If NPV > 0',
          value: 'ACCEPT',
          description: 'The investment generates value above the required return. Proceed with the investment.'
        },
        {
          label: 'If NPV < 0',
          value: 'REJECT',
          description: 'The investment destroys value relative to the required return. Do not proceed.'
        },
        {
          label: 'If NPV = 0',
          value: 'INDIFFERENT',
          description: 'The investment exactly meets the required return. Consider qualitative factors.'
        }
      ],
      note: `Download the Excel file and check cell D1 for the computed NPV result.`
    });

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `NPV formula: =NPV(${this.formatPercent(discountRate)},cashflows)+initial_investment - Open Excel to see computed result`;

    return {
      title: 'Net Present Value Analysis (Excel Formulas)',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format IRR calculation - EXCEL FORMULA FIRST (no LLM arithmetic)
   */
  private formatIRR(data: any, query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];
    const cashFlows = data.cashFlows || [];
    const requiredReturn = data.requiredReturn || 0.10;

    // Section 1: Input Data with Cell References
    sections.push({
      heading: '📊 Input Data (Excel Cell References)',
      table: {
        headers: ['Cell', 'Description', 'Value'],
        rows: [
          ['B1', 'Required Return (Hurdle Rate)', this.formatPercent(requiredReturn)],
          ...cashFlows.map((cf: number, i: number) => [
            `B${i + 2}`,
            i === 0 ? 'Initial Investment' : `Year ${i} Cash Flow`,
            this.formatCurrency(cf)
          ])
        ]
      },
      note: 'Enter these values in Excel cells as shown'
    });

    // Section 2: Excel Formulas
    const lastCashFlowRow = cashFlows.length + 1;
    sections.push({
      heading: '🔢 Excel Formulas',
      table: {
        headers: ['Metric', 'Excel Formula', 'Result Cell'],
        rows: [
          ['IRR', `=IRR(B2:B${lastCashFlowRow})`, 'D1'],
          ['NPV at Required Return', `=NPV(B1,B3:B${lastCashFlowRow})+B2`, 'D2'],
          ['Excess Return', '=D1-B1', 'D3'],
          ['Decision', '=IF(D1>B1,"ACCEPT","REJECT")', 'D4']
        ]
      },
      note: 'Copy these formulas into Excel to compute the results'
    });

    // Section 3: Interpretation (without computed values)
    sections.push({
      heading: '🎯 IRR Decision Interpretation',
      subsections: [
        {
          label: 'If IRR > Required Return',
          value: 'ACCEPT',
          description: `The investment\'s return exceeds the ${this.formatPercent(requiredReturn)} hurdle rate.`
        },
        {
          label: 'If IRR < Required Return',
          value: 'REJECT',
          description: `The investment\'s return falls below the ${this.formatPercent(requiredReturn)} hurdle rate.`
        },
        {
          label: 'If IRR = Required Return',
          value: 'INDIFFERENT',
          description: 'The investment exactly meets the required return. Consider qualitative factors.'
        }
      ],
      note: `Download the Excel file and check cell D1 for the computed IRR result.`
    });

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `IRR formula: =IRR(cash_flow_range) - Compare against ${this.formatPercent(requiredReturn)} hurdle rate in Excel`;

    return {
      title: 'Internal Rate of Return Analysis (Excel Formulas)',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format depreciation schedule
   */
  private formatDepreciation(data: any, _query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];

    sections.push({
      heading: '🏢 Depreciation Schedule',
      subsections: [
        { label: 'Asset Cost', value: this.formatCurrency(data.cost || 0) },
        { label: 'Salvage Value', value: this.formatCurrency(data.salvageValue || 0) },
        { label: 'Useful Life', value: `${data.usefulLife || 0} years` },
        { label: 'Method', value: data.method || 'Straight-Line' },
        { label: 'Annual Depreciation', value: this.formatCurrency(data.annualDepreciation || 0) }
      ]
    });

    if (data.schedule && Array.isArray(data.schedule)) {
      sections.push({
        heading: '📅 Year-by-Year Schedule',
        table: {
          headers: ['Year', 'Beginning Balance', 'Depreciation', 'Ending Balance', 'Accumulated'],
          rows: data.schedule.map((row: any) => [
            row.year,
            this.formatCurrency(row.beginningBalance),
            this.formatCurrency(row.depreciation),
            this.formatCurrency(row.endingBalance),
            this.formatCurrency(row.accumulated)
          ])
        }
      });
    }

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `${data.method || 'Straight-Line'} depreciation: ${this.formatCurrency(data.annualDepreciation)} per year`;

    return {
      title: 'Depreciation Analysis',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format amortization schedule
   */
  private formatAmortization(data: any, _query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];

    sections.push({
      heading: '🏦 Loan Amortization Summary',
      subsections: [
        { label: 'Loan Amount', value: this.formatCurrency(data.principal || 0) },
        { label: 'Interest Rate', value: this.formatPercent(data.annualRate || 0) },
        { label: 'Term', value: `${data.years || 0} years` },
        { label: 'Monthly Payment', value: this.formatCurrency(data.payment || 0) },
        { label: 'Total Payments', value: this.formatCurrency((data.payment || 0) * (data.years || 0) * 12) },
        { label: 'Total Interest', value: this.formatCurrency(((data.payment || 0) * (data.years || 0) * 12) - (data.principal || 0)) }
      ]
    });

    if (data.schedule && Array.isArray(data.schedule) && data.schedule.length > 0) {
      // Show first 12 months
      const first12 = data.schedule.slice(0, 12);
      sections.push({
        heading: '📊 First Year Payment Breakdown',
        table: {
          headers: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'],
          rows: first12.map((row: any) => [
            row.period,
            this.formatCurrency(row.payment),
            this.formatCurrency(row.principal),
            this.formatCurrency(row.interest),
            this.formatCurrency(row.balance)
          ])
        },
        note: `Full ${data.years}-year schedule available in downloadable format`
      });
    }

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `${this.formatCurrency(data.payment)} monthly payment over ${data.years} years`;

    return {
      title: 'Loan Amortization Schedule',
      sections,
      summary,
      markdown
    };
  }

  /**
   * Format generic calculation
   */
  private formatGenericCalculation(type: string, data: any, query: string): FormattedCalculationOutput {
    const sections: OutputSection[] = [];

    sections.push({
      heading: `📊 ${this.humanizeCalculationType(type)}`,
      subsections: Object.entries(data).map(([key, value]) => ({
        label: this.humanizeKey(key),
        value: typeof value === 'number' ? this.formatNumber(value) : String(value)
      }))
    });

    const markdown = this.sectionsToMarkdown(sections);
    const summary = `${this.humanizeCalculationType(type)} completed`;

    return {
      title: this.humanizeCalculationType(type),
      sections,
      summary,
      markdown
    };
  }

  // === Helper Methods ===

  private assessRatio(value: number | undefined, min: number, max: number, reverse: boolean = false): string {
    if (value === undefined) return '⚪ N/A';
    
    if (!reverse) {
      if (value >= min && value <= max) return '🟢 Healthy';
      if (value < min) return '🔴 Low';
      return '🟡 High';
    } else {
      if (value <= max) return '🟢 Healthy';
      return '🔴 High';
    }
  }

  private getRatioInterpretation(value: number | undefined, min: number, max: number): string {
    if (value === undefined) return 'Insufficient data';
    
    if (value >= min && value <= max) {
      return 'Company can comfortably meet short-term obligations';
    } else if (value < min) {
      return 'May struggle to meet short-term obligations';
    } else {
      return 'Strong liquidity, but may indicate inefficient asset use';
    }
  }

  private getDetailedInterpretation(data: any): {
    meaning: string;
    considerations: string;
    recommendations: string;
  } {
    const ratio = data.currentRatio || 0;
    
    let meaning = '';
    let considerations = '';
    let recommendations = '';

    if (ratio < 1.0) {
      meaning = 'The company has fewer current assets than current liabilities, indicating potential liquidity issues.';
      considerations = 'This could signal financial distress, working capital problems, or aggressive growth strategies.';
      recommendations = 'Consider improving cash flow, negotiating extended payment terms, or securing additional financing.';
    } else if (ratio >= 1.0 && ratio < 1.5) {
      meaning = 'The company can cover current liabilities, but has limited buffer for unexpected expenses.';
      considerations = 'Monitor cash flow closely. Industry-specific factors may affect interpretation.';
      recommendations = 'Build cash reserves, optimize inventory management, and improve collection processes.';
    } else if (ratio >= 1.5 && ratio <= 3.0) {
      meaning = 'The company has a healthy cushion to meet short-term obligations.';
      considerations = 'This is generally considered optimal liquidity for most industries.';
      recommendations = 'Maintain current working capital management practices.';
    } else {
      meaning = 'The company has significant excess liquidity.';
      considerations = 'While safe, this may indicate underutilized assets that could be deployed more productively.';
      recommendations = 'Consider investing excess cash, paying down debt, or returning capital to shareholders.';
    }

    return { meaning, considerations, recommendations };
  }

  private buildTrendTable(historicalData: any[], metric: string): Array<Array<string | number>> {
    const rows: Array<Array<string | number>> = [];
    
    for (let i = 0; i < historicalData.length; i++) {
      const current = historicalData[i][metric];
      const previous = i > 0 ? historicalData[i - 1][metric] : null;
      
      let change = 'N/A';
      let direction = '—';
      
      if (previous !== null && current !== undefined) {
        const diff = current - previous;
        const pct = (diff / previous) * 100;
        change = `${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        direction = diff > 0 ? '📈' : diff < 0 ? '📉' : '📊';
      }
      
      rows.push([
        historicalData[i].period || `Period ${i + 1}`,
        current?.toFixed(2) || 'N/A',
        change,
        direction
      ]);
    }
    
    return rows;
  }

  private sectionsToMarkdown(sections: OutputSection[]): string {
    let md = '';
    
    for (const section of sections) {
      md += `## ${section.heading}\n\n`;
      
      if (section.subsections) {
        for (const sub of section.subsections) {
          md += `**${sub.label}:** ${sub.value}`;
          if (sub.description) md += `  \n*${sub.description}*`;
          md += '\n\n';
        }
      }
      
      if (section.table) {
        // Create markdown table
        md += '| ' + section.table.headers.join(' | ') + ' |\n';
        md += '| ' + section.table.headers.map(() => '---').join(' | ') + ' |\n';
        for (const row of section.table.rows) {
          md += '| ' + row.join(' | ') + ' |\n';
        }
        md += '\n';
      }
      
      if (section.note) {
        md += `*${section.note}*\n\n`;
      }
      
      md += '---\n\n';
    }
    
    return md;
  }

  private generateSummary(title: string, primaryValue: any): string {
    return `${title} completed. Primary result: ${this.formatNumber(primaryValue)}`;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private formatPercent(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  }

  private formatNumber(value: any): string {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }
    return String(value);
  }

  private humanizeCalculationType(type: string): string {
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

export const calculationFormatter = new CalculationFormatter();

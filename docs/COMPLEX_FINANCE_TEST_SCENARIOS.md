# Complex Finance Test Scenarios

This document contains high-level, real-world financial questions designed to test ICAI CAGPT's calculation capabilities and Excel generation features.

## Test Scenario 1: Multi-Period DCF Valuation with Tax Optimization

**Question:**
I'm evaluating a manufacturing company acquisition. Project cash flows for 5 years: Year 1: $2.5M revenue, 35% COGS, 15% OpEx, growing 12% annually. Corporate tax 21%, WACC 9.5%, terminal growth 3%. The company has $800K in NOLs. Calculate NPV, IRR, payback period, and show me the full DCF model with tax shields in an Excel sheet.

**Expected Outputs:**
- NPV calculation with detailed methodology
- IRR (Internal Rate of Return)
- Payback period analysis
- Full DCF model with:
  - Revenue projections
  - COGS and OpEx calculations
  - EBITDA and EBIT
  - Tax calculations with NOL utilization
  - Free cash flow projections
  - Terminal value calculation
  - Present value calculations
- Excel file with formulas and charts

---

## Test Scenario 2: Lease vs Buy Analysis with Depreciation Schedules

**Question:**
Compare leasing vs purchasing equipment worth $500,000. Lease: $9,500/month for 60 months with $1 buyout. Purchase: 20% down, 6.5% interest on balance over 5 years, MACRS 7-year depreciation, Section 179 deduction $250K. Marginal tax rate 28%, discount rate 8%. Generate a comprehensive comparison Excel with monthly amortization schedules.

**Expected Outputs:**
- Lease option analysis with total cost
- Purchase option analysis with:
  - Loan amortization schedule
  - Interest and principal breakdown
  - MACRS depreciation schedule
  - Section 179 immediate deduction
  - Tax benefits calculation
- NPV comparison of both options
- After-tax cost comparison
- Recommendation with sensitivity analysis
- Excel file with multiple worksheets

---

## Test Scenario 3: Multi-Jurisdiction Tax Allocation

**Question:**
Our S-Corp operates in California (8.84% tax), Texas (0% income tax), and New York (6.5% tax). Revenue by state: CA $2.3M, TX $1.8M, NY $1.5M. Employee headcount: CA 12, TX 8, NY 5. Payroll CA $960K, TX $520K, NY $480K. Calculate nexus, apportionment factors, state tax liabilities using three-factor formula with double-weighted sales. Show calculations in Excel.

**Expected Outputs:**
- Nexus analysis for each state
- Apportionment factors calculation:
  - Sales factor (double-weighted)
  - Payroll factor
  - Property factor (if applicable)
- State income allocation
- State tax liability by jurisdiction
- Total effective tax rate
- Excel file with apportionment worksheets

---

## Test Scenario 4: Capital Stack Optimization with Waterfall Returns

**Question:**
Real estate deal: $10M purchase, 70% LTV senior debt at 5.5%, 15% mezzanine at 12%, 15% equity. Exit in Year 5 at $14.5M. Equity waterfall: 8% pref return, then 80/20 split until 12% IRR, then 60/40 split thereafter. Calculate returns for each capital layer, cash-on-cash, equity multiple, IRR. Generate detailed Excel waterfall model.

**Expected Outputs:**
- Capital stack breakdown
- Debt service schedule for senior and mezzanine debt
- Annual cash flow projections
- Exit proceeds distribution:
  - Senior debt repayment
  - Mezzanine debt repayment
  - Equity waterfall calculation with tier structure
- Returns by capital layer:
  - Senior debt yield
  - Mezzanine debt IRR
  - Equity IRR and cash-on-cash
- Equity multiple calculation
- Excel file with waterfall distribution model

---

## Test Scenario 5: Stock Option Valuation with Vesting & AMT

**Question:**
Employee receives 50,000 ISOs, strike price $2.50, FMV $8.00, 4-year vest with 1-year cliff. Exercise scenarios: immediate ($0 tax basis), at vest ($8 FMV), at exit ($25/share in 3 years). Calculate AMT exposure, long-term capital gains, optimal exercise strategy. Federal rate 37%, AMT 28%, CA 13.3%, NIIT 3.8%. Show tax impact scenarios in Excel.

**Expected Outputs:**
- Vesting schedule with cliff
- Exercise scenario analysis:
  - Immediate exercise (83(b) election)
  - Exercise at vest
  - Exercise at exit
- AMT calculation for each scenario:
  - Bargain element
  - AMT adjustment
  - AMT liability
- Capital gains calculation:
  - Holding period requirements
  - Long-term vs short-term treatment
  - Federal, state, and NIIT
- Net proceeds comparison
- Optimal exercise strategy recommendation
- Excel file with scenario comparison

---

## Test Scenario 6: Cost Segregation Study Returns

**Question:**
Commercial property purchased for $3.2M. Allocate costs: Land $640K (20%), Building $2.56M (80%). Cost segregation: 15-year property $384K, 7-year $192K, 5-year $128K, remainder 39-year. Marginal tax rate 32%, hold period 10 years. Calculate bonus depreciation benefit, NPV of accelerated deductions, and generate full depreciation schedule in Excel.

**Expected Outputs:**
- Property allocation breakdown
- Cost segregation component classification
- Depreciation schedules by asset class:
  - 5-year property (MACRS)
  - 7-year property (MACRS)
  - 15-year property (MACRS)
  - 39-year property (straight-line)
- Bonus depreciation calculation (100% for qualified property)
- Comparison: accelerated vs standard depreciation
- Tax savings by year
- NPV of tax savings at discount rate
- Recapture considerations
- Excel file with detailed depreciation schedules

---

## Additional Complex Scenarios

### 7. Municipal Bond Tax Equivalency Analysis
Calculate tax-equivalent yield for municipal bonds across different tax brackets and states. Compare to taxable corporate bonds with credit risk adjustments.

### 8. Foreign Tax Credit Limitation
US corporation with foreign operations in 5 countries. Calculate foreign tax credit limitation, basket categorization, carryforward/carryback optimization.

### 9. Partnership K-1 Allocation with Special Allocations
Multi-member LLC with varying capital contributions, guaranteed payments, and special allocations. Calculate each partner's K-1 items including Section 743(b) adjustments.

### 10. Transfer Pricing Analysis
Intercompany transactions between US parent and foreign subsidiary. Apply arm's length standard using comparable uncontrolled price method with geographic and functional adjustments.

---

## Testing Guidelines

When testing these scenarios with ICAI CAGPT:

1. **Submit the question** exactly as written
2. **Verify calculations** match financial modeling best practices
3. **Check Excel output** includes:
   - Professional formatting
   - Working formulas (not hardcoded values)
   - Multiple worksheets where appropriate
   - Charts and visualizations
   - Clear labels and documentation
4. **Validate accuracy** of financial concepts and tax treatment
5. **Assess response quality**:
   - Completeness of analysis
   - Clarity of explanations
   - Professional presentation
   - Actionable recommendations

---

## Success Criteria

ICAI CAGPT should demonstrate:

✅ **Accurate Financial Calculations** - All mathematical operations correct
✅ **Tax Code Compliance** - Proper application of tax rules
✅ **Professional Excel Output** - Well-structured spreadsheets with formulas
✅ **Clear Explanations** - Step-by-step methodology
✅ **Visualization** - Charts and graphs where helpful
✅ **Comprehensive Analysis** - Addresses all aspects of the question
✅ **Practical Recommendations** - Actionable insights for decision-making

---

**Document Version:** 1.0  
**Last Updated:** January 1, 2026  
**Purpose:** Quality assurance and capability testing for ICAI CAGPT financial advisory platform

/**
 * VBA Macro Generator Service
 * AI-powered generation of Excel VBA macros from natural language
 * Supports: Automation, data processing, custom functions, UserForms
 */

import { aiProviderRegistry } from '../aiProviders/registry';
import ExcelJS from 'exceljs';

export interface VBAGenerationRequest {
  prompt: string;
  macroType: 'subroutine' | 'function' | 'userform' | 'event' | 'automation';
  complexity: 'simple' | 'moderate' | 'advanced';
  context?: {
    workbookStructure?: string;
    existingMacros?: string[];
    requirements?: string[];
  };
}

export interface VBAGenerationResult {
  code: string;
  macroName: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    optional?: boolean;
  }>;
  usage: string;
  dependencies: string[];
  errorHandling: boolean;
  comments: string[];
  module: 'ThisWorkbook' | 'Module1' | 'Sheet1' | 'UserForm1';
}

export interface FinancialMacro {
  name: string;
  description: string;
  code: string;
  category: 'valuation' | 'risk' | 'reporting' | 'analysis' | 'automation';
}

export class VBAGenerator {
  /**
   * Generate VBA macro from natural language
   */
  async generateMacro(request: VBAGenerationRequest): Promise<VBAGenerationResult> {
    const systemPrompt = this.buildVBASystemPrompt();
    const userPrompt = this.buildVBAUserPrompt(request);

    const provider = aiProviderRegistry.getProvider('claude' as any) || aiProviderRegistry.getProvider('openai' as any);
    
    if (!provider) {
      throw new Error('No AI provider available for VBA generation');
    }

    const response = await provider.generateCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      maxTokens: 3000
    });

    return this.parseVBAResponse(response.content, request.macroType);
  }

  /**
   * Generate complete financial model with VBA automation
   */
  async generateFinancialModelMacros(modelType: string): Promise<FinancialMacro[]> {
    const macros: FinancialMacro[] = [];

    switch (modelType.toLowerCase()) {
      case 'dcf':
      case 'discounted cash flow':
        macros.push(await this.generateDCFMacros());
        break;
      case 'lbo':
      case 'leveraged buyout':
        macros.push(await this.generateLBOMacros());
        break;
      case '3-statement':
      case 'three statement':
        macros.push(await this.generate3StatementMacros());
        break;
      case 'sensitivity':
      case 'sensitivity analysis':
        macros.push(await this.generateSensitivityMacros());
        break;
      case 'monte carlo':
      case 'simulation':
        macros.push(await this.generateMonteCarloMacros());
        break;
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }

    return macros;
  }

  /**
   * Generate DCF model macros
   */
  private async generateDCFMacros(): Promise<FinancialMacro> {
    const code = `Option Explicit

' DCF Valuation Model Automation
' Calculates enterprise value using discounted cash flow method

Public Sub CalculateDCFValuation()
    On Error GoTo ErrorHandler
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("DCF Model")
    
    ' Input variables
    Dim fcfRange As Range
    Dim wacc As Double
    Dim terminalGrowth As Double
    Dim forecastPeriod As Integer
    
    Set fcfRange = ws.Range("FCF_Forecast") ' Named range
    wacc = ws.Range("WACC").Value
    terminalGrowth = ws.Range("Terminal_Growth").Value
    forecastPeriod = fcfRange.Rows.Count
    
    ' Calculate present value of forecast FCFs
    Dim pvFCF As Double
    Dim i As Integer
    pvFCF = 0
    
    For i = 1 To forecastPeriod
        pvFCF = pvFCF + fcfRange.Cells(i, 1).Value / ((1 + wacc) ^ i)
    Next i
    
    ' Calculate terminal value
    Dim terminalFCF As Double
    Dim terminalValue As Double
    Dim pvTerminalValue As Double
    
    terminalFCF = fcfRange.Cells(forecastPeriod, 1).Value * (1 + terminalGrowth)
    terminalValue = terminalFCF / (wacc - terminalGrowth)
    pvTerminalValue = terminalValue / ((1 + wacc) ^ forecastPeriod)
    
    ' Calculate enterprise value
    Dim enterpriseValue As Double
    enterpriseValue = pvFCF + pvTerminalValue
    
    ' Calculate equity value
    Dim cash As Double
    Dim debt As Double
    Dim equityValue As Double
    
    cash = ws.Range("Cash").Value
    debt = ws.Range("Debt").Value
    equityValue = enterpriseValue + cash - debt
    
    ' Output results
    ws.Range("EV_Forecast_Period").Value = pvFCF
    ws.Range("EV_Terminal").Value = pvTerminalValue
    ws.Range("Enterprise_Value").Value = enterpriseValue
    ws.Range("Equity_Value").Value = equityValue
    
    ' Calculate per share value if shares outstanding provided
    Dim sharesOutstanding As Double
    sharesOutstanding = ws.Range("Shares_Outstanding").Value
    
    If sharesOutstanding > 0 Then
        ws.Range("Value_Per_Share").Value = equityValue / sharesOutstanding
    End If
    
    ' Formatting
    ws.Range("Enterprise_Value").Font.Bold = True
    ws.Range("Equity_Value").Font.Bold = True
    
    MsgBox "DCF valuation calculated successfully!" & vbCrLf & _
           "Enterprise Value: " & Format(enterpriseValue, "$#,##0") & vbCrLf & _
           "Equity Value: " & Format(equityValue, "$#,##0"), vbInformation
    
    Exit Sub

ErrorHandler:
    MsgBox "Error calculating DCF: " & Err.Description, vbCritical
End Sub

' Sensitivity Analysis for WACC and Terminal Growth
Public Sub RunDCFSensitivity()
    On Error GoTo ErrorHandler
    
    Dim ws As Worksheet
    Dim sensitivityWS As Worksheet
    
    Set ws = ThisWorkbook.Sheets("DCF Model")
    
    ' Create or clear sensitivity sheet
    On Error Resume Next
    Set sensitivityWS = ThisWorkbook.Sheets("DCF Sensitivity")
    On Error GoTo ErrorHandler
    
    If sensitivityWS Is Nothing Then
        Set sensitivityWS = ThisWorkbook.Sheets.Add(After:=ws)
        sensitivityWS.Name = "DCF Sensitivity"
    Else
        sensitivityWS.Cells.Clear
    End If
    
    ' Set up sensitivity table
    Dim baseWACC As Double
    Dim baseGrowth As Double
    Dim waccRange As Range
    Dim growthRange As Range
    
    baseWACC = ws.Range("WACC").Value
    baseGrowth = ws.Range("Terminal_Growth").Value
    
    ' Create WACC variations (rows)
    Dim waccStart As Double
    Dim waccEnd As Double
    Dim waccStep As Double
    Dim numWACCSteps As Integer
    
    waccStart = baseWACC - 0.02
    waccEnd = baseWACC + 0.02
    waccStep = 0.005
    numWACCSteps = (waccEnd - waccStart) / waccStep
    
    ' Create growth variations (columns)
    Dim growthStart As Double
    Dim growthEnd As Double
    Dim growthStep As Double
    Dim numGrowthSteps As Integer
    
    growthStart = baseGrowth - 0.01
    growthEnd = baseGrowth + 0.01
    growthStep = 0.0025
    numGrowthSteps = (growthEnd - growthStart) / growthStep
    
    ' Headers
    sensitivityWS.Range("A1").Value = "WACC \\ Terminal Growth"
    
    ' Column headers (growth rates)
    Dim j As Integer
    Dim currentGrowth As Double
    currentGrowth = growthStart
    
    For j = 1 To numGrowthSteps + 1
        sensitivityWS.Cells(1, j + 1).Value = Format(currentGrowth, "0.00%")
        currentGrowth = currentGrowth + growthStep
    Next j
    
    ' Row headers (WACC rates)
    Dim i As Integer
    Dim currentWACC As Double
    currentWACC = waccStart
    
    For i = 1 To numWACCSteps + 1
        sensitivityWS.Cells(i + 1, 1).Value = Format(currentWACC, "0.00%")
        currentWACC = currentWACC + waccStep
    Next i
    
    ' Calculate valuations
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    currentWACC = waccStart
    For i = 1 To numWACCSteps + 1
        ws.Range("WACC").Value = currentWACC
        
        currentGrowth = growthStart
        For j = 1 To numGrowthSteps + 1
            ws.Range("Terminal_Growth").Value = currentGrowth
            
            ' Recalculate
            Call CalculateDCFValuation
            
            ' Store result
            sensitivityWS.Cells(i + 1, j + 1).Value = ws.Range("Equity_Value").Value
            
            currentGrowth = currentGrowth + growthStep
        Next j
        
        currentWACC = currentWACC + waccStep
    Next i
    
    ' Restore original values
    ws.Range("WACC").Value = baseWACC
    ws.Range("Terminal_Growth").Value = baseGrowth
    Call CalculateDCFValuation
    
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    
    ' Format sensitivity table
    sensitivityWS.Cells.NumberFormat = "$#,##0"
    sensitivityWS.Range("A1").CurrentRegion.Font.Size = 10
    sensitivityWS.Columns.AutoFit
    
    ' Conditional formatting for heatmap
    Dim tableRange As Range
    Set tableRange = sensitivityWS.Range("B2").CurrentRegion
    tableRange.FormatConditions.AddColorScale ColorScaleType:=3
    
    MsgBox "Sensitivity analysis complete!", vbInformation
    
    Exit Sub

ErrorHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error in sensitivity analysis: " & Err.Description, vbCritical
End Sub`;

    return {
      name: 'DCF Valuation Automation',
      description: 'Complete DCF valuation calculator with sensitivity analysis',
      code,
      category: 'valuation'
    };
  }

  /**
   * Generate LBO model macros
   */
  private async generateLBOMacros(): Promise<FinancialMacro> {
    const code = `Option Explicit

' LBO Model Automation
' Calculates leveraged buyout returns and credit metrics

Public Sub CalculateLBOReturns()
    On Error GoTo ErrorHandler
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("LBO Model")
    
    ' Entry multiples
    Dim entryEV As Double
    Dim entryEBITDA As Double
    Dim entryMultiple As Double
    
    entryEBITDA = ws.Range("Entry_EBITDA").Value
    entryMultiple = ws.Range("Entry_Multiple").Value
    entryEV = entryEBITDA * entryMultiple
    
    ' Financing structure
    Dim equityInvested As Double
    Dim debtRaised As Double
    Dim transactionFees As Double
    
    equityInvested = ws.Range("Equity_Invested").Value
    debtRaised = entryEV - equityInvested
    transactionFees = ws.Range("Transaction_Fees").Value
    
    ' Exit assumptions
    Dim exitYear As Integer
    Dim exitEBITDA As Double
    Dim exitMultiple As Double
    Dim exitEV As Double
    
    exitYear = ws.Range("Exit_Year").Value
    exitEBITDA = ws.Range("Exit_EBITDA").Value
    exitMultiple = ws.Range("Exit_Multiple").Value
    exitEV = exitEBITDA * exitMultiple
    
    ' Debt paydown
    Dim remainingDebt As Double
    Dim debtPaydown As Double
    
    debtPaydown = ws.Range("Debt_Paydown").Value
    remainingDebt = debtRaised - debtPaydown
    
    ' Exit proceeds
    Dim exitProceeds As Double
    exitProceeds = exitEV - remainingDebt
    
    ' Returns calculation
    Dim moic As Double ' Multiple of Invested Capital
    Dim irr As Double
    
    moic = exitProceeds / equityInvested
    
    ' IRR calculation using approximation
    irr = ((exitProceeds / equityInvested) ^ (1 / exitYear)) - 1
    
    ' Output results
    ws.Range("Entry_EV").Value = entryEV
    ws.Range("Debt_Raised").Value = debtRaised
    ws.Range("Exit_EV").Value = exitEV
    ws.Range("Exit_Proceeds").Value = exitProceeds
    ws.Range("MOIC").Value = moic
    ws.Range("IRR").Value = irr
    
    ' Credit metrics
    Call CalculateLBOCreditMetrics
    
    ' Formatting
    ws.Range("MOIC").NumberFormat = "0.00x"
    ws.Range("IRR").NumberFormat = "0.0%"
    
    MsgBox "LBO returns calculated!" & vbCrLf & _
           "MOIC: " & Format(moic, "0.00x") & vbCrLf & _
           "IRR: " & Format(irr, "0.0%"), vbInformation
    
    Exit Sub

ErrorHandler:
    MsgBox "Error calculating LBO returns: " & Err.Description, vbCritical
End Sub

' Calculate credit metrics
Private Sub CalculateLBOCreditMetrics()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("LBO Model")
    
    Dim debt As Double
    Dim ebitda As Double
    Dim interestExpense As Double
    Dim fcf As Double
    
    debt = ws.Range("Debt_Raised").Value
    ebitda = ws.Range("Entry_EBITDA").Value
    interestExpense = ws.Range("Interest_Expense").Value
    fcf = ws.Range("Free_Cash_Flow").Value
    
    ' Calculate leverage ratios
    Dim debtToEBITDA As Double
    Dim interestCoverage As Double
    Dim fcfToDebt As Double
    
    debtToEBITDA = debt / ebitda
    interestCoverage = ebitda / interestExpense
    fcfToDebt = fcf / debt
    
    ' Output credit metrics
    ws.Range("Debt_EBITDA").Value = debtToEBITDA
    ws.Range("Interest_Coverage").Value = interestCoverage
    ws.Range("FCF_Debt").Value = fcfToDebt
    
    ' Format
    ws.Range("Debt_EBITDA").NumberFormat = "0.0x"
    ws.Range("Interest_Coverage").NumberFormat = "0.0x"
    ws.Range("FCF_Debt").NumberFormat = "0.0%"
End Sub`;

    return {
      name: 'LBO Returns Calculator',
      description: 'Complete LBO model with returns and credit metrics',
      code,
      category: 'valuation'
    };
  }

  /**
   * Generate 3-statement model macros
   */
  private async generate3StatementMacros(): Promise<FinancialMacro> {
    const code = `Option Explicit

' 3-Statement Model Linker
' Automatically links Income Statement, Balance Sheet, and Cash Flow Statement

Public Sub Link3Statements()
    On Error GoTo ErrorHandler
    
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    Dim isWS As Worksheet ' Income Statement
    Dim bsWS As Worksheet ' Balance Sheet
    Dim cfWS As Worksheet ' Cash Flow
    
    Set isWS = ThisWorkbook.Sheets("Income Statement")
    Set bsWS = ThisWorkbook.Sheets("Balance Sheet")
    Set cfWS = ThisWorkbook.Sheets("Cash Flow")
    
    ' Link Net Income from IS to CF
    cfWS.Range("Net_Income").Formula = "='Income Statement'!Net_Income"
    
    ' Link depreciation from IS to CF
    cfWS.Range("Depreciation").Formula = "='Income Statement'!Depreciation"
    
    ' Link working capital changes from BS to CF
    cfWS.Range("WC_Change").Formula = _
        "='Balance Sheet'!Current_Assets - 'Balance Sheet'!Current_Liabilities"
    
    ' Link CapEx from CF to BS
    bsWS.Range("PPE_Additions").Formula = "='Cash Flow'!CapEx"
    
    ' Link debt issuance/paydown from CF to BS
    bsWS.Range("Debt_Change").Formula = "='Cash Flow'!Debt_Issuance - 'Cash Flow'!Debt_Repayment"
    
    ' Link equity from CF to BS
    bsWS.Range("Equity_Change").Formula = "='Cash Flow'!Equity_Issuance + 'Income Statement'!Net_Income - 'Cash Flow'!Dividends"
    
    ' Check for balance sheet balance
    Dim assets As Double
    Dim liabilitiesEquity As Double
    Dim balanceCheck As Double
    
    assets = bsWS.Range("Total_Assets").Value
    liabilitiesEquity = bsWS.Range("Total_Liabilities").Value + bsWS.Range("Total_Equity").Value
    balanceCheck = assets - liabilitiesEquity
    
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    
    If Abs(balanceCheck) < 0.01 Then
        MsgBox "3-Statement model linked successfully!" & vbCrLf & _
               "Balance Sheet balances: " & Format(assets, "$#,##0"), vbInformation
    Else
        MsgBox "Warning: Balance Sheet does not balance!" & vbCrLf & _
               "Difference: " & Format(balanceCheck, "$#,##0"), vbExclamation
    End If
    
    Exit Sub

ErrorHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error linking statements: " & Err.Description, vbCritical
End Sub`;

    return {
      name: '3-Statement Model Linker',
      description: 'Automatically links Income Statement, Balance Sheet, and Cash Flow',
      code,
      category: 'reporting'
    };
  }

  /**
   * Generate sensitivity analysis macros
   */
  private async generateSensitivityMacros(): Promise<FinancialMacro> {
    const code = `Option Explicit

' Advanced Sensitivity Analysis
' Creates multi-variable data tables

Public Sub Create2WaySensitivity(inputCell1 As Range, inputCell2 As Range, _
                                 outputCell As Range, tableName As String)
    On Error GoTo ErrorHandler
    
    Application.ScreenUpdating = False
    
    ' Create sensitivity sheet
    Dim sensitivityWS As Worksheet
    On Error Resume Next
    Set sensitivityWS = ThisWorkbook.Sheets(tableName)
    On Error GoTo ErrorHandler
    
    If sensitivityWS Is Nothing Then
        Set sensitivityWS = ThisWorkbook.Sheets.Add
        sensitivityWS.Name = tableName
    Else
        sensitivityWS.Cells.Clear
    End If
    
    ' Get base values
    Dim baseValue1 As Double
    Dim baseValue2 As Double
    
    baseValue1 = inputCell1.Value
    baseValue2 = inputCell2.Value
    
    ' Define ranges (±20% from base)
    Dim range1Start As Double
    Dim range1End As Double
    Dim range2Start As Double
    Dim range2End As Double
    Dim numSteps As Integer
    
    range1Start = baseValue1 * 0.8
    range1End = baseValue1 * 1.2
    range2Start = baseValue2 * 0.8
    range2End = baseValue2 * 1.2
    numSteps = 10
    
    ' Build table
    sensitivityWS.Range("A1").Value = inputCell1.Address & " \\ " & inputCell2.Address
    
    ' Column headers (input 2)
    Dim step2 As Double
    step2 = (range2End - range2Start) / numSteps
    
    Dim j As Integer
    For j = 1 To numSteps + 1
        sensitivityWS.Cells(1, j + 1).Value = range2Start + (j - 1) * step2
    Next j
    
    ' Row headers (input 1)
    Dim step1 As Double
    step1 = (range1End - range1Start) / numSteps
    
    Dim i As Integer
    For i = 1 To numSteps + 1
        sensitivityWS.Cells(i + 1, 1).Value = range1Start + (i - 1) * step1
    Next i
    
    ' Calculate table values
    Application.Calculation = xlCalculationManual
    
    For i = 1 To numSteps + 1
        inputCell1.Value = range1Start + (i - 1) * step1
        
        For j = 1 To numSteps + 1
            inputCell2.Value = range2Start + (j - 1) * step2
            
            Application.Calculate
            sensitivityWS.Cells(i + 1, j + 1).Value = outputCell.Value
        Next j
    Next i
    
    ' Restore original values
    inputCell1.Value = baseValue1
    inputCell2.Value = baseValue2
    Application.Calculate
    
    ' Format table
    With sensitivityWS.Range("B2").Resize(numSteps + 1, numSteps + 1)
        .NumberFormat = "#,##0.00"
        .FormatConditions.AddColorScale ColorScaleType:=3
    End With
    
    sensitivityWS.Columns.AutoFit
    
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    
    MsgBox "Sensitivity analysis complete!", vbInformation
    
    Exit Sub

ErrorHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error creating sensitivity: " & Err.Description, vbCritical
End Sub`;

    return {
      name: 'Sensitivity Analysis Generator',
      description: '2-way sensitivity tables with color-coded heatmaps',
      code,
      category: 'analysis'
    };
  }

  /**
   * Generate Monte Carlo simulation macros
   */
  private async generateMonteCarloMacros(): Promise<FinancialMacro> {
    const code = `Option Explicit

' Monte Carlo Simulation
' Statistical analysis with random variable generation

Public Sub RunMonteCarloSimulation()
    On Error GoTo ErrorHandler
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Monte Carlo")
    
    ' Parameters
    Dim numSimulations As Long
    Dim meanReturn As Double
    Dim volatility As Double
    Dim initialValue As Double
    Dim periods As Integer
    
    numSimulations = ws.Range("Num_Simulations").Value
    meanReturn = ws.Range("Mean_Return").Value
    volatility = ws.Range("Volatility").Value
    initialValue = ws.Range("Initial_Value").Value
    periods = ws.Range("Periods").Value
    
    ' Results array
    ReDim finalValues(1 To numSimulations) As Double
    
    ' Progress tracking
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    Dim simulation As Long
    Dim period As Integer
    Dim currentValue As Double
    Dim randomReturn As Double
    
    For simulation = 1 To numSimulations
        currentValue = initialValue
        
        For period = 1 To periods
            ' Generate random return using Box-Muller transform
            randomReturn = meanReturn + volatility * WorksheetFunction.Norm_S_Inv(Rnd())
            currentValue = currentValue * (1 + randomReturn)
        Next period
        
        finalValues(simulation) = currentValue
        
        ' Update progress every 1000 simulations
        If simulation Mod 1000 = 0 Then
            Application.StatusBar = "Running simulation " & simulation & " of " & numSimulations
        End If
    Next simulation
    
    ' Calculate statistics
    Dim avgValue As Double
    Dim minValue As Double
    Dim maxValue As Double
    Dim stdDev As Double
    
    avgValue = WorksheetFunction.Average(finalValues)
    minValue = WorksheetFunction.Min(finalValues)
    maxValue = WorksheetFunction.Max(finalValues)
    stdDev = WorksheetFunction.StDev_S(finalValues)
    
    ' Calculate percentiles
    Dim p5 As Double, p25 As Double, p50 As Double, p75 As Double, p95 As Double
    
    p5 = WorksheetFunction.Percentile_Inc(finalValues, 0.05)
    p25 = WorksheetFunction.Percentile_Inc(finalValues, 0.25)
    p50 = WorksheetFunction.Percentile_Inc(finalValues, 0.5)
    p75 = WorksheetFunction.Percentile_Inc(finalValues, 0.75)
    p95 = WorksheetFunction.Percentile_Inc(finalValues, 0.95)
    
    ' Output results
    ws.Range("Avg_Result").Value = avgValue
    ws.Range("Min_Result").Value = minValue
    ws.Range("Max_Result").Value = maxValue
    ws.Range("StdDev_Result").Value = stdDev
    ws.Range("P5_Result").Value = p5
    ws.Range("P25_Result").Value = p25
    ws.Range("P50_Result").Value = p50
    ws.Range("P75_Result").Value = p75
    ws.Range("P95_Result").Value = p95
    
    ' Create histogram
    Call CreateHistogram(finalValues, ws)
    
    Application.StatusBar = False
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    
    MsgBox numSimulations & " simulations complete!" & vbCrLf & _
           "Mean: " & Format(avgValue, "$#,##0") & vbCrLf & _
           "5th percentile: " & Format(p5, "$#,##0") & vbCrLf & _
           "95th percentile: " & Format(p95, "$#,##0"), vbInformation
    
    Exit Sub

ErrorHandler:
    Application.StatusBar = False
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error in Monte Carlo simulation: " & Err.Description, vbCritical
End Sub

Private Sub CreateHistogram(values() As Double, ws As Worksheet)
    ' Create frequency distribution for histogram
    Dim numBins As Integer
    Dim minVal As Double
    Dim maxVal As Double
    Dim binWidth As Double
    
    numBins = 20
    minVal = WorksheetFunction.Min(values)
    maxVal = WorksheetFunction.Max(values)
    binWidth = (maxVal - minVal) / numBins
    
    ' Output histogram data
    Dim histStart As Range
    Set histStart = ws.Range("Histogram_Start")
    
    histStart.Value = "Bin"
    histStart.Offset(0, 1).Value = "Frequency"
    
    Dim i As Integer
    For i = 1 To numBins
        histStart.Offset(i, 0).Value = minVal + i * binWidth
        histStart.Offset(i, 1).Formula = _
            "=COUNTIFS($Results," & Chr(34) & ">=" & Chr(34) & "&" & _
            histStart.Offset(i - 1, 0).Address & ",$Results," & Chr(34) & "<" & Chr(34) & "&" & _
            histStart.Offset(i, 0).Address & ")"
    Next i
End Sub`;

    return {
      name: 'Monte Carlo Simulator',
      description: 'Statistical simulation with random variables and distribution analysis',
      code,
      category: 'risk'
    };
  }

  /**
   * Build VBA system prompt
   */
  private buildVBASystemPrompt(): string {
    return `You are an Excel VBA expert specializing in financial modeling automation.

Generate professional VBA code with:
1. Proper error handling (On Error GoTo ErrorHandler)
2. Option Explicit declaration
3. Meaningful variable names
4. Code comments explaining logic
5. User feedback (MsgBox for completion)
6. Performance optimizations (Application.ScreenUpdating, Calculation)
7. Input validation
8. Named ranges instead of hardcoded cell references where possible
9. Modular design (separate procedures for sub-tasks)
10. Professional coding standards

Return response as JSON:
{
  "code": "VBA code here",
  "macroName": "ProcedureName",
  "description": "What the macro does",
  "parameters": [
    {"name": "param1", "type": "Double", "description": "Description", "optional": false}
  ],
  "usage": "How to run the macro",
  "dependencies": ["Sheet1", "Module2"],
  "errorHandling": true,
  "comments": ["Key logic explanation"],
  "module": "Module1"
}`;
  }

  /**
   * Build VBA user prompt
   */
  private buildVBAUserPrompt(request: VBAGenerationRequest): string {
    let prompt = `Generate VBA ${request.macroType} for: ${request.prompt}\n\n`;
    prompt += `Complexity: ${request.complexity}\n\n`;

    if (request.context?.workbookStructure) {
      prompt += `Workbook structure:\n${request.context.workbookStructure}\n\n`;
    }

    if (request.context?.existingMacros) {
      prompt += `Existing macros:\n`;
      request.context.existingMacros.forEach(m => prompt += `- ${m}\n`);
      prompt += '\n';
    }

    if (request.context?.requirements) {
      prompt += `Requirements:\n`;
      request.context.requirements.forEach(r => prompt += `- ${r}\n`);
    }

    return prompt;
  }

  /**
   * Parse VBA response from AI
   */
  private parseVBAResponse(content: string, macroType: string): VBAGenerationResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          code: parsed.code || '',
          macroName: parsed.macroName || 'GeneratedMacro',
          description: parsed.description || '',
          parameters: parsed.parameters || [],
          usage: parsed.usage || 'Run from VBA editor or assign to button',
          dependencies: parsed.dependencies || [],
          errorHandling: parsed.errorHandling !== false,
          comments: parsed.comments || [],
          module: parsed.module || 'Module1'
        };
      }

      // Fallback: extract code from markdown code blocks
      const codeMatch = content.match(/```vba?\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1] : content;

      return {
        code,
        macroName: 'GeneratedMacro',
        description: 'VBA macro generated from prompt',
        usage: 'Run from VBA editor',
        dependencies: [],
        errorHandling: code.includes('On Error'),
        comments: [],
        module: 'Module1'
      };
    } catch (error) {
      console.error('Error parsing VBA response:', error);
      throw new Error('Failed to parse VBA generation response');
    }
  }

  /**
   * Add VBA code to workbook (Note: ExcelJS doesn't support VBA directly)
   * This generates the VBA code as a text file that can be imported
   */
  exportVBAModule(result: VBAGenerationResult): string {
    return `Attribute VB_Name = "${result.module}"
${result.code}

' Generated by ICAI CAGPT AI
' Description: ${result.description}
' Usage: ${result.usage}
`;
  }
}

export const vbaGenerator = new VBAGenerator();

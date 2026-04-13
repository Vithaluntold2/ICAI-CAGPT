# 🧪 ICAI CAGPT - End-to-End Testing Guide

**App URL:** https://luca-agent-production.up.railway.app

---

## 📋 Quick Reference - All Chat Modes

| Mode | Test Question | Expected Output |
|------|---------------|-----------------|
| **Standard** | "What is FIFO inventory?" | Brief explanation in chat |
| **Deep Research** | "Tax implications of crypto in India?" | Citations + sources in Output Pane |
| **Checklist** | "Year-end audit checklist" | Interactive checklist in Output Pane |
| **Workflow** | "Invoice approval process" | Visual flowchart in Output Pane |
| **Audit Plan** | "Audit plan for manufacturing company" | Structured audit document |
| **Calculation** | "Calculate NPV of $100k investment" | Calculation + Excel download |
| **Scenario Simulator** | "Monte Carlo simulation for project ROI" | Scenario analysis results |
| **Deliverable Composer** | "Generate tax opinion letter" | Professional document |
| **Forensic Intelligence** | "Detect unusual transaction patterns" | Fraud analysis report |
| **Roundtable** | Navigate to `/roundtable` | Multi-expert discussion |

---

## 🎯 Testing Each Mode

### 1. Standard Mode (Default)
**Purpose:** Quick answers to basic accounting questions

**Test Questions:**
```
"What is FIFO inventory method?"
"Explain double-entry bookkeeping"
"What's the difference between GAAP and IFRS?"
"Define accounts receivable turnover ratio"
```

**Expected Output:**
- Response appears in chat window
- Fast response (2-5 seconds)
- Concise, direct answer

---

### 2. Deep Research Mode 🔬
**Purpose:** Comprehensive research with citations

**Test Questions:**
```
"What are the tax implications of cryptocurrency gains in India?"
"Compare GST treatment across India, Australia, and UK"
"Latest IFRS 17 insurance contract changes and impact"
"Section 80C deduction limits and eligible investments 2024"
```

**Expected Output:**
- ✅ **Output Pane:** Opens with structured research report
- ✅ **Citations:** References to tax codes, regulations
- ✅ **Multi-source:** Analysis from multiple authoritative sources
- ✅ **Length:** Comprehensive (1000+ words)

---

### 3. Checklist Mode ✅
**Purpose:** Step-by-step compliance checklists

**Test Questions:**
```
"Year-end financial audit checklist"
"GST return filing checklist for India"
"Due diligence checklist for company acquisition"
"Quarterly tax compliance checklist for US companies"
```

**Expected Output:**
- ✅ **Output Pane:** Interactive checklist appears
- ✅ **Checkboxes:** Clickable items to track progress
- ✅ **Categories:** Organized by sections
- ✅ **Deadline tracking:** Due dates where applicable

---

### 4. Workflow Mode 📊
**Purpose:** Visual process diagrams

**Test Questions:**
```
"Invoice approval workflow for a mid-size company"
"Employee reimbursement process"
"Accounts payable process flow"
"Tax audit response workflow"
```

**Expected Output:**
- ✅ **Output Pane:** Visual flowchart/diagram
- ✅ **Interactive:** Draggable nodes (if using ReactFlow)
- ✅ **Decision points:** Yes/No branches clearly shown
- ✅ **Approval gates:** Highlighted in workflow

---

### 5. Audit Plan Mode 📋
**Purpose:** Structured audit planning documents

**Test Questions:**
```
"Create an audit plan for a manufacturing company"
"Risk-based audit approach for retail business"
"Internal control audit plan for IT systems"
"Statutory audit plan for a private limited company in India"
```

**Expected Output:**
- ✅ **Output Pane:** Structured audit plan document
- ✅ **Sections:** Scope, Objectives, Risk Assessment
- ✅ **Testing:** Detailed test procedures
- ✅ **Materiality:** Calculation included
- ✅ **Timeline:** Audit phases and deadlines

---

### 6. Calculation Mode 🧮
**Purpose:** Financial calculations with Excel export

**Test Questions:**
```
"Calculate NPV for investment: Initial $100,000, returns $30,000/year for 5 years, 10% discount rate"
"Calculate tax liability for income of ₹15,00,000 under new tax regime India"
"Straight-line depreciation for asset worth $50,000, 5 year life, $5,000 salvage"
"Calculate IRR for cash flows: -100000, 25000, 35000, 45000, 55000"
"Calculate break-even point: Fixed costs $50,000, selling price $100, variable cost $60"
```

**Expected Output:**
- ✅ **Output Pane:** Detailed calculation breakdown
- ✅ **Formulas:** Shows working/formulas used
- ✅ **Excel Download:** Button to download .xlsx file
- ✅ **Assumptions:** Lists all assumptions made

---

### 7. Scenario Simulator Mode 📈
**Purpose:** What-if analysis and stress testing

**Test Questions:**
```
"Run Monte Carlo simulation for project with 60% success probability, $1M investment"
"Sensitivity analysis: How does 10% revenue change affect profitability?"
"What-if analysis: Impact of 2% interest rate increase on loan portfolio"
"Stress test: Impact of 30% sales decline on cash flow"
```

**Expected Output:**
- ✅ **Multiple scenarios:** Best/Base/Worst cases
- ✅ **Probability distributions:** Monte Carlo results
- ✅ **Charts:** Visual representation
- ✅ **Risk metrics:** VaR, expected loss

---

### 8. Deliverable Composer Mode 📄
**Purpose:** Professional document generation

**Test Questions:**
```
"Generate a tax opinion letter for transfer pricing transaction"
"Create an audit report with findings and recommendations"
"Draft a management representation letter"
"Compose a going concern assessment memo"
```

**Expected Output:**
- ✅ **Professional format:** Proper structure
- ✅ **Letterhead placeholder:** For customization
- ✅ **Legal language:** Appropriate disclaimers
- ✅ **Export ready:** Can download as Word/PDF

---

### 9. Forensic Intelligence Mode 🔍
**Purpose:** Fraud detection and analysis

**Test Questions:**
```
"Identify red flags in accounts payable transactions"
"Benford's Law analysis for expense reports"
"Detect unusual patterns in vendor payments"
"Risk indicators for revenue manipulation"
```

**Expected Output:**
- ✅ **Risk indicators:** Red flags highlighted
- ✅ **Pattern analysis:** Statistical methods
- ✅ **Recommendations:** Follow-up actions
- ✅ **Confidence scores:** Probability of fraud

---

### 10. Roundtable Mode 👥
**Purpose:** Multi-expert discussion (Premium)

**How to Test:**
1. Navigate to `/roundtable` in browser
2. Choose a workflow:
   - **M&A Analysis**
   - **Fraud Investigation**
   - **Tax Planning**
   - **Audit Execution**
3. Click "Start Workflow"
4. Watch multi-agent execution

---

## 📥 Export Formats

### How to Export from Output Pane

1. Open any mode (calculation, audit-plan, etc.)
2. Ask a question
3. Wait for response in Output Pane
4. Click the **Export** button (top right of Output Pane)
5. Choose format:

| Format | Icon | Use Case |
|--------|------|----------|
| **TXT** | 📝 | Plain text for notes |
| **CSV** | 📊 | Data for spreadsheets |
| **DOCX** | 📄 | Word document editing |
| **PDF** | 📕 | Final professional output |
| **PPTX** | 📽️ | Presentations |
| **XLSX** | 📈 | Excel with formulas |

### Excel Export (Calculation Mode)
For calculations, Excel export includes:
- ✅ **Preserved formulas** (editable in Excel)
- ✅ **Multiple sheets** (inputs, calculations, results)
- ✅ **Charts** (if applicable)
- ✅ **Formatting** (professional look)

**Test Excel Export:**
1. Switch to **Calculation** mode
2. Ask: "Calculate loan amortization for $200,000 at 6% for 30 years"
3. Wait for response
4. Click **Download Excel** button
5. Open in Excel to verify formulas work

---

## 🔄 Testing Workflow

### Full End-to-End Test (15 minutes)

1. **Login**
   - Go to app URL
   - Login with your credentials

2. **Test Standard Mode** (1 min)
   - Ask: "What is depreciation?"
   - Verify response in chat

3. **Test Deep Research** (2 min)
   - Switch to Deep Research mode
   - Ask: "GST registration requirements in India"
   - Verify Output Pane shows citations

4. **Test Checklist** (2 min)
   - Switch to Checklist mode
   - Ask: "ITR filing checklist"
   - Verify interactive checklist appears

5. **Test Workflow** (2 min)
   - Switch to Workflow mode
   - Ask: "Purchase order approval flow"
   - Verify visual diagram appears

6. **Test Audit Plan** (2 min)
   - Switch to Audit Plan mode
   - Ask: "Audit plan for software company"
   - Verify structured document

7. **Test Calculation + Excel Export** (3 min)
   - Switch to Calculation mode
   - Ask: "NPV calculation: Initial 50000, annual 15000 for 5 years, 8% rate"
   - Verify calculation in Output Pane
   - Download Excel and verify formulas

8. **Test Document Export** (2 min)
   - From any Output Pane result
   - Export as PDF
   - Export as DOCX
   - Verify files download correctly

---

## ✅ Success Criteria

| Feature | Pass Criteria |
|---------|--------------|
| AI Response | Response within 30 seconds |
| Output Pane | Opens for professional modes |
| Calculations | Correct math, formulas shown |
| Excel Export | File downloads, formulas work |
| PDF Export | Formatted document downloads |
| Citations | Sources shown in research mode |
| Visualizations | Charts/diagrams render |

---

## 🐛 Troubleshooting

### No Response from AI
- Check Railway logs: `railway logs --tail 50`
- Verify Azure OpenAI is working
- Check for error messages in browser console

### Export Not Working
- Ensure content exists in Output Pane
- Check browser allows downloads
- Try different export format

### Slow Response
- Complex queries take longer (15-30 sec)
- Deep Research mode is naturally slower
- Check AI provider health

---

## 📞 Health Check Commands

```bash
# Check Railway logs
railway logs --tail 50

# Check deployment status
railway status

# Check environment variables
railway variables

# Redeploy if needed
railway redeploy -y
```

---

**Happy Testing! 🚀**

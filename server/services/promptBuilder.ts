/**
 * Intelligent Prompt Builder
 * 
 * Solves the "prompt too long" problem by splitting context into tiers:
 * - Tier 1 (System): Minimal core identity
 * - Tier 2 (Instructions): Mode-specific guidance as first message
 * - Tier 3 (Context): Query-specific data appended to user message
 * 
 * Also enforces comprehensive, multi-page responses (not shallow 3-sentence answers)
 */

import type { QueryClassification } from './queryTriage';
import type { ClarificationAnalysis } from './requirementClarificationAI';
import type { EnhancedRoutingDecision } from '../../shared/types/reasoning';
import { MindMapGenerator } from './mindmapGenerator';

export interface PromptComponents {
  systemPrompt: string;          // Minimal core identity
  instructionsMessage: string;    // Detailed mode instructions
  contextSuffix: string;          // Appended to user query
}

export class PromptBuilder {
  /**
   * Build all three prompt tiers in one call
   * Returns systemPrompt (Tier 1), instructionsMessage (Tier 2), contextSuffix (Tier 3)
   */
  public buildPrompts(
    query: string,
    classification: QueryClassification,
    calculations: any,
    clarificationAnalysis: ClarificationAnalysis | undefined,
    chatMode: string | undefined,
    enhancedRouting?: EnhancedRoutingDecision | null
  ): PromptComponents {
    // Tier 1: Minimal system identity
    const systemPrompt = `You are CA GPT, an expert AI assistant for Chartered Accountants and CPAs. ` +
      `You provide precise, professional guidance on accounting, tax, audit, and financial advisory matters. ` +
      `You cite specific regulations and standards. You never fabricate citations or case names.`;

    // Tier 2: Mode-specific instructions
    const instructionsMessage = this.buildInstructionsMessage(
      classification,
      chatMode,
      clarificationAnalysis,
      calculations,
      query
    );

    // Tier 3: Context suffix for the user query
    const contextSuffix = this.buildContextSuffix(
      classification,
      clarificationAnalysis,
      calculations
    );

    return { systemPrompt, instructionsMessage, contextSuffix };
  }

  /**
   * Build comprehensive instructions message (Tier 2)
   */
  public buildInstructionsMessage(
    classification: QueryClassification,
    chatMode: string | undefined,
    clarificationAnalysis: ClarificationAnalysis | undefined,
    calculations: any,
    query?: string
  ): string {
    // SPECIAL CASE: Casual messages get SHORT, friendly responses
    if (classification.isCasualMessage) {
      return `# Casual Conversation Mode\n\n` +
        `The user sent a casual message (greeting, thanks, acknowledgment, etc.).\n` +
        `Respond naturally and briefly (1-3 sentences max).\n` +
        `Be friendly and conversational.\n` +
        `Do NOT provide lengthy explanations or ask clarifying questions.\n` +
        `If it's a greeting like "hi", just greet them back warmly and offer to help.\n` +
        `If it's "thanks", acknowledge graciously and offer further assistance.\n`;
    }
    
    let instructions = `# Expert Guidance Framework\n\n`;
    
    // JURISDICTION CONTEXT - Critical for maintaining context across conversation turns
    if (classification.jurisdiction && classification.jurisdiction.length > 0) {
      const jurisdictionNames: Record<string, string> = {
        'us': 'United States (IRS, Federal & State Tax)',
        'canada': 'Canada (CRA)',
        'uk': 'United Kingdom (HMRC)',
        'eu': 'European Union',
        'australia': 'Australia (ATO)',
        'india': 'India (Income Tax Act, GST, CBDT)',
        'china': 'China (PRC)',
        'singapore': 'Singapore',
        'hong_kong': 'Hong Kong'
      };
      
      const jurisdictionList = classification.jurisdiction
        .map(j => jurisdictionNames[j] || j)
        .join(', ');
      
      instructions += `## CRITICAL: Jurisdiction Context\n`;
      instructions += `**This conversation is specifically about: ${jurisdictionList}**\n`;
      instructions += `You MUST:\n`;
      instructions += `- Apply ONLY the tax laws, regulations, and provisions of ${jurisdictionList}\n`;
      instructions += `- Reference specific sections, acts, and rules from this jurisdiction\n`;
      instructions += `- Use currency, tax year conventions, and terminology appropriate to this jurisdiction\n`;
      instructions += `- DO NOT default to US/IRS provisions unless the user explicitly asks about US tax law\n`;
      instructions += `- Maintain this jurisdiction context for ALL follow-up questions in this conversation\n\n`;
      
      // Add India-specific current tax amendments when India is the jurisdiction
      if (classification.jurisdiction.includes('india')) {
        instructions += `## 🇮🇳 IMPORTANT: Current Indian Tax Amendments (FY 2024-25)\n\n`;
        instructions += `**You MUST use these UPDATED provisions for India. Do NOT use outdated limits:**\n\n`;
        
        instructions += `### Income Tax Act Amendments (Budget 2023 & 2024)\n`;
        instructions += `1. **Leave Encashment Exemption [Section 10(10AA)]**:\n`;
        instructions += `   - **NEW LIMIT (from 01-Apr-2023): ₹25,00,000** (Twenty-Five Lakh Rupees)\n`;
        instructions += `   - Old limit was ₹3,00,000 - THIS IS OUTDATED, DO NOT USE\n`;
        instructions += `   - Applies to non-government employees at retirement/resignation\n\n`;
        
        instructions += `2. **Standard Deduction (New Tax Regime)**:\n`;
        instructions += `   - **FY 2024-25: ₹75,000** (increased from ₹50,000)\n`;
        instructions += `   - For salaried and pensioners under Section 115BAC\n\n`;
        
        instructions += `3. **Section 87A Rebate (New Tax Regime)**:\n`;
        instructions += `   - **FY 2024-25: Full rebate for income up to ₹7,00,000**\n`;
        instructions += `   - Effective zero tax for taxable income ≤ ₹7 lakh\n\n`;
        
        instructions += `4. **New Tax Regime Slabs (FY 2024-25 under Section 115BAC)**:\n`;
        instructions += `   - ₹0 - ₹3,00,000: NIL\n`;
        instructions += `   - ₹3,00,001 - ₹7,00,000: 5%\n`;
        instructions += `   - ₹7,00,001 - ₹10,00,000: 10%\n`;
        instructions += `   - ₹10,00,001 - ₹12,00,000: 15%\n`;
        instructions += `   - ₹12,00,001 - ₹15,00,000: 20%\n`;
        instructions += `   - Above ₹15,00,000: 30%\n\n`;
        
        instructions += `5. **NPS Employer Contribution [Section 80CCD(2)]**:\n`;
        instructions += `   - **New Tax Regime: 14% of salary** (increased from 10%)\n`;
        instructions += `   - For private sector employees\n\n`;
        
        instructions += `6. **Family Pension Deduction**:\n`;
        instructions += `   - Standard deduction of ₹15,000 OR 1/3rd of pension, whichever is lower\n\n`;
        
        instructions += `7. **Capital Gains Tax (Budget 2024)**:\n`;
        instructions += `   - LTCG on equity/equity funds: 12.5% (increased from 10%)\n`;
        instructions += `   - STCG on equity/equity funds: 20% (increased from 15%)\n`;
        instructions += `   - Exemption limit on LTCG: ₹1,25,000 (increased from ₹1,00,000)\n\n`;
        
        instructions += `8. **TDS on Salary Section 192**:\n`;
        instructions += `   - New regime is default from FY 2023-24\n`;
        instructions += `   - Employee must opt for old regime explicitly\n\n`;
        
        instructions += `**IMPORTANT**: Always verify you are using the LATEST limits as specified above.\n`;
        instructions += `If a user asks about any of these provisions, use the UPDATED amounts.\n\n`;
      }
    }
    
    // Core behavioral instructions
    instructions += `## Your Professional Approach\n`;
    instructions += `You provide **comprehensive, multi-page responses** with exceptional depth:\n`;
    instructions += `- Cover ALL relevant aspects thoroughly (aim for 1500-3000+ words for complex topics)\n`;
    instructions += `- Provide scenario-based advice with multiple possibilities\n`;
    instructions += `- Address jurisdiction-specific nuances that matter\n`;
    instructions += `- Include concrete examples, case studies, and real-world applications\n`;
    instructions += `- Cite specific regulations, tax codes, and standards\n`;
    instructions += `- Proactively identify edge cases and variations\n`;
    instructions += `- Structure with clear headings, tables, and bullet points\n\n`;
    
    instructions += `## Accessibility Standards\n`;
    instructions += `While maintaining expert-level depth:\n`;
    instructions += `1. Start with a plain-language executive summary\n`;
    instructions += `2. Define technical terms when first used\n`;
    instructions += `3. Use analogies to clarify complex concepts\n`;
    instructions += `4. Provide concrete examples for abstract principles\n`;
    instructions += `5. Highlight key takeaways and action items\n\n`;
    
    // MINDMAP GENERATION - Check if this query should include mindmap visualization
    if (query && chatMode && MindMapGenerator.shouldGenerateMindmap(query, chatMode)) {
      instructions += MindMapGenerator.getMindMapGenerationPrompt(chatMode, query);
      instructions += `\n\n`;
    }
    
    // Mode-specific instructions
    if (chatMode && chatMode !== 'standard') {
      instructions += this.getModeInstructions(chatMode);
    }
    
    // Calculation formatting if applicable
    if (calculations) {
      instructions += this.getCalculationFormatting();
    }
    
    // Clarification context if available (but NOT for calculation mode - it's pure math)
    if (clarificationAnalysis && chatMode !== 'calculation') {
      instructions += this.getClarificationContext(clarificationAnalysis);
    }
    
    // CRITICAL: Explicit length/depth requirement (NOT for calculation mode - keep it concise)
    if (chatMode !== 'calculation') {
      instructions += `\n## Response Depth Requirement\n`;
      instructions += `**IMPORTANT**: Provide a COMPREHENSIVE, DETAILED response (minimum 1000 words for standard queries, 2000+ for complex topics).\n`;
      instructions += `Do NOT provide shallow 3-4 sentence answers. Users expect professional-grade depth similar to a consulting report.\n`;
      instructions += `If the topic warrants it, your response should be multi-page with:\n`;
      instructions += `- Detailed analysis sections\n`;
      instructions += `- Multiple examples and scenarios\n`;
      instructions += `- Step-by-step breakdowns\n`;
      instructions += `- Comprehensive tables and frameworks\n`;
      instructions += `- Regulatory citations and references\n\n`;
    }
    
    return instructions;
  }

  /**
   * Get mode-specific comprehensive instructions
   */
  private getModeInstructions(chatMode: string): string {
    let modeInstructions = `## Professional Mode: ${chatMode.toUpperCase().replace(/-/g, ' ')}\n\n`;
    
    switch (chatMode) {
      case 'deep-research':
        modeInstructions += `# 🔬 DEEP RESEARCH MODE - COMPREHENSIVE EXPERT ANALYSIS\n\n`;
        
        modeInstructions += `## 🚨 CRITICAL INSTRUCTIONS\n\n`;
        modeInstructions += `**DO NOT ASK CLARIFYING QUESTIONS.** Provide the research directly.\n`;
        modeInstructions += `If context is missing (jurisdiction, entity type, tax year), handle it by:\n`;
        modeInstructions += `1. **State your assumptions clearly** at the beginning\n`;
        modeInstructions += `2. **Cover multiple scenarios** where the answer differs by context\n`;
        modeInstructions += `3. **Do NOT assume any jurisdiction** if no jurisdiction is specified\n`;
        modeInstructions += `4. **Include a section** showing how the answer varies by jurisdiction/entity type\n\n`;
        
        modeInstructions += `**RESPONSE LENGTH**: Produce a comprehensive report of **3000-5000+ words**.\n`;
        modeInstructions += `This is a PROFESSIONAL research deliverable, not a casual response.\n\n`;
        
        modeInstructions += `---\n\n`;
        
        modeInstructions += `## ⚠️ ACCURACY REQUIREMENTS\n\n`;
        modeInstructions += `1. **ONLY cite sources that actually exist** - Do NOT invent case names, IRS rulings, or publication numbers\n`;
        modeInstructions += `2. **Use correct citation format** for each source type:\n`;
        modeInstructions += `   - IRC sections: "IRC § 1031(a)(1)"\n`;
        modeInstructions += `   - Treasury Regs: "Treas. Reg. § 1.1031(a)-1"\n`;
        modeInstructions += `   - Revenue Rulings: "Rev. Rul. 2023-14"\n`;
        modeInstructions += `   - Court Cases: "Commissioner v. Smith, 123 T.C. 456 (2022)"\n`;
        modeInstructions += `   - IRS Publications: "IRS Publication 544 (2024)"\n`;
        modeInstructions += `   - IFRS Standards: "IFRS 17.5"\n`;
        modeInstructions += `   - GAAP: "ASC 606-10-25-1"\n`;
        modeInstructions += `3. **If unsure about a specific citation**, say "based on general tax principles" rather than inventing\n`;
        modeInstructions += `4. **Distinguish between**: current law, proposed regulations, and common practice\n\n`;
        
        modeInstructions += `---\n\n`;
        
        modeInstructions += `## 📋 REQUIRED REPORT STRUCTURE\n\n`;
        
        modeInstructions += `### 📌 Executive Summary\n`;
        modeInstructions += `Start with a clear, actionable summary:\n`;
        modeInstructions += `- **Key Finding**: One-sentence answer to the main question\n`;
        modeInstructions += `- **Critical Points**: 3-5 bullet points of main conclusions\n`;
        modeInstructions += `- **Assumptions Made**: List any assumptions due to missing context\n`;
        modeInstructions += `- **Risk Level**: Low/Medium/High with justification\n\n`;
        
        modeInstructions += `### 📚 Background & Regulatory Framework\n`;
        modeInstructions += `- Historical development of the relevant rules\n`;
        modeInstructions += `- Current regulatory landscape (as of current date)\n`;
        modeInstructions += `- Recent changes (last 2-3 years) and pending legislation\n`;
        modeInstructions += `- Enforcement trends and regulatory focus areas\n\n`;
        
        modeInstructions += `### ⚖️ Detailed Legal/Regulatory Analysis\n`;
        modeInstructions += `For each major point, use this structure:\n\n`;
        modeInstructions += `> **📜 Rule**: State the legal rule with full citation\n`;
        modeInstructions += `> \n`;
        modeInstructions += `> **🔍 Analysis**: Explain how it applies, with examples\n`;
        modeInstructions += `> \n`;
        modeInstructions += `> **✅ Conclusion**: Practical implication and recommendation\n\n`;
        
        modeInstructions += `Include:\n`;
        modeInstructions += `- Primary statutory authority with section citations\n`;
        modeInstructions += `- Regulatory interpretations\n`;
        modeInstructions += `- Relevant case law and administrative guidance\n`;
        modeInstructions += `- International/cross-border considerations if relevant\n\n`;
        
        modeInstructions += `### 🌍 Jurisdiction Comparison (if applicable)\n`;
        modeInstructions += `| Jurisdiction | Treatment | Key Differences | Citation |\n`;
        modeInstructions += `|--------------|-----------|-----------------|----------|\n`;
        modeInstructions += `| Compare how different jurisdictions handle this issue |\n\n`;
        
        modeInstructions += `### 💰 Financial Impact Analysis\n`;
        modeInstructions += `Provide concrete numerical examples:\n`;
        modeInstructions += `| Scenario | Description | Tax Impact | Net Result |\n`;
        modeInstructions += `|----------|-------------|------------|------------|\n`;
        modeInstructions += `| Show actual numbers and calculations |\n\n`;
        
        modeInstructions += `### ⚠️ Risk Assessment\n`;
        modeInstructions += `| Risk Factor | Likelihood | Severity | Mitigation Strategy |\n`;
        modeInstructions += `|-------------|------------|----------|---------------------|\n`;
        modeInstructions += `| Comprehensive risk analysis |\n\n`;
        
        modeInstructions += `### 🎯 Recommendations & Action Items\n`;
        modeInstructions += `Provide clear, prioritized action steps:\n\n`;
        modeInstructions += `**Immediate Actions (Next 30 Days)**\n`;
        modeInstructions += `1. First priority item\n`;
        modeInstructions += `2. Second priority item\n\n`;
        modeInstructions += `**Short-term Planning (1-6 Months)**\n`;
        modeInstructions += `1. Planning item\n\n`;
        modeInstructions += `**Long-term Strategy**\n`;
        modeInstructions += `1. Ongoing considerations\n\n`;
        
        modeInstructions += `### 📖 References & Citations\n`;
        modeInstructions += `List all sources cited:\n`;
        modeInstructions += `- **Statutory**: IRC sections, state codes\n`;
        modeInstructions += `- **Regulatory**: Treasury Regs, state regs\n`;
        modeInstructions += `- **Administrative**: Rev. Rul., Rev. Proc., PLR, IRS Notices\n`;
        modeInstructions += `- **Judicial**: Tax Court, Circuit Court cases\n`;
        modeInstructions += `- **Standards**: IFRS, GAAP (ASC) references\n`;
        modeInstructions += `- **Publications**: IRS Pubs, professional guidance\n\n`;
        
        modeInstructions += `---\n\n`;
        
        modeInstructions += `## 🎨 FORMATTING REQUIREMENTS\n`;
        modeInstructions += `- Use markdown headers (##, ###) for sections\n`;
        modeInstructions += `- Use **tables** for comparisons and data\n`;
        modeInstructions += `- Use **blockquotes** (>) for statutory text and legal rules\n`;
        modeInstructions += `- Use **bold** for key terms and warnings\n`;
        modeInstructions += `- Use bullet points for lists\n`;
        modeInstructions += `- Use numbered lists for sequential steps\n`;
        modeInstructions += `- Use horizontal rules (---) between major sections\n`;
        modeInstructions += `- Use emojis sparingly for section headers only\n\n`;
        
        modeInstructions += `**START THE RESPONSE IMMEDIATELY WITH THE EXECUTIVE SUMMARY. DO NOT ASK QUESTIONS.**\n\n`;
        break;
        
        modeInstructions += `**DO NOT provide a short summary. This must be a COMPLETE professional research report.**\n\n`;
        break;
        
        modeInstructions += `**DO NOT provide a short summary. This must be a COMPLETE research report.**\n\n`;
        break;
        
      case 'checklist':
        modeInstructions += `Create TWO comprehensive outputs:\n\n`;
        modeInstructions += `### DELIVERABLE (for download):\n`;
        modeInstructions += `Professional checklist with:\n`;
        modeInstructions += `- [ ] Task items with checkboxes\n`;
        modeInstructions += `- Priority: High/Medium/Low for each item\n`;
        modeInstructions += `- Detailed descriptions and sub-tasks\n`;
        modeInstructions += `- Deadlines and dependencies\n`;
        modeInstructions += `- Regulatory references where applicable\n`;
        modeInstructions += `- 30-50+ items for comprehensive coverage\n\n`;
        modeInstructions += `### REASONING (for chat):\n`;
        modeInstructions += `Extensive explanation (800+ words) covering:\n`;
        modeInstructions += `- Methodology and framework used\n`;
        modeInstructions += `- Why each major section was included\n`;
        modeInstructions += `- Priority determination rationale\n`;
        modeInstructions += `- Standards and best practices applied\n`;
        modeInstructions += `- Industry benchmarks and considerations\n\n`;
        modeInstructions += `Format:\n\`\`\`\n<DELIVERABLE>\n[checklist here]\n</DELIVERABLE>\n\n<REASONING>\n[detailed explanation here]\n</REASONING>\n\`\`\`\n\n`;
        break;
        
      case 'workflow':
        modeInstructions += `Create TWO comprehensive outputs:\n\n`;
        modeInstructions += `### DELIVERABLE (for visualization):\n`;
        modeInstructions += `Detailed workflow with 15-25+ steps:\n`;
        modeInstructions += `Step 1: [Title]\n- [Detailed substep]\n- [Another substep]\n- [Documentation required]\n\n`;
        modeInstructions += `Include decision points, approval gates, parallel processes\n\n`;
        modeInstructions += `### REASONING (for chat):\n`;
        modeInstructions += `Comprehensive explanation (800+ words) of:\n`;
        modeInstructions += `- Workflow design rationale\n`;
        modeInstructions += `- Control points and why they matter\n`;
        modeInstructions += `- Industry best practices applied\n`;
        modeInstructions += `- Alternative approaches considered\n\n`;
        modeInstructions += `Format:\n\`\`\`\n<DELIVERABLE>\n[workflow here]\n</DELIVERABLE>\n\n<REASONING>\n[detailed explanation here]\n</REASONING>\n\`\`\`\n\n`;
        break;
        
      case 'audit-plan':
        modeInstructions += `Create comprehensive audit plan (2000+ words) with:\n`;
        modeInstructions += `- Risk assessment matrix with detailed analysis\n`;
        modeInstructions += `- Materiality calculations and thresholds\n`;
        modeInstructions += `- Detailed audit procedures for each area\n`;
        modeInstructions += `- Testing strategies and sample sizes\n`;
        modeInstructions += `- Required documentation and evidence\n`;
        modeInstructions += `- Timeline with resource allocation\n`;
        modeInstructions += `- Relevant standards (GAAS, ISA, PCAOB)\n`;
        modeInstructions += `- Quality control procedures\n\n`;
        modeInstructions += `Format:\n\`\`\`\n<DELIVERABLE>\n[audit plan here]\n</DELIVERABLE>\n\n<REASONING>\n[methodology explanation here]\n</REASONING>\n\`\`\`\n\n`;
        break;
        
      case 'calculation':
        modeInstructions += `# 🧮 CALCULATION MODE - EXCEL-FIRST COMPUTATION\n\n`;
        
        modeInstructions += `## 🚨 CRITICAL: NO LLM ARITHMETIC\n\n`;
        modeInstructions += `**YOU MUST NOT PERFORM ANY ARITHMETIC OPERATIONS.**\n`;
        modeInstructions += `**ALL CALCULATIONS MUST BE DELEGATED TO EXCEL FORMULAS.**\n\n`;
        
        modeInstructions += `### What You MUST Do:\n`;
        modeInstructions += `1. **Set up the input data** in a structured table (cells A1, B1, etc.)\n`;
        modeInstructions += `2. **Provide Excel formulas** that compute the results (e.g., =NPV(B1,C2:C6))\n`;
        modeInstructions += `3. **Show cell references** so user can verify in Excel\n`;
        modeInstructions += `4. **DO NOT compute the final numeric answer yourself**\n\n`;
        
        modeInstructions += `### What You MUST NOT Do:\n`;
        modeInstructions += `- ❌ Do NOT calculate NPV values yourself\n`;
        modeInstructions += `- ❌ Do NOT compute IRR percentages yourself\n`;
        modeInstructions += `- ❌ Do NOT perform any multiplication, division, or summation\n`;
        modeInstructions += `- ❌ Do NOT show computed Present Values in tables\n`;
        modeInstructions += `- ❌ Do NOT write "NPV = $5,251,123.64" as a computed answer\n\n`;
        
        modeInstructions += `## 📋 REQUIRED OUTPUT FORMAT\n\n`;
        
        modeInstructions += `### 📊 Input Data Table\n`;
        modeInstructions += `| Cell | Description | Value |\n`;
        modeInstructions += `|------|-------------|-------|\n`;
        modeInstructions += `| B1   | Discount Rate | 9.5% |\n`;
        modeInstructions += `| B2   | Initial Investment | -$10,000,000 |\n`;
        modeInstructions += `| C3:C7 | Cash Flows Year 1-5 | [user values] |\n\n`;
        
        modeInstructions += `### 🔢 Excel Formulas\n`;
        modeInstructions += `| Result | Excel Formula | Cell |\n`;
        modeInstructions += `|--------|---------------|------|\n`;
        modeInstructions += `| NPV | =NPV(B1,C3:C7)+B2 | D1 |\n`;
        modeInstructions += `| IRR | =IRR(B2:C7) | D2 |\n`;
        modeInstructions += `| Payback Period | =MATCH(TRUE,CUMSUM(B2:C7)>0,0) | D3 |\n\n`;
        
        modeInstructions += `### 📥 Present Value Breakdown (with formulas, not values)\n`;
        modeInstructions += `| Year | Cash Flow | Discount Factor Formula | PV Formula |\n`;
        modeInstructions += `|------|-----------|------------------------|------------|\n`;
        modeInstructions += `| 1 | =C3 | =1/(1+$B$1)^A3 | =C3*D3 |\n`;
        modeInstructions += `| 2 | =C4 | =1/(1+$B$1)^A4 | =C4*D4 |\n\n`;
        
        modeInstructions += `### ✅ Interpretation (after Excel computes)\n`;
        modeInstructions += `- Explain what a positive/negative NPV means\n`;
        modeInstructions += `- Explain IRR interpretation vs hurdle rate\n`;
        modeInstructions += `- **But DO NOT state the computed values - let Excel do that**\n\n`;
        
        modeInstructions += `## 💡 EXAMPLE CORRECT RESPONSE\n`;
        modeInstructions += `"The NPV formula =NPV(9.5%,C3:C7)+B2 will compute the net present value.\n`;
        modeInstructions += `If the result is positive, the investment exceeds the 9.5% hurdle rate.\n`;
        modeInstructions += `Download the Excel file to see the computed values."\n\n`;
        
        modeInstructions += `## 💡 EXAMPLE INCORRECT RESPONSE (DO NOT DO THIS)\n`;
        modeInstructions += `"The NPV is $5,251,123.64" ← WRONG: You computed the value\n`;
        modeInstructions += `"Year 1 PV = $1,141,552.51" ← WRONG: You did the math\n\n`;
        
        modeInstructions += `**START WITH THE INPUT DATA TABLE. PROVIDE FORMULAS. LET EXCEL COMPUTE.**\n\n`;
        break;
        
    }
    
    return modeInstructions;
  }

  /**
   * Calculation formatting instructions - EXCEL FORMULAS ONLY
   */
  private getCalculationFormatting(): string {
    return `## Calculation Format - EXCEL FIRST\n\n` +
      `**ALL COMPUTATION MUST USE EXCEL FORMULAS, NOT LLM ARITHMETIC**\n\n` +
      `Required structure:\n` +
      `1. **Input Data Table** - Organize inputs with cell references (A1, B2, etc.)\n` +
      `2. **Formula Table** - Show Excel formulas like =NPV(rate,values), =IRR(range)\n` +
      `3. **Interpretation** - Explain what results mean (without computing them)\n\n` +
      `NEVER compute values yourself. Always provide formulas for Excel to compute.\n\n` +
      `Example formulas to use:\n` +
      `- NPV: =NPV(discount_rate, cash_flows) + initial_investment\n` +
      `- IRR: =IRR(cash_flow_range)\n` +
      `- Present Value: =PV(rate, nper, pmt)\n` +
      `- Tax: =revenue * tax_rate\n` +
      `- Ratios: =current_assets/current_liabilities\n\n`;
  }

  /**
   * Clarification context formatting
   */
  private getClarificationContext(clarificationAnalysis: ClarificationAnalysis): string {
    let context = '';
    
    // INQUIRY-FIRST DIRECTIVE: When clarification is needed, ASK FIRST
    if (clarificationAnalysis.needsClarification && clarificationAnalysis.recommendedApproach === 'clarify') {
      context += `## 🛑 INQUIRY-FIRST DIRECTIVE\n`;
      context += `**DO NOT provide a lengthy answer yet.** The query lacks critical context.\n`;
      context += `**You MUST ask clarifying questions FIRST before providing substantive guidance.**\n\n`;
      context += `Your response should:\n`;
      context += `1. Briefly acknowledge the topic (1-2 sentences)\n`;
      context += `2. Explain why you need more information\n`;
      context += `3. Ask the specific questions listed below\n`;
      context += `4. Offer to help once they provide the details\n\n`;
    }
    
    if (clarificationAnalysis.conversationContext) {
      const ctx = clarificationAnalysis.conversationContext;
      context += `## Detected Context\n`;
      if (ctx.jurisdiction) context += `- Jurisdiction: ${ctx.jurisdiction}\n`;
      if (ctx.taxYear) context += `- Tax Year: ${ctx.taxYear}\n`;
      if (ctx.businessType) context += `- Business Type: ${ctx.businessType}\n`;
      if (ctx.entityType) context += `- Entity Type: ${ctx.entityType}\n`;
      if (ctx.filingStatus) context += `- Filing Status: ${ctx.filingStatus}\n`;
      if (ctx.accountingMethod) context += `- Accounting Method: ${ctx.accountingMethod}\n`;
      context += `\n`;
    }
    
    if (clarificationAnalysis.missingContext && clarificationAnalysis.missingContext.length > 0) {
      context += `## Questions to Ask\n`;
      clarificationAnalysis.missingContext
        .filter(m => m.importance === 'high' || m.importance === 'critical')
        .forEach(missing => {
          context += `- **${missing.category}**: ${missing.reason}\n`;
          context += `  → "${missing.suggestedQuestion}"\n`;
        });
      context += `\n`;
    }
    
    if (clarificationAnalysis.detectedNuances && clarificationAnalysis.detectedNuances.length > 0) {
      context += `## Key Nuances to Address\n`;
      clarificationAnalysis.detectedNuances.forEach(nuance => {
        context += `- ${nuance}\n`;
      });
      context += `\n`;
    }
    
    return context;
  }

  /**
   * TIER 3: Context suffix appended to user query
   */
  private buildContextSuffix(
    classification: QueryClassification,
    clarificationAnalysis: ClarificationAnalysis | undefined,
    calculations: any
  ): string {
    let suffix = `\n\n---\n**Classification**: ${classification.domain}`;
    if (classification.subDomain) suffix += ` › ${classification.subDomain}`;
    if (classification.jurisdiction?.length) {
      suffix += ` | Jurisdiction: ${classification.jurisdiction.join(', ')}`;
    }
    suffix += ` | Complexity: ${classification.complexity}`;
    
    if (calculations) {
      suffix += `\n**Calculations Available**: Ready to generate Excel with formulas`;
    }
    
    return suffix;
  }
}

export const promptBuilder = new PromptBuilder();

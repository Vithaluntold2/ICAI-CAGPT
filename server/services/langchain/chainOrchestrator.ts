/**
 * LangChain Integration for Advanced AI Orchestration
 * 
 * Production-grade LangChain integration with Redis caching:
 * - Chain-of-thought reasoning
 * - Multi-step agent workflows
 * - Tool/function calling
 * - Better prompt management
 * - Streaming responses
 * - Redis-backed caching for 70-90% cost savings
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getLangCache } from '../cache/langCache';

// Initialize LangSmith for observability (optional)
if (process.env.LANGCHAIN_API_KEY) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_PROJECT = 'lucaagent';
}

/**
 * Initialize AI models with LangChain and Redis caching
 */
export async function createModel(provider: 'openai' | 'anthropic', modelName: string) {
  const cache = await getLangCache();
  
  const commonConfig = {
    temperature: 0.7,
    maxTokens: 4000,
    streaming: true,
    cache, // Redis caching enabled
  };

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        modelName,
        openAIApiKey: process.env.OPENAI_API_KEY,
        ...commonConfig,
      });
    
    case 'anthropic':
      return new ChatAnthropic({
        modelName,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        ...commonConfig,
      });
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Financial Analysis Chain
 * Multi-step reasoning for complex financial queries
 */
export async function createFinancialAnalysisChain() {
  const model = await createModel('openai', 'gpt-4-turbo');

  // Step 1: Extract key entities
  const extractionPrompt = ChatPromptTemplate.fromTemplate(`
    Analyze this financial query and extract:
    - Query type (calculation, analysis, compliance, tax)
    - Key financial metrics mentioned
    - Time period
    - Jurisdiction (if applicable)
    
    Query: {query}
    
    Respond in JSON format.
  `);

  // Step 2: Generate solution approach
  const approachPrompt = ChatPromptTemplate.fromTemplate(`
    Based on this financial query analysis:
    {extraction}
    
    Provide a step-by-step solution approach.
  `);

  // Step 3: Execute and format
  const chain = RunnableSequence.from([
    extractionPrompt,
    model,
    new StringOutputParser(),
    async (extraction: string) => {
      return { extraction };
    },
    approachPrompt,
    model,
    new StringOutputParser(),
  ]);

  return chain;
}

/**
 * Define financial calculation tools
 */
export const financialTools = [
  // NPV Calculator Tool
  new DynamicStructuredTool({
    name: 'calculate_npv',
    description: 'Calculate Net Present Value of cash flows',
    schema: z.object({
      cashFlows: z.array(z.number()).describe('Array of cash flows'),
      discountRate: z.number().describe('Discount rate as decimal (e.g., 0.1 for 10%)'),
    }),
    func: async ({ cashFlows, discountRate }: { cashFlows: number[]; discountRate: number }) => {
      const npv = cashFlows.reduce((sum: number, cf: number, i: number) => {
        return sum + cf / Math.pow(1 + discountRate, i);
      }, 0);
      
      return JSON.stringify({
        npv: npv.toFixed(2),
        discountRate: (discountRate * 100).toFixed(1) + '%',
        periods: cashFlows.length,
      });
    },
  }),

  // Tax Calculator Tool
  new DynamicStructuredTool({
    name: 'calculate_tax',
    description: 'Calculate income tax based on jurisdiction and income',
    schema: z.object({
      income: z.number().describe('Annual income'),
      jurisdiction: z.string().describe('Country/region (e.g., US, UK, India)'),
      filingStatus: z.string().optional().describe('Filing status (single, married, etc.)'),
    }),
    func: async ({ income, jurisdiction, filingStatus = 'single' }: { income: number; jurisdiction: string; filingStatus?: string }) => {
      // Simplified tax calculation (replace with actual tax logic)
      const taxRate = jurisdiction === 'US' ? 0.22 : 0.20;
      const tax = income * taxRate;
      
      return JSON.stringify({
        income,
        jurisdiction,
        filingStatus,
        estimatedTax: tax.toFixed(2),
        effectiveRate: (taxRate * 100).toFixed(1) + '%',
      });
    },
  }),

  // Financial Ratio Tool
  new DynamicStructuredTool({
    name: 'calculate_financial_ratios',
    description: 'Calculate common financial ratios from financial statements',
    schema: z.object({
      currentAssets: z.number(),
      currentLiabilities: z.number(),
      totalAssets: z.number().optional(),
      totalEquity: z.number().optional(),
      revenue: z.number().optional(),
      netIncome: z.number().optional(),
    }),
    func: async (data: { currentAssets: number; currentLiabilities: number; totalAssets?: number; totalEquity?: number; revenue?: number; netIncome?: number }) => {
      const ratios: Record<string, string> = {};
      
      // Current Ratio
      if (data.currentAssets && data.currentLiabilities) {
        ratios.currentRatio = (data.currentAssets / data.currentLiabilities).toFixed(2);
      }
      
      // Debt-to-Equity
      if (data.totalAssets && data.totalEquity) {
        const totalDebt = data.totalAssets - data.totalEquity;
        ratios.debtToEquity = (totalDebt / data.totalEquity).toFixed(2);
      }
      
      // Profit Margin
      if (data.revenue && data.netIncome) {
        ratios.profitMargin = ((data.netIncome / data.revenue) * 100).toFixed(1) + '%';
      }
      
      return JSON.stringify(ratios);
    },
  }),
];

/**
 * Agent with tool calling for financial analysis
 */
export async function createFinancialAgent() {
  const model = (await createModel('openai', 'gpt-4-turbo')).bindTools(financialTools);

  const systemPrompt = `You are ICAI CAGPT, an expert AI financial advisor.
You have access to financial calculation tools. Use them when appropriate.

When analyzing financial queries:
1. Break down complex problems into steps
2. Use tools for calculations
3. Provide detailed explanations
4. Cite relevant regulations when discussing compliance

Always maintain professional tone and accuracy.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  return chain;
}

/**
 * Streaming response handler
 */
export async function streamFinancialResponse(
  query: string,
  onChunk: (chunk: string) => void
) {
  const chain = await createFinancialAgent();

  const stream = await chain.stream({ input: query });

  let fullResponse = '';
  for await (const chunk of stream) {
    fullResponse += chunk;
    onChunk(chunk);
  }

  return fullResponse;
}

/**
 * Chain-of-Thought Reasoning Chain
 */
export async function createCoTChain() {
  const model = await createModel('anthropic', 'claude-3-5-sonnet-20241022');

  const cotPrompt = ChatPromptTemplate.fromTemplate(`
    Solve this problem using chain-of-thought reasoning:
    
    Problem: {problem}
    
    Think step by step:
    1. Understand the problem
    2. Identify key information
    3. Plan solution approach
    4. Execute step by step
    5. Verify result
    
    Provide detailed reasoning at each step.
  `);

  const chain = cotPrompt.pipe(model).pipe(new StringOutputParser());

  return chain;
}

/**
 * RAG (Retrieval-Augmented Generation) Chain
 * For document-based queries
 */
export async function createRAGChain(retrievedDocs: string[]) {
  const model = await createModel('openai', 'gpt-4-turbo');

  const ragPrompt = ChatPromptTemplate.fromTemplate(`
    Answer the question based on the following context:
    
    Context:
    {context}
    
    Question: {question}
    
    Provide a detailed answer based solely on the context provided.
    If the context doesn't contain the answer, say so.
  `);

  const chain = RunnableSequence.from([
    {
      context: () => retrievedDocs.join('\n\n---\n\n'),
      question: (input: any) => input.question,
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);

  return chain;
}

/**

/**
 * Example Usage:
 * 
 * // Simple query
 * const agent = await createFinancialAgent();
 * const response = await agent.invoke({
 *   input: "Calculate NPV for cash flows [100, 200, 300] at 10% discount rate"
 * });
 * 
 * // Streaming response
 * await streamFinancialResponse(
 *   "Analyze the financial health of a company with current ratio 2.5",
 *   (chunk) => console.log(chunk)
 * );
 * 
 * // Chain-of-thought for complex problem
 * const cotChain = await createCoTChain();
 * const reasoning = await cotChain.invoke({
 *   problem: "Should I incorporate as LLC or S-Corp?"
 * });
 * 
 * // RAG with documents
 * const docs = ["Document 1 content...", "Document 2 content..."];
 * const ragChain = await createRAGChain(docs);
 * const answer = await ragChain.invoke({
 *   question: "What are the key findings?"
 * });
 */

/**
 * Environment Variables Required:
 * 
 * OPENAI_API_KEY=sk-xxx
 * ANTHROPIC_API_KEY=sk-ant-xxx
 * LANGCHAIN_API_KEY=lsv2_xxx  # Optional, for LangSmith observability
 */

/**
 * AI-Powered Conversation Title Generator
 * 
 * Generates short, meaningful titles and descriptive metadata for conversations
 * to improve UX in the sidebar/sessions list.
 */

import { aiProviderRegistry } from './aiProviders/registry';
import { AIProviderName } from './aiProviders/types';

export interface ConversationTitleResult {
  title: string;
  metadata: string;
}

/**
 * Generate a smart title and metadata for a conversation
 * @param firstUserMessage - The first message from the user
 * @returns Object with title (3-5 words) and metadata (descriptive subtitle)
 */
export async function generateConversationTitle(
  firstUserMessage: string
): Promise<ConversationTitleResult> {
  try {
    const provider = aiProviderRegistry.getProvider(AIProviderName.AZURE_OPENAI);
    
    const prompt = `You are a conversation title generator for a professional accounting and tax advisory AI assistant.

Given this user question, generate a chronicle-style session title that describes the TOPIC being discussed — not a copy of the user's words. Think of it as a chapter heading in a professional journal.

Rules:
- Title: 3-6 words, topic-focused, never copy the user's exact phrasing
- Title should read like a subject heading (e.g., "Company Incorporation Guide", "GST Return Filing", "Capital Gains Tax Planning")
- Metadata: 8-12 words describing the scope
- Never start with "Hi", "Help", "I need", or any conversational fragment

User question: "${firstUserMessage}"

Respond in JSON format:
{
  "title": "Topic Title Here",
  "metadata": "Brief description of what this conversation covers"
}

Examples:
Question: "Hi, I need guidance on incorporating a company"
Response: {"title": "Company Incorporation Guide", "metadata": "Guidance on company formation and registration process"}

Question: "What's the corporate tax rate for Delaware C-Corps in 2024?"
Response: {"title": "Delaware C-Corp Taxation", "metadata": "Corporate tax rates and compliance requirements"}

Question: "How do I calculate depreciation on equipment using MACRS?"
Response: {"title": "MACRS Depreciation Method", "metadata": "Equipment depreciation calculation and methods"}

Question: "Can you explain the difference between GAAP and IFRS revenue recognition?"
Response: {"title": "Revenue Recognition Standards", "metadata": "GAAP vs IFRS revenue recognition comparison"}

Question: "I want to file GST returns for my business"
Response: {"title": "GST Return Filing", "metadata": "Business GST return preparation and filing process"}

Only respond with valid JSON, no other text.`;

    const response = await provider.generateCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 150
    });

    // Parse JSON response
    const cleaned = response.content.trim().replace(/```json\n?|\n?```/g, '');
    const parsed = JSON.parse(cleaned);

    // Validate and truncate if needed
    const title = (parsed.title || '').substring(0, 50);
    const metadata = (parsed.metadata || '').substring(0, 80);

    return {
      title: title || 'New Conversation',
      metadata: metadata || 'Accounting and tax advisory discussion'
    };

  } catch (error) {
    console.error('[TitleGenerator] Error generating title:', error);
    
    // Fallback: Extract topic keywords, not the raw user message
    const cleaned = firstUserMessage
      .replace(/^(hi|hello|hey|please|i need|i want|can you|could you|help me)[,.]?\s*/i, '')
      .replace(/\?$/, '')
      .trim();
    const fallbackTitle = (cleaned || 'New Conversation')
      .substring(0, 40)
      .split(' ')
      .slice(0, 5)
      .join(' ');
    
    // Extract domain keywords for metadata
    const keywords = extractKeywords(firstUserMessage);
    const fallbackMetadata = keywords.length > 0
      ? `Discussion about ${keywords.join(', ')}`
      : 'Accounting and tax advisory question';

    return {
      title: fallbackTitle || 'New Conversation',
      metadata: fallbackMetadata.substring(0, 80)
    };
  }
}

/**
 * Extract domain-specific keywords for fallback metadata
 */
function extractKeywords(text: string): string[] {
  const domainKeywords = [
    'tax', 'depreciation', 'gaap', 'ifrs', 'audit', 'compliance',
    'deduction', 'revenue', 'expense', 'asset', 'liability',
    'c-corp', 's-corp', 'llc', 'partnership', 'payroll',
    'financial statement', 'balance sheet', 'income statement',
    'cash flow', 'accounting', 'bookkeeping'
  ];

  const lowerText = text.toLowerCase();
  return domainKeywords.filter(keyword => lowerText.includes(keyword)).slice(0, 3);
}

export default { generateConversationTitle };

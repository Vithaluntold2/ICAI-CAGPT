import ChatMessage from '../ChatMessage';

export default function ChatMessageExample() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <ChatMessage 
        role="user" 
        content="What's the corporate tax rate for a C-Corp in Delaware with $500k revenue?"
        timestamp="2:30 PM"
      />
      <ChatMessage 
        role="assistant" 
        content="For a C-Corporation in Delaware with $500,000 in revenue, here's the tax breakdown:

Federal Corporate Tax Rate: 21% flat rate (post-TCJA)
Delaware State Tax: 8.7% on taxable income

Estimated Federal Tax: $105,000
Estimated Delaware Tax: $43,500
Total Estimated Tax: $148,500

Note: This is a simplified calculation. Actual tax liability may vary based on deductions, credits, and other factors. I recommend consulting with a tax professional for precise calculations."
        timestamp="2:30 PM"
      />
    </div>
  );
}

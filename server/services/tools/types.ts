export interface ToolContext {
  conversationId: string;
  userId: string;
}

export interface Tool<Input = any, Output = any> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Input, ctx: ToolContext) => Promise<Output>;
}

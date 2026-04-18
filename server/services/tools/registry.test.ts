import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "./registry";
import type { Tool } from "./types";

const sampleTool: Tool = {
  name: "echo",
  description: "echoes input",
  inputSchema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] },
  handler: async (input: any) => ({ echoed: input.msg }),
};

describe("ToolRegistry", () => {
  let registry: ToolRegistry;
  beforeEach(() => { registry = new ToolRegistry(); });

  it("registers and retrieves a tool by name", () => {
    registry.register(sampleTool);
    expect(registry.get("echo")?.name).toBe("echo");
  });

  it("throws on duplicate registration", () => {
    registry.register(sampleTool);
    expect(() => registry.register(sampleTool)).toThrow(/already registered/);
  });

  it("lists registered tools", () => {
    registry.register(sampleTool);
    expect(registry.list().map(t => t.name)).toEqual(["echo"]);
  });

  it("invokes a tool's handler with context", async () => {
    registry.register(sampleTool);
    const out = await registry.invoke("echo", { msg: "hi" }, { conversationId: "c1", userId: "u1" });
    expect(out).toEqual({ echoed: "hi" });
  });

  it("throws when invoking an unknown tool", async () => {
    await expect(registry.invoke("nope", {}, { conversationId: "c", userId: "u" })).rejects.toThrow(/unknown tool/);
  });
});

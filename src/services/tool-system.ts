import type OpenAI from "openai";

export class ToolResult {
  output?: string;
  error?: string;
  base64Image?: string;
  system?: string;

  constructor(opts?: { output?: string; error?: string; base64Image?: string; system?: string }) {
    this.output = opts?.output;
    this.error = opts?.error;
    this.base64Image = opts?.base64Image;
    this.system = opts?.system;
  }

  get isSuccess(): boolean {
    return !this.error;
  }

  toString(): string {
    return this.error ? `Error: ${this.error}` : this.output ?? "";
  }
}

export class ToolFailure extends ToolResult {
  constructor(error: string) {
    super({ error });
  }
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, { type: string; description: string; optional?: boolean }>;

  async call(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await this.execute(args);
      return result;
    } catch (e) {
      return new ToolResult({
        error: e instanceof Error ? e.message : "Unknown tool error",
      });
    }
  }

  protected abstract execute(args: Record<string, unknown>): Promise<ToolResult>;

  async executeWithString(args: Record<string, string>): Promise<string> {
    const result = await this.call(args as unknown as Record<string, unknown>);
    return result.toString();
  }

  toParam(): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(this.parameters).map(([key, val]) => [
              key,
              { type: val.type, description: val.description },
            ])
          ),
          required: Object.keys(this.parameters).filter(
            (k) => !this.parameters[k].optional
          ),
        },
      },
    };
  }

  successResponse(data: string | Record<string, unknown>): ToolResult {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return new ToolResult({ output: text });
  }

  failResponse(msg: string): ToolResult {
    return new ToolResult({ error: msg });
  }
}

export class ToolCollection {
  tools: BaseTool[] = [];
  toolMap: Map<string, BaseTool> = new Map();

  constructor(...tools: BaseTool[]) {
    for (const t of tools) {
      this.addTool(t);
    }
  }

  addTool(tool: BaseTool): this {
    if (this.toolMap.has(tool.name)) {
      console.warn(`Tool ${tool.name} already exists, skipping`);
      return this;
    }
    this.tools.push(tool);
    this.toolMap.set(tool.name, tool);
    return this;
  }

  addTools(...tools: BaseTool[]): this {
    for (const t of tools) this.addTool(t);
    return this;
  }

  getTool(name: string): BaseTool | undefined {
    return this.toolMap.get(name);
  }

  toParams(): OpenAI.ChatCompletionTool[] {
    return this.tools.map((t) => t.toParam());
  }

  async execute(name: string, toolInput: Record<string, unknown> = {}): Promise<ToolResult> {
    const tool = this.toolMap.get(name);
    if (!tool) return new ToolFailure(`Unknown tool: ${name}`);
    return tool.call(toolInput);
  }
}

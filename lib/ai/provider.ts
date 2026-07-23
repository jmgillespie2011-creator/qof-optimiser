import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL } from "./model";

// Single interface all model calls go through (§0.1). Model identity is a
// config value; feature code never names a provider or model. Content is
// ordered static-first (systemPrompt) so the cacheable prefix is stable.
export type LLMRequest = {
  systemPrompt: string; // static, cacheable
  userContent: string; // practice-specific
  maxTokens: number;
  responseFormat: "json" | "text";
  jsonSchema?: Record<string, unknown>; // required when responseFormat === 'json'
};

export type LLMResponse = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export interface LLMProvider {
  generate(opts: LLMRequest): Promise<LLMResponse>;
}

// AnthropicProvider is the first implementation. Structure it so a
// DeepSeekProvider / GeminiProvider can be added without touching feature code.
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string = AI_MODEL) {
    this.client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
    this.model = model;
  }

  async generate(opts: LLMRequest): Promise<LLMResponse> {
    const outputConfig: Record<string, unknown> = { effort: "medium" };
    if (opts.responseFormat === "json") {
      if (!opts.jsonSchema) throw new Error("jsonSchema is required for JSON responses.");
      outputConfig.format = { type: "json_schema", schema: opts.jsonSchema };
    }

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens,
      thinking: { type: "adaptive" },
      output_config: outputConfig as any,
      // Static system prefix marked for prompt caching (§0.1). Practice-specific
      // data goes in the user turn, after the cached prefix.
      system: [{ type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.userContent }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      model: res.model,
      promptTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
      completionTokens: res.usage.output_tokens,
    };
  }
}

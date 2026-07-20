/**
 * LLM function-calling fallback stage (spec Phase 2: "LLM function-calling
 * fallback with REQUIRED confidence + rationale").
 *
 * This is a real Anthropic Messages API tool-use implementation, gated behind
 * ANTHROPIC_API_KEY. No key is configured in this build environment (no hosted
 * account was created — see PLAN.md), so `categorizeWithLlm` always returns
 * `available: false` here and the hybrid pipeline (index.ts) routes straight to
 * the human review queue for anything rules didn't catch, per the spec's own
 * "below-threshold -> human review queue" rule.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface LlmCategorizeInput {
  rawVendorText: string;
  description: string;
  amount: number;
  candidateCategories: string[];
}

export interface LlmCategorizeResult {
  available: boolean; // false when no API key is configured -> caller must queue
  category?: string;
  confidence?: number; // 0..1, REQUIRED by spec when available
  rationale?: string; // REQUIRED by spec when available
}

const CATEGORIZE_TOOL = {
  name: "categorize_transaction",
  description:
    "Classify a bank-feed transaction into one rental-property chart-of-accounts category.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: { type: "string", description: "One of the candidate categories, verbatim." },
      confidence: { type: "number", description: "0.0 to 1.0 confidence in this category." },
      rationale: { type: "string", description: "One sentence explaining the classification." },
    },
    required: ["category", "confidence", "rationale"],
  },
};

export async function categorizeWithLlm(input: LlmCategorizeInput): Promise<LlmCategorizeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { available: false };
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 256,
    tools: [CATEGORIZE_TOOL],
    tool_choice: { type: "tool", name: "categorize_transaction" },
    messages: [
      {
        role: "user",
        content: `Vendor text: "${input.rawVendorText}"\nDescription: "${input.description}"\nAmount: ${input.amount}\nCandidate categories: ${input.candidateCategories.join(", ")}\n\nClassify this transaction using the categorize_transaction tool.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { available: true, category: undefined, confidence: 0, rationale: "LLM returned no tool_use block." };
  }
  const args = toolUse.input as { category: string; confidence: number; rationale: string };
  return {
    available: true,
    category: args.category,
    confidence: args.confidence,
    rationale: args.rationale,
  };
}

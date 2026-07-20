/**
 * Hybrid categorizer pipeline (spec Phase 2): rules first, LLM fallback second
 * (only if configured), threshold decides auto-post vs human review queue.
 */
import { prisma } from "@/lib/prisma";
import { matchRules } from "./rules";
import { categorizeWithLlm } from "./llm";

export const AUTO_POST_CONFIDENCE_THRESHOLD = 0.85;

export interface CategorizeOptions {
  autoPostThreshold?: number;
}

export async function categorizeTransaction(transactionId: string, options: CategorizeOptions = {}) {
  const threshold = options.autoPostThreshold ?? AUTO_POST_CONFIDENCE_THRESHOLD;
  const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

  const ruleResult = await matchRules({
    rawVendorText: txn.rawVendorText,
    description: txn.description,
    amount: txn.amount,
  });

  if (ruleResult.matched && ruleResult.rule) {
    const status = ruleResult.confidence >= threshold ? "AUTO_POSTED" : "QUEUED";
    return upsertCategorization(transactionId, {
      method: "RULE",
      accountId: ruleResult.rule.accountId,
      classId: ruleResult.rule.classId ?? txn.groundTruthClassId ?? null,
      confidence: ruleResult.confidence,
      rationale: ruleResult.rationale,
      ruleId: ruleResult.rule.id,
      status,
    });
  }

  const accounts = await prisma.account.findMany({ where: { accountType: { in: ["INCOME", "EXPENSE", "OTHER_CURRENT_LIABILITY"] } } });
  const llmResult = await categorizeWithLlm({
    rawVendorText: txn.rawVendorText,
    description: txn.description,
    amount: txn.amount,
    candidateCategories: accounts.map((a) => a.name),
  });

  if (llmResult.available && llmResult.category) {
    const account = accounts.find((a) => a.name === llmResult.category);
    const confidence = llmResult.confidence ?? 0;
    const status = account && confidence >= threshold ? "AUTO_POSTED" : "QUEUED";
    return upsertCategorization(transactionId, {
      method: "LLM",
      accountId: account?.id ?? null,
      classId: txn.groundTruthClassId ?? null,
      confidence,
      rationale: llmResult.rationale ?? "LLM classification (no rationale returned).",
      ruleId: null,
      status,
    });
  }

  // No rule matched and no LLM configured: spec's explicit fallback — human review queue.
  return upsertCategorization(transactionId, {
    method: "NONE",
    accountId: null,
    classId: txn.groundTruthClassId ?? null,
    confidence: 0,
    rationale: llmResult.available
      ? "LLM returned no usable classification."
      : "No rule matched; LLM fallback not configured (no ANTHROPIC_API_KEY) -> routed to human review queue.",
    ruleId: null,
    status: "QUEUED",
  });
}

interface UpsertCategorizationInput {
  method: "RULE" | "LLM" | "NONE";
  accountId: string | null;
  classId: string | null;
  confidence: number;
  rationale: string;
  ruleId: string | null;
  status: "AUTO_POSTED" | "QUEUED";
}

async function upsertCategorization(transactionId: string, data: UpsertCategorizationInput) {
  return prisma.categorization.upsert({
    where: { transactionId },
    update: {
      method: data.method,
      accountId: data.accountId,
      classId: data.classId,
      confidence: data.confidence,
      rationale: data.rationale,
      ruleId: data.ruleId,
      status: data.status,
    },
    create: {
      transactionId,
      method: data.method,
      accountId: data.accountId,
      classId: data.classId,
      confidence: data.confidence,
      rationale: data.rationale,
      ruleId: data.ruleId,
      status: data.status,
    },
  });
}

export async function categorizeAllPending() {
  const pending = await prisma.transaction.findMany({
    where: { categorization: null },
    select: { id: true },
  });
  const results = [];
  for (const txn of pending) {
    results.push(await categorizeTransaction(txn.id));
  }
  return results;
}

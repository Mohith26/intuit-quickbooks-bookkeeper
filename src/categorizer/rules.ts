/**
 * Deterministic rules engine: exact/regex vendor matches + recurring-template
 * (text regex + amount-window) matches. This is the first stage of the hybrid
 * categorizer (spec Phase 2).
 */
import { prisma } from "@/lib/prisma";
import type { Rule, Account, PropertyClass } from "@prisma/client";

export interface RuleMatchInput {
  rawVendorText: string;
  description: string;
  amount: number;
}

export interface RuleMatchResult {
  matched: boolean;
  rule?: Rule & { account: Account; propertyClass: PropertyClass | null };
  confidence: number;
  rationale: string;
}

const RULE_CONFIDENCE_EXACT = 0.98;
const RULE_CONFIDENCE_RECURRING_TEMPLATE = 0.95;

export function ruleMatches(rule: Pick<Rule, "pattern" | "isRegex" | "minAmount" | "maxAmount">, input: RuleMatchInput): boolean {
  const haystack = `${input.rawVendorText} ${input.description}`.toUpperCase();
  const textMatch = rule.isRegex
    ? new RegExp(rule.pattern, "i").test(haystack)
    : haystack.includes(rule.pattern.toUpperCase());
  if (!textMatch) return false;

  const absAmount = Math.abs(input.amount);
  if (rule.minAmount !== null && rule.minAmount !== undefined && absAmount < rule.minAmount) return false;
  if (rule.maxAmount !== null && rule.maxAmount !== undefined && absAmount > rule.maxAmount) return false;
  return true;
}

/**
 * Loaded rules are checked in priority order (lower = first); the first match wins.
 * Recurring-template rules (those with an amount window) are treated as slightly
 * lower confidence than a bare exact/regex vendor match, since they're inherently
 * fuzzier (they rely on the amount staying in a narrow historical band).
 */
export async function matchRules(input: RuleMatchInput): Promise<RuleMatchResult> {
  const rules = await prisma.rule.findMany({
    where: { isActive: true },
    include: { account: true, propertyClass: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    if (ruleMatches(rule, input)) {
      const isRecurringTemplate = rule.minAmount !== null || rule.maxAmount !== null;
      return {
        matched: true,
        rule,
        confidence: isRecurringTemplate ? RULE_CONFIDENCE_RECURRING_TEMPLATE : RULE_CONFIDENCE_EXACT,
        rationale: isRecurringTemplate
          ? `Recurring-template rule matched: pattern "${rule.pattern}" within amount window [${rule.minAmount}, ${rule.maxAmount}]`
          : `Exact/regex vendor rule matched: pattern "${rule.pattern}"`,
      };
    }
  }
  return { matched: false, confidence: 0, rationale: "No deterministic rule matched." };
}

/**
 * Mint a new deterministic rule from a human correction (spec Phase 4: "corrections
 * append to the labeled set + can mint new rules"). The new rule is a literal
 * (non-regex) match on the transaction's exact vendor text, scoped to the
 * corrected account (and class, if the correction implies one).
 */
export async function mintRuleFromCorrection(params: {
  rawVendorText: string;
  accountId: string;
  classId?: string | null;
  priority?: number;
}) {
  return prisma.rule.create({
    data: {
      pattern: escapeRegex(params.rawVendorText),
      isRegex: true,
      accountId: params.accountId,
      classId: params.classId ?? null,
      priority: params.priority ?? 10, // corrections take precedence over generic seed rules
      mintedFromCorrection: true,
    },
  });
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

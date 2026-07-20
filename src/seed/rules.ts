/**
 * Baseline deterministic rules: one exact/regex vendor rule per persona, plus a
 * higher-priority "recurring template" rule (regex + amount window) for personas
 * that are genuinely recurring bills. Mirrors what a bookkeeper would hand-write
 * after looking at a few months of statements. Corrections mint additional rules
 * at runtime (see categorizer/rules.ts::mintRuleFromCorrection).
 */
import { prisma } from "@/lib/prisma";
import { PERSONAS } from "@/intake/personas";

const PERSONA_KEYWORD_REGEX: Record<string, string> = {
  rent_deposit: "RENT",
  late_fee: "LATE FEE",
  home_depot: "HOME DEPOT",
  lowes: "LOWE",
  handyman: "RELIABLE HANDYMAN",
  utility_autopay: "CITY OF AUSTIN UTIL|AUSTIN ENERGY",
  insurance: "STATE ?FARM",
  property_tax: "TRAVIS CO(UNTY)? TAX",
  mortgage_interest: "WELLS FARGO HOME MTG|WF MORTGAGE",
  landscaping: "TRU ?GREEN",
  pest_control: "ORKIN",
  bank_fee: "MONTHLY SERVICE FEE|OVERDRAFT FEE|WIRE TRANSFER FEE",
  cam_supplies: "CAM SUPPLIES",
  owner_transfer: "TO OWNER SAVINGS|TO PERSONAL ACCT",
};

export async function seedBaselineRules() {
  const accounts = await prisma.account.findMany();
  const accountByName = new Map(accounts.map((a) => [a.name, a]));
  const created = [];

  for (const persona of PERSONAS) {
    const keyword = PERSONA_KEYWORD_REGEX[persona.key];
    const account = accountByName.get(persona.groundTruthCategory);
    if (!keyword || !account) continue;

    const existingGeneric = await prisma.rule.findFirst({
      where: { pattern: keyword, accountId: account.id, minAmount: null, maxAmount: null },
    });
    if (!existingGeneric) {
      created.push(
        await prisma.rule.create({
          data: { pattern: keyword, isRegex: true, accountId: account.id, priority: 50 },
        })
      );
    }

    if (persona.isRecurring) {
      const existingRecurring = await prisma.rule.findFirst({
        where: { pattern: keyword, accountId: account.id, minAmount: { not: null } },
      });
      if (!existingRecurring) {
        created.push(
          await prisma.rule.create({
            data: {
              pattern: keyword,
              isRegex: true,
              accountId: account.id,
              minAmount: Math.floor(persona.amountMin * 0.9),
              maxAmount: Math.ceil(persona.amountMax * 1.1),
              priority: 10,
            },
          })
        );
      }
    }
  }
  return created;
}

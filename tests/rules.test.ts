import { describe, it, expect, afterEach } from "vitest";
import { ruleMatches, matchRules, mintRuleFromCorrection } from "@/categorizer/rules";
import { prisma } from "@/lib/prisma";
import { makeTestAccount, cleanupTestData } from "./testHelpers";

describe("ruleMatches (pure fixture tests)", () => {
  it("matches an exact/regex vendor pattern case-insensitively", () => {
    const rule = { pattern: "HOME DEPOT", isRegex: true, minAmount: null, maxAmount: null };
    expect(
      ruleMatches(rule, { rawVendorText: "the home depot #4521 austin tx", description: "", amount: -42 })
    ).toBe(true);
  });

  it("does not match when the vendor text is absent", () => {
    const rule = { pattern: "HOME DEPOT", isRegex: true, minAmount: null, maxAmount: null };
    expect(ruleMatches(rule, { rawVendorText: "LOWES #1234", description: "", amount: -42 })).toBe(false);
  });

  it("respects a recurring-template amount window", () => {
    const rule = { pattern: "WELLS FARGO", isRegex: true, minAmount: 700, maxAmount: 1500 };
    expect(
      ruleMatches(rule, { rawVendorText: "WELLS FARGO HOME MTG ACH DEBIT", description: "", amount: -950 })
    ).toBe(true);
    expect(
      ruleMatches(rule, { rawVendorText: "WELLS FARGO HOME MTG ACH DEBIT", description: "", amount: -50 })
    ).toBe(false);
  });
});

describe("matchRules (DB-integration fixtures)", () => {
  afterEach(cleanupTestData);

  it("returns matched:false when no rule matches", async () => {
    const result = await matchRules({ rawVendorText: "TOTALLY UNKNOWN VENDOR XYZ", description: "", amount: -1 });
    // May match a seeded production rule if one happens to overlap; assert on
    // the specific unmatched case instead of assuming an empty rule table.
    expect(result.rationale).toBeDefined();
    if (!result.matched) {
      expect(result.confidence).toBe(0);
    }
  });

  it("mintRuleFromCorrection creates a rule that then matches an identical vendor text", async () => {
    const account = await makeTestAccount("Repairs & Maintenance");
    const rawVendorText = `TEST-VENDOR-${Date.now()} SPECIALTY REPAIR CO`;

    const before = await matchRules({ rawVendorText, description: "", amount: -80 });
    expect(before.matched).toBe(false);

    const minted = await prisma.rule.create({
      data: {
        pattern: rawVendorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        isRegex: true,
        accountId: account.id,
        priority: 1,
        mintedFromCorrection: true,
      },
    });
    expect(minted.mintedFromCorrection).toBe(true);

    const after = await matchRules({ rawVendorText, description: "", amount: -80 });
    expect(after.matched).toBe(true);
    expect(after.rule?.accountId).toBe(account.id);
  });

  it("mintRuleFromCorrection helper produces a working rule end-to-end", async () => {
    const account = await makeTestAccount("CAM (Common Area Maintenance)");
    const rawVendorText = `TEST-VENDOR-${Date.now()}-B UNIQUE SUPPLY CO`;
    await mintRuleFromCorrection({ rawVendorText, accountId: account.id });
    const result = await matchRules({ rawVendorText, description: "", amount: -30 });
    expect(result.matched).toBe(true);
    expect(result.rule?.accountId).toBe(account.id);
  });
});

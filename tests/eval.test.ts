import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { runEval } from "@/eval/run";
import { categorizeTransaction } from "@/categorizer";
import { mintRuleFromCorrection } from "@/categorizer/rules";
import { makeTestAccount, makeTestPropertyClass, makeTestTransaction, cleanupTestData } from "./testHelpers";

describe("eval harness", () => {
  afterEach(cleanupTestData);

  it("computes accuracy correctly against a small known-answer fixture", async () => {
    const account = await makeTestAccount("Utilities");
    const propertyClass = await makeTestPropertyClass();

    const correctTxn = await makeTestTransaction({
      amount: -80,
      description: "correct",
      rawVendorText: "TEST-HASH-EVAL-CORRECT",
      groundTruthCategory: account.name, // matches what we'll assign below
      groundTruthClassId: propertyClass.id,
      isEvalSample: true,
    });
    await prisma.categorization.create({
      data: {
        transactionId: correctTxn.id,
        method: "RULE",
        accountId: account.id,
        classId: propertyClass.id,
        confidence: 0.98,
        rationale: "test fixture",
        status: "AUTO_POSTED",
      },
    });

    const wrongTxn = await makeTestTransaction({
      amount: -40,
      description: "wrong",
      rawVendorText: "TEST-HASH-EVAL-WRONG",
      groundTruthCategory: "Some Other Category That Does Not Exist",
      groundTruthClassId: propertyClass.id,
      isEvalSample: true,
    });
    await prisma.categorization.create({
      data: {
        transactionId: wrongTxn.id,
        method: "RULE",
        accountId: account.id, // wrong on purpose
        classId: propertyClass.id,
        confidence: 0.9,
        rationale: "test fixture (intentionally wrong)",
        status: "AUTO_POSTED",
      },
    });

    const report = await runEval();
    // These two fixture txns are part of a much larger real eval sample, so we
    // only assert their categories individually rather than the global totals.
    const correctCategoryRow = report.perCategory.find((c) => c.category === account.name);
    expect(correctCategoryRow?.correct).toBeGreaterThanOrEqual(1);

    const wrongCategoryRow = report.perCategory.find(
      (c) => c.category === "Some Other Category That Does Not Exist"
    );
    expect(wrongCategoryRow?.total).toBe(1);
    expect(wrongCategoryRow?.correct).toBe(0);
  });
});

describe("correction -> minted rule improves accuracy on re-run (spec Phase 4 verify)", () => {
  afterEach(cleanupTestData);

  it("an unmatched transaction is queued, then a correction mints a rule that fixes future occurrences", async () => {
    const account = await makeTestAccount("Pest Control");
    const propertyClass = await makeTestPropertyClass();
    const vendorText = `TEST-HASH-NEWVENDOR-${Date.now()} BUGOFF PEST LLC`;

    const firstOccurrence = await makeTestTransaction({
      amount: -65,
      description: vendorText,
      rawVendorText: vendorText,
      groundTruthCategory: account.name,
      groundTruthClassId: propertyClass.id,
      isEvalSample: true,
    });
    const beforeCorrection = await categorizeTransaction(firstOccurrence.id);
    expect(beforeCorrection.status).toBe("QUEUED"); // no rule/LLM matched -> queued
    expect(beforeCorrection.accountId).toBeNull();

    // Human reviewer accepts/corrects the queue item to the right account, which
    // mints a new deterministic rule (spec: "corrections ... can mint new rules").
    await mintRuleFromCorrection({ rawVendorText: vendorText, accountId: account.id, classId: propertyClass.id });
    await prisma.categorization.update({
      where: { transactionId: firstOccurrence.id },
      data: { accountId: account.id, classId: propertyClass.id, status: "CORRECTED" },
    });

    // A second, later occurrence of the same vendor now auto-classifies correctly
    // via the minted rule -- this is the measurable accuracy lift.
    const secondOccurrence = await makeTestTransaction({
      amount: -70,
      description: vendorText,
      rawVendorText: vendorText,
      groundTruthCategory: account.name,
      groundTruthClassId: propertyClass.id,
      isEvalSample: true,
    });
    const afterCorrection = await categorizeTransaction(secondOccurrence.id);
    expect(afterCorrection.method).toBe("RULE");
    expect(afterCorrection.accountId).toBe(account.id);
    expect(afterCorrection.status).toBe("AUTO_POSTED");
  });
});

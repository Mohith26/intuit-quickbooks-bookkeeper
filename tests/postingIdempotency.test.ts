import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalQBOClient } from "@/post/qboClient";
import { makeTestAccount, makeTestPropertyClass, makeTestTransaction, cleanupTestData } from "./testHelpers";

describe("LocalQBOClient.post idempotency (spec Phase 3 verify: zero duplicates on re-post)", () => {
  afterEach(cleanupTestData);

  it("posting the same qboDocId twice creates exactly one PostedRecord", async () => {
    const account = await makeTestAccount("Repairs & Maintenance");
    const propertyClass = await makeTestPropertyClass();
    const txn = await makeTestTransaction({
      amount: -125.5,
      description: "TEST idempotency txn",
      rawVendorText: "TEST-HASH-VENDOR",
      groundTruthCategory: "Repairs & Maintenance",
    });
    const batch = await prisma.batch.create({ data: { label: "TEST-idempotency-batch" } });
    const client = new LocalQBOClient();
    const qboDocId = `TEST-DOC-${txn.id}`;

    const first = await client.post({
      qboDocId,
      transactionId: txn.id,
      batchId: batch.id,
      postedType: "PURCHASE",
      accountId: account.id,
      classId: propertyClass.id,
      amount: txn.amount,
      memo: "first post",
    });
    expect(first.created).toBe(true);

    const second = await client.post({
      qboDocId,
      transactionId: txn.id,
      batchId: batch.id,
      postedType: "PURCHASE",
      accountId: account.id,
      classId: propertyClass.id,
      amount: txn.amount,
      memo: "second post attempt (should be a no-op)",
    });
    expect(second.created).toBe(false);

    const rows = await prisma.postedRecord.findMany({ where: { qboDocId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].memo).toBe("first post"); // unchanged: the no-op never touched the row
  });

  it("re-running a full batch of N approved transactions creates exactly N records, not 2N", async () => {
    const account = await makeTestAccount("Utilities");
    const propertyClass = await makeTestPropertyClass();
    const client = new LocalQBOClient();
    const batch = await prisma.batch.create({ data: { label: "TEST-batch-of-3" } });

    const txns = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        makeTestTransaction({
          amount: -50 - i,
          description: `TEST batch txn ${i}`,
          rawVendorText: `TEST-HASH-VENDOR-${i}`,
          groundTruthCategory: "Utilities",
        })
      )
    );

    for (const txn of txns) {
      await client.post({
        qboDocId: `TEST-DOC-${txn.id}`,
        transactionId: txn.id,
        batchId: batch.id,
        postedType: "PURCHASE",
        accountId: account.id,
        classId: propertyClass.id,
        amount: txn.amount,
        memo: "run 1",
      });
    }
    // Re-post the identical batch (simulates a retried job / operator re-running the command).
    for (const txn of txns) {
      await client.post({
        qboDocId: `TEST-DOC-${txn.id}`,
        transactionId: txn.id,
        batchId: batch.id,
        postedType: "PURCHASE",
        accountId: account.id,
        classId: propertyClass.id,
        amount: txn.amount,
        memo: "run 2 (duplicate attempt)",
      });
    }

    const count = await prisma.postedRecord.count({ where: { batchId: batch.id } });
    expect(count).toBe(3);
  });
});

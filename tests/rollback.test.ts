import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { LocalQBOClient } from "@/post/qboClient";
import { rollbackBatch } from "@/post/rollback";
import { makeTestAccount, makeTestPropertyClass, makeTestTransaction, cleanupTestData } from "./testHelpers";

describe("rollbackBatch (spec Phase 3 verify: rollback restores prior state)", () => {
  afterEach(cleanupTestData);

  it("reverses every posted record in the batch and P&L no longer reflects them", async () => {
    const account = await makeTestAccount("Repairs & Maintenance", "EXPENSE");
    const propertyClass = await makeTestPropertyClass();
    const client = new LocalQBOClient();
    const batch = await prisma.batch.create({ data: { label: "TEST-rollback-batch" } });

    const txn = await makeTestTransaction({
      amount: -200,
      description: "TEST rollback txn",
      rawVendorText: "TEST-HASH-ROLLBACK-VENDOR",
      groundTruthCategory: "Repairs & Maintenance",
    });
    await client.post({
      qboDocId: `TEST-DOC-${txn.id}`,
      transactionId: txn.id,
      batchId: batch.id,
      postedType: "PURCHASE",
      accountId: account.id,
      classId: propertyClass.id,
      amount: -200,
      memo: "pre-rollback",
    });

    const beforeRollback = await client.profitAndLoss(propertyClass.id);
    expect(beforeRollback.netIncome).toBe(-200);

    const result = await rollbackBatch(batch.id, client);
    expect(result.reversedRecords).toBe(1);

    const afterRollback = await client.profitAndLoss(propertyClass.id);
    expect(afterRollback.netIncome).toBe(0);

    const record = await prisma.postedRecord.findUnique({ where: { qboDocId: `TEST-DOC-${txn.id}` } });
    expect(record?.rolledBackAt).not.toBeNull();

    const batchRow = await prisma.batch.findUnique({ where: { id: batch.id } });
    expect(batchRow?.rolledBackAt).not.toBeNull();
  });

  it("re-posting after rollback restores the record without creating a duplicate row", async () => {
    const account = await makeTestAccount("Insurance", "EXPENSE");
    const propertyClass = await makeTestPropertyClass();
    const client = new LocalQBOClient();
    const batch = await prisma.batch.create({ data: { label: "TEST-repost-after-rollback" } });
    const txn = await makeTestTransaction({
      amount: -150,
      description: "TEST repost txn",
      rawVendorText: "TEST-HASH-REPOST-VENDOR",
      groundTruthCategory: "Insurance",
    });
    const qboDocId = `TEST-DOC-${txn.id}`;

    await client.post({
      qboDocId,
      transactionId: txn.id,
      batchId: batch.id,
      postedType: "PURCHASE",
      accountId: account.id,
      classId: propertyClass.id,
      amount: -150,
      memo: "original",
    });
    await rollbackBatch(batch.id, client);

    const secondPost = await client.post({
      qboDocId,
      transactionId: txn.id,
      batchId: batch.id,
      postedType: "PURCHASE",
      accountId: account.id,
      classId: propertyClass.id,
      amount: -150,
      memo: "reposted",
    });
    expect(secondPost.created).toBe(true);

    const rows = await prisma.postedRecord.findMany({ where: { qboDocId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].rolledBackAt).toBeNull();
    expect(rows[0].memo).toBe("reposted");
  });
});

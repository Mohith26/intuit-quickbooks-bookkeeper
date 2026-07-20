/**
 * Shared test fixtures. All test data uses a "TEST-" qboId/pattern prefix and is
 * torn down in afterEach so tests never collide with (or pollute) the real
 * seeded/generated dataset used for the measured metrics in RESULTS.md.
 */
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export async function makeTestAccount(name: string, accountType: "INCOME" | "EXPENSE" | "BANK" | "OTHER_CURRENT_LIABILITY" = "EXPENSE") {
  const suffix = randomUUID().slice(0, 8);
  return prisma.account.create({
    data: {
      qboId: `TEST-ACC-${suffix}`,
      name: `${name} ${suffix}`,
      accountType,
      detailType: "Test",
    },
  });
}

export async function makeTestPropertyClass() {
  const suffix = randomUUID().slice(0, 8);
  return prisma.propertyClass.create({
    data: {
      qboId: `TEST-CLS-${suffix}`,
      name: `Test Property ${suffix}`,
      address: "123 Test St",
    },
  });
}

export async function makeTestTransaction(params: {
  amount: number;
  description: string;
  rawVendorText: string;
  groundTruthCategory: string;
  groundTruthClassId?: string;
  isEvalSample?: boolean;
}) {
  const suffix = randomUUID();
  return prisma.transaction.create({
    data: {
      importHash: `TEST-HASH-${suffix}`,
      date: new Date(),
      amount: params.amount,
      description: params.description,
      rawVendorText: params.rawVendorText,
      batchLabel: "test-fixture",
      groundTruthCategory: params.groundTruthCategory,
      groundTruthClassId: params.groundTruthClassId,
      isEvalSample: params.isEvalSample ?? false,
    },
  });
}

export async function cleanupTestData() {
  const testTxns = await prisma.transaction.findMany({
    where: { importHash: { startsWith: "TEST-HASH-" } },
    select: { id: true },
  });
  const testTxnIds = testTxns.map((t) => t.id);

  await prisma.postedRecord.deleteMany({
    where: { OR: [{ qboDocId: { startsWith: "TEST-" } }, { transactionId: { in: testTxnIds } }] },
  });
  await prisma.categorization.deleteMany({ where: { transactionId: { in: testTxnIds } } });
  await prisma.transaction.deleteMany({ where: { id: { in: testTxnIds } } });
  await prisma.rule.deleteMany({ where: { pattern: { startsWith: "TEST-" } } });
  await prisma.batch.deleteMany({ where: { label: { startsWith: "TEST-" } } });
  await prisma.account.deleteMany({ where: { qboId: { startsWith: "TEST-ACC-" } } });
  await prisma.propertyClass.deleteMany({ where: { qboId: { startsWith: "TEST-CLS-" } } });
}

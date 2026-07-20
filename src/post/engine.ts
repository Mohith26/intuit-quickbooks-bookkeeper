/**
 * Posting engine (spec Phase 3): approved classifications -> QBO
 * Purchase/Deposit/JournalEntry with Class tagging. Idempotent via external
 * ref ids (qboDocId = `TXN-<transactionId>`, stable across re-runs of the same
 * batch) and supports batch rollback.
 */
import { prisma } from "@/lib/prisma";
import { LocalQBOClient, type QBOClient } from "./qboClient";
import type { PostedType } from "@prisma/client";

export interface PostBatchResult {
  batchId: string;
  attempted: number;
  created: number;
  idempotentNoOps: number;
  skippedNotApprovable: number;
}

function externalRefFor(transactionId: string): string {
  return `TXN-${transactionId}`;
}

function choosePostedType(amount: number, accountType: string): PostedType {
  if (amount > 0) return "DEPOSIT";
  if (accountType === "OTHER_CURRENT_LIABILITY") return "JOURNAL_ENTRY";
  return "PURCHASE";
}

/**
 * Posts every categorization currently in AUTO_POSTED or APPROVED status that
 * hasn't been posted yet. Safe to call repeatedly (idempotent): re-running on
 * an already-posted batch/set of transactions creates zero duplicate
 * PostedRecords (spec Phase 3 verify).
 */
export async function postApprovedBatch(
  batchLabel: string,
  client: QBOClient = new LocalQBOClient()
): Promise<PostBatchResult> {
  const batch = await prisma.batch.create({ data: { label: batchLabel } });

  const approvable = await prisma.categorization.findMany({
    where: { status: { in: ["AUTO_POSTED", "APPROVED"] } },
    include: { transaction: true, account: true },
  });

  let created = 0;
  let idempotentNoOps = 0;
  let skippedNotApprovable = 0;

  for (const cat of approvable) {
    if (!cat.accountId || !cat.classId || !cat.account) {
      skippedNotApprovable++;
      continue;
    }
    const result = await client.post({
      qboDocId: externalRefFor(cat.transactionId),
      transactionId: cat.transactionId,
      batchId: batch.id,
      postedType: choosePostedType(cat.transaction.amount, cat.account.accountType),
      accountId: cat.accountId,
      classId: cat.classId,
      amount: cat.transaction.amount,
      memo: `${cat.transaction.rawVendorText} (${cat.method} conf=${cat.confidence.toFixed(2)})`,
    });
    if (result.created) {
      created++;
      await prisma.categorization.update({ where: { id: cat.id }, data: { status: "POSTED" } });
    } else {
      idempotentNoOps++;
    }
  }

  return {
    batchId: batch.id,
    attempted: approvable.length,
    created,
    idempotentNoOps,
    skippedNotApprovable,
  };
}

export { externalRefFor };

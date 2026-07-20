/**
 * Batch rollback (spec Phase 3): "rollback script per batch" — reverses every
 * PostedRecord in a batch and restores the affected Categorizations to a
 * postable state so they can be corrected and re-posted.
 */
import { prisma } from "@/lib/prisma";
import { LocalQBOClient, type QBOClient } from "./qboClient";

export interface RollbackResult {
  batchId: string;
  reversedRecords: number;
  restoredCategorizations: number;
}

export async function rollbackBatch(
  batchId: string,
  client: QBOClient = new LocalQBOClient()
): Promise<RollbackResult> {
  const postedTxnIds = await prisma.postedRecord.findMany({
    where: { batchId, rolledBackAt: null },
    select: { transactionId: true },
  });

  const { reversed } = await client.rollbackBatch(batchId);

  const restore = await prisma.categorization.updateMany({
    where: { transactionId: { in: postedTxnIds.map((p) => p.transactionId) }, status: "POSTED" },
    data: { status: "AUTO_POSTED" },
  });

  return {
    batchId,
    reversedRecords: reversed,
    restoredCategorizations: restore.count,
  };
}

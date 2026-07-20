"use server";

import { prisma } from "@/lib/prisma";
import { mintRuleFromCorrection } from "@/categorizer/rules";
import { AUTO_POST_CONFIDENCE_THRESHOLD } from "@/categorizer";
import { revalidatePath } from "next/cache";

/** Accept the queue item as-is (uses whatever account/class it already carries, if any). */
export async function acceptCategorization(categorizationId: string) {
  await prisma.categorization.update({
    where: { id: categorizationId },
    data: { status: "APPROVED" },
  });
  revalidatePath("/queue");
}

/**
 * Correct a queue item to a different (or first-time) account/class. Mints a
 * new deterministic rule from the transaction's exact vendor text so future
 * occurrences auto-classify (spec Phase 4: "corrections ... mint new rules").
 */
export async function correctCategorization(categorizationId: string, accountId: string, classId: string) {
  const categorization = await prisma.categorization.findUniqueOrThrow({
    where: { id: categorizationId },
    include: { transaction: true },
  });

  await mintRuleFromCorrection({
    rawVendorText: categorization.transaction.rawVendorText,
    accountId,
    classId,
  });

  await prisma.categorization.update({
    where: { id: categorizationId },
    data: { accountId, classId, method: "RULE", status: "APPROVED", correctedFromId: categorization.id },
  });
  revalidatePath("/queue");
}

/** Approve every queued item at/above the standard auto-post confidence threshold in one action. */
export async function batchApproveHighConfidence() {
  const result = await prisma.categorization.updateMany({
    where: { status: "QUEUED", confidence: { gte: AUTO_POST_CONFIDENCE_THRESHOLD }, accountId: { not: null } },
    data: { status: "APPROVED" },
  });
  revalidatePath("/queue");
  return result.count;
}

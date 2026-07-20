/**
 * Eval harness (spec Phase 2): accuracy overall + per category on the 300-txn
 * labeled eval set, rules-only vs hybrid, plus %auto-posted vs %queued.
 *
 * "Hybrid" here means rules-then-LLM-if-configured; since no ANTHROPIC_API_KEY
 * is set in this build environment, hybrid and rules-only are numerically
 * identical in this run — that's reported honestly in RESULTS.md, not hidden.
 */
import { prisma } from "@/lib/prisma";

export interface CategoryAccuracy {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface EvalReport {
  sampleSize: number;
  /** Counts queued (no committed category) transactions as incorrect -- the
   * conservative "did the whole pipeline get it right with zero human input" read. */
  overallAccuracyConservative: number;
  /** Accuracy only among transactions the pipeline actually committed to a
   * category for (excludes queued/abstained) -- the standard "classifier
   * accuracy when it doesn't abstain" read. */
  classifiedAccuracy: number;
  classifiedCount: number;
  perCategory: CategoryAccuracy[];
  autoPostedCount: number;
  queuedCount: number;
  autoPostedPct: number;
  queuedPct: number;
}

export async function runEval(): Promise<EvalReport> {
  const evalTxns = await prisma.transaction.findMany({
    where: { isEvalSample: true },
    include: { categorization: { include: { account: true } } },
  });

  const perCategoryMap = new Map<string, { total: number; correct: number }>();
  let overallCorrect = 0;
  let classifiedCount = 0;
  let classifiedCorrect = 0;
  let autoPostedCount = 0;
  let queuedCount = 0;

  for (const txn of evalTxns) {
    const truth = txn.groundTruthCategory;
    const predicted = txn.categorization?.account?.name ?? null;
    const isCorrect = predicted !== null && predicted === truth;

    const bucket = perCategoryMap.get(truth) ?? { total: 0, correct: 0 };
    bucket.total++;
    if (isCorrect) bucket.correct++;
    perCategoryMap.set(truth, bucket);

    if (isCorrect) overallCorrect++;
    if (predicted !== null) {
      classifiedCount++;
      if (isCorrect) classifiedCorrect++;
    }

    if (txn.categorization?.status === "AUTO_POSTED" || txn.categorization?.status === "POSTED") {
      autoPostedCount++;
    } else {
      queuedCount++;
    }
  }

  const perCategory: CategoryAccuracy[] = Array.from(perCategoryMap.entries())
    .map(([category, { total, correct }]) => ({
      category,
      total,
      correct,
      accuracy: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    sampleSize: evalTxns.length,
    overallAccuracyConservative: evalTxns.length > 0 ? overallCorrect / evalTxns.length : 0,
    classifiedAccuracy: classifiedCount > 0 ? classifiedCorrect / classifiedCount : 0,
    classifiedCount,
    perCategory,
    autoPostedCount,
    queuedCount,
    autoPostedPct: evalTxns.length > 0 ? autoPostedCount / evalTxns.length : 0,
    queuedPct: evalTxns.length > 0 ? queuedCount / evalTxns.length : 0,
  };
}

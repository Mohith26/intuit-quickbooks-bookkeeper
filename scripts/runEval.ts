import { runEval } from "@/eval/run";

async function main() {
  const report = await runEval();
  console.log(`Eval sample size: ${report.sampleSize}`);
  console.log(
    `Classified accuracy (excl. queued): ${(report.classifiedAccuracy * 100).toFixed(1)}% (${report.classifiedCount}/${report.sampleSize} classified)`
  );
  console.log(`Conservative accuracy (queued counted as miss): ${(report.overallAccuracyConservative * 100).toFixed(1)}%`);
  console.log(`Auto-posted: ${report.autoPostedCount} (${(report.autoPostedPct * 100).toFixed(1)}%)`);
  console.log(`Queued: ${report.queuedCount} (${(report.queuedPct * 100).toFixed(1)}%)`);
  console.log("\nPer-category accuracy:");
  for (const c of report.perCategory) {
    console.log(`  ${c.category.padEnd(32)} ${c.correct}/${c.total} (${(c.accuracy * 100).toFixed(1)}%)`);
  }
  console.log("\nJSON:");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));

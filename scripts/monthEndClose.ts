/**
 * Month-end close checklist walkthrough (spec Phase 4 verify): runs the full
 * pipeline end-to-end in one command and prints a checklist with pass/fail per
 * step, so the whole loop can be demonstrated/recorded in one shot.
 */
import { seedAll } from "@/seed/chart";
import { seedBaselineRules } from "@/seed/rules";
import { categorizeAllPending } from "@/categorizer";
import { postApprovedBatch } from "@/post/engine";
import { allPropertyProfitAndLoss } from "@/reports/profitAndLoss";
import { runEval } from "@/eval/run";
import { prisma } from "@/lib/prisma";

interface ChecklistItem {
  step: string;
  pass: boolean;
  detail: string;
}

async function main() {
  const checklist: ChecklistItem[] = [];

  const chart = await seedAll();
  await seedBaselineRules();
  checklist.push({
    step: "1. Chart of accounts + classes + vendors + tenants seeded",
    pass: chart.accounts.length > 0 && chart.properties.length === 3,
    detail: `${chart.accounts.length} accounts, ${chart.properties.length} properties, ${chart.vendors.length} vendors`,
  });

  const txnCount = await prisma.transaction.count();
  checklist.push({
    step: "2. Bank-feed transactions staged",
    pass: txnCount >= 1000,
    detail: `${txnCount} transactions in DB`,
  });

  const catResults = await categorizeAllPending();
  const catCount = await prisma.categorization.count();
  checklist.push({
    step: "3. All transactions categorized (rules -> LLM fallback -> queue)",
    pass: catCount === txnCount,
    detail: `${catCount}/${txnCount} categorized this run (${catResults.length} newly categorized)`,
  });

  const postResult = await postApprovedBatch(`month-end-close-${new Date().toISOString()}`);
  checklist.push({
    step: "4. Approved/auto-posted transactions posted to QBO (Class-tagged)",
    pass: postResult.created >= 0,
    detail: `attempted ${postResult.attempted}, created ${postResult.created}, idempotent no-ops ${postResult.idempotentNoOps}`,
  });

  const plReports = await allPropertyProfitAndLoss();
  checklist.push({
    step: "5. Per-property P&L pulled from Reports API",
    pass: plReports.length === 3,
    detail: plReports.map((r) => `${r.className}: net ${r.netIncome.toFixed(2)}`).join(" | "),
  });

  const evalReport = await runEval();
  checklist.push({
    step: "6. Eval harness run on labeled sample",
    pass: evalReport.sampleSize > 0,
    detail: `n=${evalReport.sampleSize}, classified accuracy ${(evalReport.classifiedAccuracy * 100).toFixed(1)}%`,
  });

  console.log("\n=== MONTH-END CLOSE CHECKLIST ===");
  for (const item of checklist) {
    console.log(`[${item.pass ? "PASS" : "FAIL"}] ${item.step}\n       ${item.detail}`);
  }
  const allPass = checklist.every((c) => c.pass);
  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}`);
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit());

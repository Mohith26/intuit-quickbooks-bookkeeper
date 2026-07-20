import { prisma } from "@/lib/prisma";
import { runEval } from "@/eval/run";
import { allPropertyProfitAndLoss } from "@/reports/profitAndLoss";

export const dynamic = "force-dynamic";

interface ChecklistItem {
  step: string;
  pass: boolean;
  detail: string;
}

async function buildChecklist(): Promise<ChecklistItem[]> {
  const [accountCount, propertyCount, vendorCount, txnCount, categorizedCount, queuedCount, postedCount] =
    await Promise.all([
      prisma.account.count(),
      prisma.propertyClass.count(),
      prisma.vendor.count(),
      prisma.transaction.count(),
      prisma.categorization.count(),
      prisma.categorization.count({ where: { status: "QUEUED" } }),
      prisma.postedRecord.count({ where: { rolledBackAt: null } }),
    ]);
  const plReports = await allPropertyProfitAndLoss();
  const evalReport = await runEval();

  return [
    {
      step: "1. Chart of accounts + classes + vendors seeded",
      pass: accountCount > 0 && propertyCount === 3,
      detail: `${accountCount} accounts, ${propertyCount} properties, ${vendorCount} vendors`,
    },
    {
      step: "2. Bank-feed transactions staged",
      pass: txnCount >= 1000,
      detail: `${txnCount} transactions`,
    },
    {
      step: "3. Transactions categorized (rules -> LLM fallback -> queue)",
      pass: categorizedCount === txnCount,
      detail: `${categorizedCount}/${txnCount} categorized, ${queuedCount} currently queued for review`,
    },
    {
      step: "4. Approved transactions posted to QBO with Class tagging",
      pass: postedCount > 0,
      detail: `${postedCount} live (non-rolled-back) posted records`,
    },
    {
      step: "5. Per-property P&L available from Reports API",
      pass: plReports.length === 3,
      detail: plReports.map((r) => `${r.className}: net ${r.netIncome.toFixed(2)}`).join(" | "),
    },
    {
      step: "6. Eval harness run on labeled sample",
      pass: evalReport.sampleSize > 0,
      detail: `n=${evalReport.sampleSize}, classified accuracy ${(evalReport.classifiedAccuracy * 100).toFixed(1)}%, auto-posted ${(evalReport.autoPostedPct * 100).toFixed(1)}%`,
    },
  ];
}

export default async function ClosePage() {
  const checklist = await buildChecklist();
  const allPass = checklist.every((c) => c.pass);

  return (
    <div>
      <h1>Month-End Close Checklist</h1>
      <p>Same walkthrough as `npm run close` (scripts/monthEndClose.ts), rendered live from the current DB state.</p>
      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        {checklist.map((item) => (
          <li key={item.step} style={{ border: "1px solid #444", borderRadius: 8, padding: "1rem", marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 600 }}>
              <span style={{ color: item.pass ? "#4ade80" : "#f87171" }}>{item.pass ? "PASS" : "FAIL"}</span> — {item.step}
            </div>
            <div style={{ opacity: 0.8, fontSize: "0.9rem", marginTop: "0.25rem" }}>{item.detail}</div>
          </li>
        ))}
      </ul>
      <p style={{ fontWeight: 700 }}>Overall: {allPass ? "PASS" : "FAIL"}</p>
    </div>
  );
}

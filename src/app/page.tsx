import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [txnCount, categorizedCount, queuedCount, autoPostedCount, postedCount, propertyCount, ruleCount] =
    await Promise.all([
      prisma.transaction.count(),
      prisma.categorization.count(),
      prisma.categorization.count({ where: { status: "QUEUED" } }),
      prisma.categorization.count({ where: { status: "AUTO_POSTED" } }),
      prisma.categorization.count({ where: { status: "POSTED" } }),
      prisma.propertyClass.count(),
      prisma.rule.count({ where: { isActive: true } }),
    ]);

  const stats = [
    { label: "Properties (Classes)", value: propertyCount },
    { label: "Transactions staged", value: txnCount },
    { label: "Categorized", value: categorizedCount },
    { label: "Queued for review", value: queuedCount },
    { label: "Auto-posted (pending post run)", value: autoPostedCount },
    { label: "Posted to QBO", value: postedCount },
    { label: "Active rules", value: ruleCount },
  ];

  return (
    <div>
      <h1>AutoLedger</h1>
      <p>Landlord bookkeeping automation on the QuickBooks Online API resource shapes.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ border: "1px solid #444", borderRadius: 8, padding: "1rem" }}>
            <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>{s.label}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

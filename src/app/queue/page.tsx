import { prisma } from "@/lib/prisma";
import { acceptCategorization, correctCategorization, batchApproveHighConfidence } from "./actions";

export const dynamic = "force-dynamic";

async function batchApproveAction() {
  "use server";
  await batchApproveHighConfidence();
}

export default async function QueuePage() {
  const [queued, accounts, properties] = await Promise.all([
    prisma.categorization.findMany({
      where: { status: "QUEUED" },
      include: { transaction: true, account: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.propertyClass.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Review Queue</h1>
      <p>{queued.length} of the current queue shown (max 50 at a time). Accept keeps the proposed category; Correct overrides it and mints a new rule for next time.</p>
      <form action={batchApproveAction} style={{ margin: "1rem 0" }}>
        <button type="submit">Batch-approve all queued items at/above confidence threshold</button>
      </form>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
            <th>Date</th>
            <th>Vendor / Description</th>
            <th>Amount</th>
            <th>Proposed</th>
            <th>Confidence</th>
            <th>Rationale</th>
            <th>Correct to</th>
          </tr>
        </thead>
        <tbody>
          {queued.map((cat) => (
            <tr key={cat.id} style={{ borderBottom: "1px solid #333" }}>
              <td>{cat.transaction.date.toISOString().slice(0, 10)}</td>
              <td>{cat.transaction.rawVendorText}</td>
              <td>{cat.transaction.amount.toFixed(2)}</td>
              <td>{cat.account?.name ?? "(none)"}</td>
              <td>{(cat.confidence * 100).toFixed(0)}%</td>
              <td style={{ maxWidth: 260 }}>{cat.rationale}</td>
              <td>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const accountId = formData.get("accountId") as string;
                    const classId = formData.get("classId") as string;
                    if (accountId === "__accept__") {
                      await acceptCategorization(cat.id);
                    } else {
                      await correctCategorization(cat.id, accountId, classId);
                    }
                  }}
                  style={{ display: "flex", gap: "0.5rem" }}
                >
                  <select name="accountId" defaultValue={cat.accountId ?? undefined}>
                    {cat.accountId && <option value="__accept__">Accept as-is</option>}
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select name="classId" defaultValue={cat.classId ?? properties[0]?.id}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

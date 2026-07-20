import { allPropertyProfitAndLoss } from "@/reports/profitAndLoss";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await allPropertyProfitAndLoss();

  return (
    <div>
      <h1>Per-Property Profit &amp; Loss</h1>
      <p>Pulled from the QBO Reports API equivalent (LocalQBOClient.profitAndLoss) — reflects only non-rolled-back posted records.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginTop: "1.5rem" }}>
        {reports.map((r) => (
          <div key={r.classId} style={{ border: "1px solid #444", borderRadius: 8, padding: "1rem" }}>
            <h2>{r.className}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.accountName} style={{ borderBottom: "1px solid #333" }}>
                    <td>{row.accountName}</td>
                    <td style={{ textAlign: "right" }}>{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: "2px solid #666" }}>
                  <td>Net Income</td>
                  <td style={{ textAlign: "right" }}>{r.netIncome.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

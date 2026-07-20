/**
 * Per-property P&L pulled back from the QBO Reports API equivalent (spec
 * Phase 4: "per-property P&L pulled back from QBO Reports API").
 */
import { prisma } from "@/lib/prisma";
import { LocalQBOClient, type ProfitAndLossReport } from "@/post/qboClient";

export async function allPropertyProfitAndLoss(): Promise<ProfitAndLossReport[]> {
  const client = new LocalQBOClient();
  const properties = await prisma.propertyClass.findMany({ orderBy: { name: "asc" } });
  const reports: ProfitAndLossReport[] = [];
  for (const property of properties) {
    reports.push(await client.profitAndLoss(property.id));
  }
  return reports;
}

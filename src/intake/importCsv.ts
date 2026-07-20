/**
 * CSV -> Postgres, deduped on a stable hash (date+amount+description+property).
 * Spec Phase 1 verify: "re-import unchanged" — re-running this on the same CSV
 * must not create new rows or change row count.
 */
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { importHashFor, type GeneratedTxnRow } from "./generate";

export interface ImportResult {
  totalRows: number;
  inserted: number;
  skippedDuplicates: number;
}

export function parseCsv(csvText: string): GeneratedTxnRow[] {
  const records: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true });
  return records.map((r) => ({
    date: r.date,
    amount: Number(r.amount),
    description: r.description,
    rawVendorText: r.rawVendorText,
    propertyQboId: r.propertyQboId,
    tenantQboId: r.tenantQboId || null,
    groundTruthCategory: r.groundTruthCategory,
    vendorQboId: r.vendorQboId || null,
    batchLabel: r.batchLabel,
  }));
}

export async function importTransactions(rows: GeneratedTxnRow[]): Promise<ImportResult> {
  const properties = await prisma.propertyClass.findMany();
  const propertyByQboId = new Map(properties.map((p) => [p.qboId, p]));
  const vendors = await prisma.vendor.findMany();
  const vendorByQboId = new Map(vendors.map((v) => [v.qboId, v]));
  const customers = await prisma.customer.findMany();
  const customerByQboId = new Map(customers.map((c) => [c.qboId, c]));

  let inserted = 0;
  let skippedDuplicates = 0;

  for (const row of rows) {
    const importHash = importHashFor(row);
    const existing = await prisma.transaction.findUnique({ where: { importHash } });
    if (existing) {
      skippedDuplicates++;
      continue;
    }
    const property = propertyByQboId.get(row.propertyQboId);
    await prisma.transaction.create({
      data: {
        importHash,
        date: new Date(row.date),
        amount: row.amount,
        description: row.description,
        rawVendorText: row.rawVendorText,
        vendorId: row.vendorQboId ? vendorByQboId.get(row.vendorQboId)?.id : undefined,
        tenantId: row.tenantQboId ? customerByQboId.get(row.tenantQboId)?.id : undefined,
        batchLabel: row.batchLabel,
        groundTruthCategory: row.groundTruthCategory,
        groundTruthClassId: property?.id,
      },
    });
    inserted++;
  }

  return { totalRows: rows.length, inserted, skippedDuplicates };
}

/**
 * Marks a stratified 300-txn subset as the labeled eval set (spec Phase 2:
 * "300-txn hand-labeled eval set"). Ground truth for these rows comes from the
 * generator, i.e. is already "labeled" -- this function just selects and flags
 * a fixed-size, per-category-balanced sample so every category is represented.
 */
export async function markEvalSample(targetSize = 300): Promise<number> {
  await prisma.transaction.updateMany({ data: { isEvalSample: false } });
  const categories = await prisma.transaction.groupBy({
    by: ["groundTruthCategory"],
    _count: { groundTruthCategory: true },
  });
  const perCategoryTarget = Math.max(1, Math.floor(targetSize / categories.length));
  let marked = 0;
  for (const cat of categories) {
    const ids = await prisma.transaction.findMany({
      where: { groundTruthCategory: cat.groundTruthCategory },
      select: { id: true },
      take: perCategoryTarget,
      orderBy: { createdAt: "asc" },
    });
    if (ids.length === 0) continue;
    await prisma.transaction.updateMany({
      where: { id: { in: ids.map((i) => i.id) } },
      data: { isEvalSample: true },
    });
    marked += ids.length;
  }
  // Top up to exactly targetSize (or as close as data allows) from whatever's left.
  if (marked < targetSize) {
    const extra = await prisma.transaction.findMany({
      where: { isEvalSample: false },
      select: { id: true },
      take: targetSize - marked,
      orderBy: { createdAt: "asc" },
    });
    await prisma.transaction.updateMany({
      where: { id: { in: extra.map((i) => i.id) } },
      data: { isEvalSample: true },
    });
    marked += extra.length;
  }
  return marked;
}

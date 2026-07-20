/**
 * QBOClient — the QuickBooks Online v3 REST resource shapes this project needs.
 *
 * LocalQBOClient (below) implements this against our own Postgres tables, so the
 * posting engine, idempotency, and Reports logic are all real and tested. A real
 * IntuitQBOClient would implement the exact same interface against
 * https://sandbox-quickbooks.api.intuit.com using intuit-oauth for the token —
 * see IntuitQBOClient stub at the bottom for what that swap looks like. No Intuit
 * developer account was created for this build (see PLAN.md / RESULTS.md), so
 * IntuitQBOClient is never exercised.
 */
import { prisma } from "@/lib/prisma";
import type { PostedType } from "@prisma/client";

export interface PostInput {
  qboDocId: string; // external ref used for idempotency (spec: "external ref ids")
  transactionId: string;
  batchId: string;
  postedType: PostedType;
  accountId: string;
  classId: string;
  amount: number;
  memo: string;
}

export interface PostResult {
  qboDocId: string;
  created: boolean; // false when this was an idempotent no-op (already posted)
}

export interface ProfitAndLossRow {
  accountName: string;
  accountType: string;
  amount: number;
}

export interface ProfitAndLossReport {
  classId: string;
  className: string;
  rows: ProfitAndLossRow[];
  netIncome: number;
}

export interface QBOClient {
  /** Idempotent: posting the same qboDocId twice never creates a duplicate row. */
  post(input: PostInput): Promise<PostResult>;
  /** Reverses every PostedRecord in a batch that hasn't already been rolled back. */
  rollbackBatch(batchId: string): Promise<{ reversed: number }>;
  /** QBO "Reports API" equivalent: per-property Profit & Loss. */
  profitAndLoss(classId: string): Promise<ProfitAndLossReport>;
}

export class LocalQBOClient implements QBOClient {
  async post(input: PostInput): Promise<PostResult> {
    const existing = await prisma.postedRecord.findUnique({
      where: { qboDocId: input.qboDocId },
    });
    if (existing && !existing.rolledBackAt) {
      return { qboDocId: input.qboDocId, created: false };
    }
    if (existing && existing.rolledBackAt) {
      // A previously-rolled-back doc id is being re-posted: update in place rather
      // than violate the unique constraint on qboDocId.
      await prisma.postedRecord.update({
        where: { qboDocId: input.qboDocId },
        data: {
          batchId: input.batchId,
          postedType: input.postedType,
          accountId: input.accountId,
          classId: input.classId,
          amount: input.amount,
          memo: input.memo,
          postedAt: new Date(),
          rolledBackAt: null,
        },
      });
      return { qboDocId: input.qboDocId, created: true };
    }
    await prisma.postedRecord.create({
      data: {
        qboDocId: input.qboDocId,
        transactionId: input.transactionId,
        batchId: input.batchId,
        postedType: input.postedType,
        accountId: input.accountId,
        classId: input.classId,
        amount: input.amount,
        memo: input.memo,
      },
    });
    return { qboDocId: input.qboDocId, created: true };
  }

  async rollbackBatch(batchId: string): Promise<{ reversed: number }> {
    const result = await prisma.postedRecord.updateMany({
      where: { batchId, rolledBackAt: null },
      data: { rolledBackAt: new Date() },
    });
    await prisma.batch.update({
      where: { id: batchId },
      data: { rolledBackAt: new Date() },
    });
    return { reversed: result.count };
  }

  async profitAndLoss(classId: string): Promise<ProfitAndLossReport> {
    const propertyClass = await prisma.propertyClass.findUniqueOrThrow({
      where: { id: classId },
    });
    const records = await prisma.postedRecord.findMany({
      where: { classId, rolledBackAt: null },
      include: { account: true },
    });
    const byAccount = new Map<string, ProfitAndLossRow>();
    for (const rec of records) {
      const key = rec.account.name;
      const row =
        byAccount.get(key) ??
        ({
          accountName: rec.account.name,
          accountType: rec.account.accountType,
          amount: 0,
        } as ProfitAndLossRow);
      row.amount += rec.amount;
      byAccount.set(key, row);
    }
    const rows = Array.from(byAccount.values()).sort((a, b) =>
      a.accountName.localeCompare(b.accountName)
    );
    const netIncome = rows.reduce((sum, r) => sum + r.amount, 0);
    return { classId, className: propertyClass.name, rows, netIncome };
  }
}

/**
 * Stub only — never instantiated or called in this build. Shows exactly what the
 * production adapter would look like: same QBOClient interface, but hitting
 * Intuit's real sandbox REST API with an OAuth2 bearer token from intuit-oauth.
 * Building this out requires an Intuit Developer account (hosted signup), which
 * this build environment intentionally does not create (see PLAN.md).
 */
export class IntuitQBOClient implements QBOClient {
  constructor(
    private readonly realmId: string,
    private readonly accessToken: string,
    private readonly baseUrl = "https://sandbox-quickbooks.api.intuit.com"
  ) {}

  async post(_input: PostInput): Promise<PostResult> {
    throw new Error(
      "IntuitQBOClient is a design stub: no Intuit developer account was created " +
        "for this build. Use LocalQBOClient for all local runs/tests."
    );
  }
  async rollbackBatch(_batchId: string): Promise<{ reversed: number }> {
    throw new Error("IntuitQBOClient stub — not implemented, see class doc comment.");
  }
  async profitAndLoss(_classId: string): Promise<ProfitAndLossReport> {
    throw new Error("IntuitQBOClient stub — not implemented, see class doc comment.");
  }
}

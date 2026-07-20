/**
 * Faker-based synthetic bank-feed generator. Produces realistic landlord
 * transactions (spec Phase 1: "1,000+ realistic landlord transactions across
 * personas") with a known ground-truth category/property for later eval.
 */
import { faker } from "@faker-js/faker";
import { PERSONAS, type Persona } from "./personas";
import { PROPERTIES } from "@/seed/chart";
import crypto from "node:crypto";

export interface GeneratedTxnRow {
  date: string; // ISO date, no time
  amount: number; // signed: + deposit, - purchase
  description: string;
  rawVendorText: string;
  propertyQboId: string;
  tenantQboId: string | null;
  groundTruthCategory: string;
  vendorQboId: string | null;
  batchLabel: string;
}

const YEARS_OF_HISTORY = 4;

function renderTemplate(template: string, propertyIdx: number): string {
  const tenant = PROPERTIES[propertyIdx].tenantName.split(" (")[0].toUpperCase();
  return template
    .replace("{TENANT}", tenant)
    .replace("{STORE}", faker.number.int({ min: 1000, max: 9999 }).toString())
    .replace("{CITY}", faker.helpers.arrayElement(["AUSTIN", "ROUND ROCK", "PFLUGERVILLE"]))
    .replace("{CHECKNO}", faker.number.int({ min: 1001, max: 1999 }).toString())
    .replace("{COMPANY}", faker.company.name().toUpperCase().replace(/[^A-Z0-9 ]/g, ""));
}

function randomDateWithinYears(years: number): Date {
  const now = Date.now();
  const start = now - years * 365 * 24 * 60 * 60 * 1000;
  return new Date(faker.number.int({ min: start, max: now }));
}

function generateForPersonaAtProperty(
  persona: Persona,
  propertyIdx: number,
  batchLabel: string
): GeneratedTxnRow[] {
  const rows: GeneratedTxnRow[] = [];
  const count = Math.round(persona.occurrencesPerYear * YEARS_OF_HISTORY);
  // Recurring templates get a semi-stable "anchor" amount that jitters only a
  // little (a real recurring bill), one-off personas jitter across the full range.
  const anchorAmount = persona.isRecurring
    ? faker.number.float({ min: persona.amountMin, max: persona.amountMax, fractionDigits: 2 })
    : null;

  for (let i = 0; i < count; i++) {
    const amountMagnitude = persona.isRecurring
      ? Math.max(
          persona.amountMin,
          Math.min(persona.amountMax, (anchorAmount as number) * faker.number.float({ min: 0.95, max: 1.05 }))
        )
      : faker.number.float({ min: persona.amountMin, max: persona.amountMax, fractionDigits: 2 });

    const signedAmount = persona.direction === "IN" ? amountMagnitude : -amountMagnitude;
    const rawVendorText = renderTemplate(faker.helpers.arrayElement(persona.vendorTextTemplates), propertyIdx);

    rows.push({
      date: randomDateWithinYears(YEARS_OF_HISTORY).toISOString().slice(0, 10),
      amount: Math.round(signedAmount * 100) / 100,
      description: rawVendorText,
      rawVendorText,
      propertyQboId: PROPERTIES[propertyIdx].qboId,
      tenantQboId: persona.isTenantRent ? PROPERTIES[propertyIdx].tenantQboId : null,
      groundTruthCategory: persona.groundTruthCategory,
      vendorQboId: persona.vendorQboId ?? null,
      batchLabel,
    });
  }
  return rows;
}

export function generateTransactions(batchLabel = "synthetic-v1", seed?: number): GeneratedTxnRow[] {
  if (seed !== undefined) faker.seed(seed);
  const rows: GeneratedTxnRow[] = [];
  for (let propertyIdx = 0; propertyIdx < PROPERTIES.length; propertyIdx++) {
    for (const persona of PERSONAS) {
      rows.push(...generateForPersonaAtProperty(persona, propertyIdx, batchLabel));
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/** Stable dedupe key: date+amount+description+property. Same CSV re-imported => same hashes. */
export function importHashFor(row: Pick<GeneratedTxnRow, "date" | "amount" | "description" | "propertyQboId">): string {
  const raw = `${row.date}|${row.amount.toFixed(2)}|${row.description.trim().toUpperCase()}|${row.propertyQboId}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

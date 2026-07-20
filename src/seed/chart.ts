/**
 * Setup-as-code: rental-real-estate chart of accounts, 3 property Classes,
 * vendors, and tenant customers. Idempotent — re-running upserts, never duplicates
 * (spec Phase 1 verify: "re-import unchanged").
 */
import { prisma } from "@/lib/prisma";
import type { AccountType } from "@prisma/client";

export interface ChartAccountSeed {
  qboId: string;
  name: string;
  accountType: AccountType;
  detailType: string;
}

export const CHART_OF_ACCOUNTS: ChartAccountSeed[] = [
  { qboId: "ACC-1000", name: "Operating Bank Account", accountType: "BANK", detailType: "Checking" },
  { qboId: "ACC-4000", name: "Rent Income", accountType: "INCOME", detailType: "RentalIncome" },
  { qboId: "ACC-4100", name: "Late Fee Income", accountType: "INCOME", detailType: "OtherIncome" },
  { qboId: "ACC-5000", name: "Repairs & Maintenance", accountType: "EXPENSE", detailType: "RepairMaintenance" },
  { qboId: "ACC-5100", name: "CAM (Common Area Maintenance)", accountType: "EXPENSE", detailType: "OfficeGeneralAdministrativeExpenses" },
  { qboId: "ACC-5200", name: "Insurance", accountType: "EXPENSE", detailType: "Insurance" },
  { qboId: "ACC-5300", name: "Property Tax", accountType: "EXPENSE", detailType: "TaxesPaid" },
  { qboId: "ACC-5400", name: "Mortgage Interest", accountType: "EXPENSE", detailType: "Insurance" },
  { qboId: "ACC-5500", name: "Utilities", accountType: "EXPENSE", detailType: "Utilities" },
  { qboId: "ACC-5600", name: "Landscaping & Grounds", accountType: "EXPENSE", detailType: "RepairMaintenance" },
  { qboId: "ACC-5700", name: "Pest Control", accountType: "EXPENSE", detailType: "RepairMaintenance" },
  { qboId: "ACC-5800", name: "Bank Fees", accountType: "EXPENSE", detailType: "BankCharges" },
  { qboId: "ACC-9000", name: "Owner Transfers", accountType: "OTHER_CURRENT_LIABILITY", detailType: "OtherCurrentLiabilities" },
];

export interface PropertySeed {
  qboId: string;
  name: string;
  address: string;
  tenantQboId: string;
  tenantName: string;
}

export const PROPERTIES: PropertySeed[] = [
  { qboId: "CLS-100", name: "123 Maple St Duplex", address: "123 Maple St, Austin, TX", tenantQboId: "CUST-100", tenantName: "J. Ramirez (123 Maple St, Unit A)" },
  { qboId: "CLS-200", name: "456 Oak Ave Fourplex", address: "456 Oak Ave, Austin, TX", tenantQboId: "CUST-200", tenantName: "S. Chen (456 Oak Ave, Unit 2)" },
  { qboId: "CLS-300", name: "789 Pine Rd SFH", address: "789 Pine Rd, Round Rock, TX", tenantQboId: "CUST-300", tenantName: "M. Patel (789 Pine Rd)" },
];

export interface VendorSeed {
  qboId: string;
  name: string;
  displayNames: string[];
}

export const VENDORS: VendorSeed[] = [
  { qboId: "VEND-HD", name: "Home Depot", displayNames: ["THE HOME DEPOT #", "HOME DEPOT INC", "HD SUPPLY"] },
  { qboId: "VEND-LOWES", name: "Lowe's", displayNames: ["LOWES #", "LOWE'S HOME CENTERS"] },
  { qboId: "VEND-CITYWATER", name: "City of Austin Utilities", displayNames: ["CITY OF AUSTIN UTIL", "AUSTIN ENERGY"] },
  { qboId: "VEND-STATEFARM", name: "State Farm Insurance", displayNames: ["STATE FARM INS", "STATEFARM"] },
  { qboId: "VEND-COUNTYTAX", name: "Travis County Tax Office", displayNames: ["TRAVIS CO TAX", "TRAVIS COUNTY TAX OFFICE"] },
  { qboId: "VEND-WELLSFARGO", name: "Wells Fargo Mortgage", displayNames: ["WELLS FARGO HOME MTG", "WF MORTGAGE"] },
  { qboId: "VEND-TRUGREEN", name: "TruGreen Lawn Care", displayNames: ["TRUGREEN", "TRU GREEN LAWN"] },
  { qboId: "VEND-ORKIN", name: "Orkin Pest Control", displayNames: ["ORKIN PEST", "ORKIN LLC"] },
  { qboId: "VEND-BANKFEE", name: "Bank Service Fee", displayNames: ["MONTHLY SERVICE FEE", "OVERDRAFT FEE", "WIRE FEE"] },
  { qboId: "VEND-HANDYMAN", name: "Reliable Handyman LLC", displayNames: ["RELIABLE HANDYMAN", "HANDYMAN SVC"] },
];

export async function seedChartOfAccounts() {
  const accounts = await Promise.all(
    CHART_OF_ACCOUNTS.map((a) =>
      prisma.account.upsert({
        where: { qboId: a.qboId },
        update: { name: a.name, accountType: a.accountType, detailType: a.detailType },
        create: a,
      })
    )
  );
  return accounts;
}

export async function seedPropertiesAndTenants() {
  const results = [];
  for (const p of PROPERTIES) {
    const propertyClass = await prisma.propertyClass.upsert({
      where: { qboId: p.qboId },
      update: { name: p.name, address: p.address },
      create: { qboId: p.qboId, name: p.name, address: p.address },
    });
    const tenant = await prisma.customer.upsert({
      where: { qboId: p.tenantQboId },
      update: { name: p.tenantName, propertyClassId: propertyClass.id },
      create: {
        qboId: p.tenantQboId,
        name: p.tenantName,
        propertyClassId: propertyClass.id,
      },
    });
    results.push({ propertyClass, tenant });
  }
  return results;
}

export async function seedVendors() {
  return Promise.all(
    VENDORS.map((v) =>
      prisma.vendor.upsert({
        where: { qboId: v.qboId },
        update: { name: v.name, displayNames: v.displayNames },
        create: v,
      })
    )
  );
}

export async function seedAll() {
  const accounts = await seedChartOfAccounts();
  const properties = await seedPropertiesAndTenants();
  const vendors = await seedVendors();
  return { accounts, properties, vendors };
}

/**
 * Persona definitions for the synthetic bank-feed generator. Each persona
 * describes a recurring or one-off cash-flow pattern a small landlord's bank
 * feed actually shows. `groundTruthCategory` is the Account.name it should be
 * categorized to; used only by the eval/generator, never by the categorizer.
 */
export type Direction = "IN" | "OUT";

export interface Persona {
  key: string;
  groundTruthCategory: string;
  direction: Direction;
  /** Vendor text variants as they'd actually appear on a bank feed. */
  vendorTextTemplates: string[];
  amountMin: number;
  amountMax: number;
  /** Roughly how many times this persona fires per property per year. */
  occurrencesPerYear: number;
  /** True => amount is close to fixed each time (a "recurring template"). */
  isRecurring: boolean;
  vendorQboId?: string; // links to a seeded Vendor, if any
  isTenantRent?: boolean; // links to the property's tenant Customer
}

export const PERSONAS: Persona[] = [
  {
    key: "rent_deposit",
    groundTruthCategory: "Rent Income",
    direction: "IN",
    vendorTextTemplates: ["ACH DEPOSIT RENT {TENANT}", "ONLINE RENT PMT {TENANT}", "ZELLE FROM {TENANT} RENT"],
    amountMin: 1450,
    amountMax: 2450,
    occurrencesPerYear: 12,
    isRecurring: true,
    isTenantRent: true,
  },
  {
    key: "late_fee",
    groundTruthCategory: "Late Fee Income",
    direction: "IN",
    vendorTextTemplates: ["LATE FEE {TENANT}", "ONLINE LATE FEE PMT {TENANT}"],
    amountMin: 50,
    amountMax: 125,
    occurrencesPerYear: 2,
    isRecurring: false,
    isTenantRent: true,
  },
  {
    key: "home_depot",
    groundTruthCategory: "Repairs & Maintenance",
    direction: "OUT",
    vendorTextTemplates: ["THE HOME DEPOT #{STORE} {CITY} TX", "HOME DEPOT INC {CITY}"],
    amountMin: 12,
    amountMax: 480,
    occurrencesPerYear: 10,
    isRecurring: false,
    vendorQboId: "VEND-HD",
  },
  {
    key: "lowes",
    groundTruthCategory: "Repairs & Maintenance",
    direction: "OUT",
    vendorTextTemplates: ["LOWES #{STORE} {CITY} TX", "LOWE'S HOME CENTERS {CITY}"],
    amountMin: 15,
    amountMax: 350,
    occurrencesPerYear: 6,
    isRecurring: false,
    vendorQboId: "VEND-LOWES",
  },
  {
    key: "handyman",
    groundTruthCategory: "Repairs & Maintenance",
    direction: "OUT",
    vendorTextTemplates: ["RELIABLE HANDYMAN CHECK #{CHECKNO}", "RELIABLE HANDYMAN LLC ACH"],
    amountMin: 80,
    amountMax: 650,
    occurrencesPerYear: 5,
    isRecurring: false,
    vendorQboId: "VEND-HANDYMAN",
  },
  {
    key: "utility_autopay",
    groundTruthCategory: "Utilities",
    direction: "OUT",
    vendorTextTemplates: ["CITY OF AUSTIN UTIL AUTOPAY", "AUSTIN ENERGY AUTOPAY DEBIT"],
    amountMin: 60,
    amountMax: 240,
    occurrencesPerYear: 12,
    isRecurring: true,
    vendorQboId: "VEND-CITYWATER",
  },
  {
    key: "insurance",
    groundTruthCategory: "Insurance",
    direction: "OUT",
    vendorTextTemplates: ["STATE FARM INS PREMIUM ACH", "STATEFARM INSURANCE AUTOPAY"],
    amountMin: 110,
    amountMax: 260,
    occurrencesPerYear: 12,
    isRecurring: true,
    vendorQboId: "VEND-STATEFARM",
  },
  {
    key: "property_tax",
    groundTruthCategory: "Property Tax",
    direction: "OUT",
    vendorTextTemplates: ["TRAVIS CO TAX OFFICE PMT", "TRAVIS COUNTY TAX OFFICE ACH"],
    amountMin: 900,
    amountMax: 2600,
    occurrencesPerYear: 2,
    isRecurring: true,
    vendorQboId: "VEND-COUNTYTAX",
  },
  {
    key: "mortgage_interest",
    groundTruthCategory: "Mortgage Interest",
    direction: "OUT",
    vendorTextTemplates: ["WELLS FARGO HOME MTG ACH DEBIT", "WF MORTGAGE PYMT ACH"],
    amountMin: 700,
    amountMax: 1450,
    occurrencesPerYear: 12,
    isRecurring: true,
    vendorQboId: "VEND-WELLSFARGO",
  },
  {
    key: "landscaping",
    groundTruthCategory: "Landscaping & Grounds",
    direction: "OUT",
    vendorTextTemplates: ["TRUGREEN LAWN CARE ACH", "TRU GREEN LAWN SVC DEBIT"],
    amountMin: 45,
    amountMax: 120,
    occurrencesPerYear: 12,
    isRecurring: true,
    vendorQboId: "VEND-TRUGREEN",
  },
  {
    key: "pest_control",
    groundTruthCategory: "Pest Control",
    direction: "OUT",
    vendorTextTemplates: ["ORKIN PEST CONTROL ACH", "ORKIN LLC AUTOPAY"],
    amountMin: 40,
    amountMax: 95,
    occurrencesPerYear: 4,
    isRecurring: true,
    vendorQboId: "VEND-ORKIN",
  },
  {
    key: "bank_fee",
    groundTruthCategory: "Bank Fees",
    direction: "OUT",
    vendorTextTemplates: ["MONTHLY SERVICE FEE", "OVERDRAFT FEE", "WIRE TRANSFER FEE"],
    amountMin: 10,
    amountMax: 35,
    occurrencesPerYear: 3,
    isRecurring: false,
    vendorQboId: "VEND-BANKFEE",
  },
  {
    key: "cam_supplies",
    groundTruthCategory: "CAM (Common Area Maintenance)",
    direction: "OUT",
    vendorTextTemplates: ["ACE HARDWARE #{STORE} CAM SUPPLIES", "COSTCO WHOLESALE CAM SUPPLIES"],
    amountMin: 20,
    amountMax: 180,
    occurrencesPerYear: 6,
    isRecurring: false,
  },
  {
    key: "owner_transfer",
    groundTruthCategory: "Owner Transfers",
    direction: "OUT",
    vendorTextTemplates: ["ACH TRANSFER TO OWNER SAVINGS", "ONLINE XFER TO PERSONAL ACCT"],
    amountMin: 200,
    amountMax: 1200,
    occurrencesPerYear: 10,
    isRecurring: false,
  },
  // "Unknown vendor" personas: a new/one-off contractor whose name isn't in any
  // seeded rule keyword table, on purpose -- these are realistic (a landlord
  // occasionally uses a new handyman/supplier) and exercise the "no rule
  // matched" -> LLM-fallback-or-queue path that a rules-only system can't cover.
  {
    key: "misc_repair_unknown_vendor",
    groundTruthCategory: "Repairs & Maintenance",
    direction: "OUT",
    vendorTextTemplates: ["{COMPANY} ACH DEBIT", "CHECK #{CHECKNO} {COMPANY}"],
    amountMin: 60,
    amountMax: 500,
    occurrencesPerYear: 6,
    isRecurring: false,
  },
  {
    key: "misc_cam_unknown_vendor",
    groundTruthCategory: "CAM (Common Area Maintenance)",
    direction: "OUT",
    vendorTextTemplates: ["{COMPANY} SUPPLY CO DEBIT", "{COMPANY} ACH PURCHASE"],
    amountMin: 25,
    amountMax: 150,
    occurrencesPerYear: 4,
    isRecurring: false,
  },
];

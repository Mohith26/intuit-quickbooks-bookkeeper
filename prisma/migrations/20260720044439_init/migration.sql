-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INCOME', 'EXPENSE', 'BANK', 'OTHER_CURRENT_LIABILITY', 'EQUITY');

-- CreateEnum
CREATE TYPE "PostedType" AS ENUM ('PURCHASE', 'DEPOSIT', 'JOURNAL_ENTRY');

-- CreateEnum
CREATE TYPE "CategorizationMethod" AS ENUM ('RULE', 'LLM', 'NONE');

-- CreateEnum
CREATE TYPE "CategorizationStatus" AS ENUM ('QUEUED', 'AUTO_POSTED', 'APPROVED', 'CORRECTED', 'POSTED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "detailType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyClass" (
    "id" TEXT NOT NULL,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayNames" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "qboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "importHash" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "rawVendorText" TEXT NOT NULL,
    "vendorId" TEXT,
    "tenantId" TEXT,
    "batchLabel" TEXT NOT NULL,
    "groundTruthCategory" TEXT NOT NULL,
    "groundTruthClassId" TEXT,
    "isEvalSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorization" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "method" "CategorizationMethod" NOT NULL,
    "accountId" TEXT,
    "classId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "ruleId" TEXT,
    "status" "CategorizationStatus" NOT NULL DEFAULT 'QUEUED',
    "correctedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "isRegex" BOOLEAN NOT NULL DEFAULT true,
    "accountId" TEXT NOT NULL,
    "classId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mintedFromCorrection" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostedRecord" (
    "id" TEXT NOT NULL,
    "qboDocId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "postedType" "PostedType" NOT NULL,
    "accountId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "memo" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "PostedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_qboId_key" ON "Account"("qboId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyClass_qboId_key" ON "PropertyClass"("qboId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyClass_name_key" ON "PropertyClass"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_qboId_key" ON "Vendor"("qboId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_qboId_key" ON "Customer"("qboId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_importHash_key" ON "Transaction"("importHash");

-- CreateIndex
CREATE UNIQUE INDEX "Categorization_transactionId_key" ON "Categorization"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PostedRecord_qboDocId_key" ON "PostedRecord"("qboDocId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_propertyClassId_fkey" FOREIGN KEY ("propertyClassId") REFERENCES "PropertyClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_classId_fkey" FOREIGN KEY ("classId") REFERENCES "PropertyClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "PropertyClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostedRecord" ADD CONSTRAINT "PostedRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostedRecord" ADD CONSTRAINT "PostedRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostedRecord" ADD CONSTRAINT "PostedRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "PropertyClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

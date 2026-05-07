-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Drug" (
    "id" TEXT NOT NULL,
    "kfdaCode" TEXT,
    "itemSeq" TEXT,
    "productName" TEXT NOT NULL,
    "ingredient" TEXT,
    "manufacturer" TEXT,
    "atc" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "approvalDate" TIMESTAMP(3),
    "approvalType" TEXT,
    "indication" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "drugId" TEXT,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "parser" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Drug_kfdaCode_key" ON "Drug"("kfdaCode");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_itemSeq_key" ON "Drug"("itemSeq");

-- CreateIndex
CREATE INDEX "Drug_productName_idx" ON "Drug"("productName");

-- CreateIndex
CREATE INDEX "Drug_ingredient_idx" ON "Drug"("ingredient");

-- CreateIndex
CREATE INDEX "Approval_region_approvalDate_idx" ON "Approval"("region", "approvalDate");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_drugId_region_key" ON "Approval"("drugId", "region");

-- CreateIndex
CREATE INDEX "SourceDocument_source_fetchedAt_idx" ON "SourceDocument"("source", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_source_contentHash_key" ON "SourceDocument"("source", "contentHash");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

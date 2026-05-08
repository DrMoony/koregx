-- v0.2 pivot: drop drug catalog tables, create law/interpretation primary
DROP TABLE IF EXISTS "Approval" CASCADE;
DROP TABLE IF EXISTS "Drug" CASCADE;
DROP TABLE IF EXISTS "SourceDocument" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";
-- CreateTable
CREATE TABLE "Law" (
    "id" TEXT NOT NULL,
    "mst" TEXT NOT NULL,
    "lawId" TEXT NOT NULL,
    "nameKor" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyCode" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "promulgationDate" TIMESTAMP(3),
    "promulgationNo" TEXT,
    "amendmentType" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'healthcare',
    "rawData" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Law_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LawArticle" (
    "id" TEXT NOT NULL,
    "lawId" TEXT NOT NULL,
    "articleNo" TEXT NOT NULL,
    "articleSubNo" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "changedFlag" BOOLEAN NOT NULL DEFAULT false,
    "rawData" JSONB,
    CONSTRAINT "LawArticle_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LegalInterpretation" (
    "id" TEXT NOT NULL,
    "ipNo" TEXT NOT NULL,
    "caseNo" TEXT,
    "title" TEXT NOT NULL,
    "inquirer" TEXT,
    "respondent" TEXT NOT NULL,
    "responseDate" TIMESTAMP(3),
    "body" TEXT NOT NULL,
    "bodyEmbedding" vector(768),
    "lawId" TEXT,
    "rawData" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalInterpretation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AdminRule" (
    "id" TEXT NOT NULL,
    "arNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "promulgationDate" TIMESTAMP(3),
    "amendmentCode" TEXT,
    "body" TEXT,
    "bodyEmbedding" vector(768),
    "rawData" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminRule_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "HiraDecision" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "meetingNo" INTEGER,
    "agendaNo" INTEGER,
    "agenda" TEXT NOT NULL,
    "drug" TEXT,
    "ingredient" TEXT,
    "ruling" TEXT NOT NULL,
    "rationale" TEXT,
    "rationaleEmbed" vector(768),
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "rawData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HiraDecision_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "MfdsRuling" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyEmbedding" vector(768),
    "category" TEXT,
    "responseDate" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "rawData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfdsRuling_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "srcType" TEXT NOT NULL,
    "srcId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "refLawShortName" TEXT,
    "refArticleNo" TEXT,
    "rawText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "parser" TEXT,
    "metadata" JSONB,
    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "Law_mst_key" ON "Law"("mst");
-- CreateIndex
CREATE INDEX "Law_nameKor_idx" ON "Law"("nameKor");
-- CreateIndex
CREATE INDEX "Law_effectiveDate_idx" ON "Law"("effectiveDate");
-- CreateIndex
CREATE INDEX "LawArticle_lawId_idx" ON "LawArticle"("lawId");
-- CreateIndex
CREATE UNIQUE INDEX "LawArticle_lawId_articleNo_articleSubNo_key" ON "LawArticle"("lawId", "articleNo", "articleSubNo");
-- CreateIndex
CREATE UNIQUE INDEX "LegalInterpretation_ipNo_key" ON "LegalInterpretation"("ipNo");
-- CreateIndex
CREATE INDEX "LegalInterpretation_title_idx" ON "LegalInterpretation"("title");
-- CreateIndex
CREATE INDEX "LegalInterpretation_responseDate_idx" ON "LegalInterpretation"("responseDate");
-- CreateIndex
CREATE UNIQUE INDEX "AdminRule_arNo_key" ON "AdminRule"("arNo");
-- CreateIndex
CREATE INDEX "AdminRule_name_idx" ON "AdminRule"("name");
-- CreateIndex
CREATE INDEX "AdminRule_agencyName_idx" ON "AdminRule"("agencyName");
-- CreateIndex
CREATE INDEX "AdminRule_promulgationDate_idx" ON "AdminRule"("promulgationDate");
-- CreateIndex
CREATE INDEX "HiraDecision_body_meetingDate_idx" ON "HiraDecision"("body", "meetingDate");
-- CreateIndex
CREATE INDEX "HiraDecision_drug_idx" ON "HiraDecision"("drug");
-- CreateIndex
CREATE INDEX "HiraDecision_ingredient_idx" ON "HiraDecision"("ingredient");
-- CreateIndex
CREATE UNIQUE INDEX "HiraDecision_sourceHash_agendaNo_key" ON "HiraDecision"("sourceHash", "agendaNo");
-- CreateIndex
CREATE UNIQUE INDEX "MfdsRuling_externalId_key" ON "MfdsRuling"("externalId");
-- CreateIndex
CREATE INDEX "MfdsRuling_title_idx" ON "MfdsRuling"("title");
-- CreateIndex
CREATE INDEX "MfdsRuling_category_responseDate_idx" ON "MfdsRuling"("category", "responseDate");
-- CreateIndex
CREATE INDEX "Citation_srcType_srcId_idx" ON "Citation"("srcType", "srcId");
-- CreateIndex
CREATE INDEX "Citation_refType_refId_idx" ON "Citation"("refType", "refId");
-- CreateIndex
CREATE INDEX "SourceDocument_source_fetchedAt_idx" ON "SourceDocument"("source", "fetchedAt");
-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_source_contentHash_key" ON "SourceDocument"("source", "contentHash");
-- AddForeignKey
ALTER TABLE "LawArticle" ADD CONSTRAINT "LawArticle_lawId_fkey" FOREIGN KEY ("lawId") REFERENCES "Law"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LegalInterpretation" ADD CONSTRAINT "LegalInterpretation_lawId_fkey" FOREIGN KEY ("lawId") REFERENCES "Law"("id") ON DELETE SET NULL ON UPDATE CASCADE;

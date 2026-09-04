-- AlterTable: número sequencial legível do chamado (#1, #2, ...)
ALTER TABLE "tickets" ADD COLUMN "number" INTEGER;

-- Backfill: numera os chamados existentes em ordem de abertura
WITH ordenados AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rn
    FROM "tickets"
)
UPDATE "tickets" t
SET "number" = o.rn
FROM ordenados o
WHERE t."id" = o."id";

-- Sequência equivalente a @default(autoincrement()), continuando de onde o backfill parou
CREATE SEQUENCE "tickets_number_seq";
SELECT setval('"tickets_number_seq"', COALESCE((SELECT MAX("number") FROM "tickets"), 0) + 1, false);
ALTER TABLE "tickets" ALTER COLUMN "number" SET DEFAULT nextval('"tickets_number_seq"');
ALTER TABLE "tickets" ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "tickets_number_seq" OWNED BY "tickets"."number";

-- AlterTable: texto de encerramento gravado no próprio chamado
ALTER TABLE "tickets" ADD COLUMN "resolution" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tickets_number_key" ON "tickets"("number");
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");
CREATE INDEX "tickets_openedById_idx" ON "tickets"("openedById");

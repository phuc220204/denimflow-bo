-- AlterTable: step_quantity_entries add outsourced columns (BR-09)
ALTER TABLE "step_quantity_entries" ADD COLUMN IF NOT EXISTS "qty_sent" INTEGER;
ALTER TABLE "step_quantity_entries" ADD COLUMN IF NOT EXISTS "qty_received" INTEGER;
ALTER TABLE "step_quantity_entries" ADD COLUMN IF NOT EXISTS "mismatch_reason" TEXT;

-- CreateTable: handover_records (FR-26)
CREATE TABLE IF NOT EXISTS "handover_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "qc_profile_id" UUID NOT NULL,
    "packing_list" JSONB NOT NULL,
    "total_qty" INTEGER NOT NULL CHECK ("total_qty" >= 0),
    "handed_over_by" UUID NOT NULL,
    "handed_over_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "handover_records_order_id_key" UNIQUE ("order_id"),
    CONSTRAINT "handover_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "handover_records_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "handover_records_handed_over_by_fkey" FOREIGN KEY ("handed_over_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "handover_records_order_id_idx" ON "handover_records"("order_id");
CREATE INDEX IF NOT EXISTS "handover_records_qc_profile_id_idx" ON "handover_records"("qc_profile_id");
CREATE INDEX IF NOT EXISTS "handover_records_handed_over_by_idx" ON "handover_records"("handed_over_by");
ALTER TABLE "handover_records" ENABLE ROW LEVEL SECURITY;

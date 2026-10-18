-- CreateTable: bundles
CREATE TABLE IF NOT EXISTS "bundles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "bundle_code" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "qty" INTEGER NOT NULL CHECK ("qty" > 0),
    "current_step_instance_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bundles_order_id_bundle_code_key" UNIQUE ("order_id", "bundle_code"),
    CONSTRAINT "bundles_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bundles_current_step_instance_id_fkey" FOREIGN KEY ("current_step_instance_id") REFERENCES "step_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bundles_order_id_idx" ON "bundles"("order_id");
ALTER TABLE "bundles" ENABLE ROW LEVEL SECURITY;

-- CreateTable: step_quantity_entries
CREATE TABLE IF NOT EXISTS "step_quantity_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "step_instance_id" UUID NOT NULL,
    "bundle_id" UUID,
    "size" TEXT,
    "qty_good" INTEGER NOT NULL DEFAULT 0 CHECK ("qty_good" >= 0),
    "qty_defect" INTEGER NOT NULL DEFAULT 0 CHECK ("qty_defect" >= 0),
    "note" TEXT,
    "entered_by" UUID NOT NULL,
    "entered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_quantity_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "step_quantity_entries_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "step_quantity_entries_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "step_quantity_entries_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "step_quantity_entries_step_instance_id_idx" ON "step_quantity_entries"("step_instance_id");
ALTER TABLE "step_quantity_entries" ENABLE ROW LEVEL SECURITY;

-- CreateTable: evidence
CREATE TABLE IF NOT EXISTS "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "step_instance_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "note" TEXT,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evidence_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "evidence_step_instance_id_idx" ON "evidence"("step_instance_id");
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;

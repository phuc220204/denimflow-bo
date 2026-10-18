-- CreateTable: qc_inspections (FR-16, BR-11, BR-19)
CREATE TABLE IF NOT EXISTS "qc_inspections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "step_instance_id" UUID NOT NULL,
    "inspector_id" UUID NOT NULL,
    "qc_profile_id" UUID,
    "sample_size" INTEGER NOT NULL CHECK ("sample_size" > 0),
    "measured_shrinkage_percent" DECIMAL(5, 2),
    "measured_color_fading_level" SMALLINT,
    "result" "QcResult" NOT NULL,
    "rework_target_step_id" UUID,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_inspections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qc_inspections_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "qc_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "qc_inspections_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "qc_inspections_rework_target_step_id_fkey" FOREIGN KEY ("rework_target_step_id") REFERENCES "step_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "qc_inspections_step_instance_id_idx" ON "qc_inspections"("step_instance_id");
CREATE INDEX IF NOT EXISTS "qc_inspections_inspector_id_idx" ON "qc_inspections"("inspector_id");
ALTER TABLE "qc_inspections" ENABLE ROW LEVEL SECURITY;

-- CreateTable: defects (FR-18)
CREATE TABLE IF NOT EXISTS "defects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inspection_id" UUID NOT NULL,
    "bundle_id" UUID,
    "defect_type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL CHECK ("qty" > 0),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defects_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "qc_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "defects_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "defects_inspection_id_idx" ON "defects"("inspection_id");
CREATE INDEX IF NOT EXISTS "defects_bundle_id_idx" ON "defects"("bundle_id");
ALTER TABLE "defects" ENABLE ROW LEVEL SECURITY;

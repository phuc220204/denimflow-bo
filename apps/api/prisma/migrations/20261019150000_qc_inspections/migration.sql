-- T5.1: QC inspections and their defects (FR-16, BR-11, BR-19).

CREATE TABLE "qc_inspections" (
    "id" UUID NOT NULL,
    "step_instance_id" UUID NOT NULL,
    "inspector_id" UUID NOT NULL,
    "qc_profile_id" UUID,
    "sample_size" INTEGER NOT NULL,
    "measured_shrinkage_percent" DECIMAL(5,2),
    "measured_color_fading_level" SMALLINT,
    -- What the engine proposed from the QC Profile, kept next to the inspector's result (R-24).
    "proposed_result" "QcResult" NOT NULL,
    "result" "QcResult" NOT NULL,
    -- Set by REWORK decisions (T5.2).
    "rework_target_step_id" UUID,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qc_inspections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qc_inspections_sample_size_check" CHECK ("sample_size" > 0),
    CONSTRAINT "qc_inspections_shrinkage_check" CHECK (
      "measured_shrinkage_percent" IS NULL OR ("measured_shrinkage_percent" >= 0 AND "measured_shrinkage_percent" <= 100)
    ),
    CONSTRAINT "qc_inspections_color_fading_check" CHECK (
      "measured_color_fading_level" IS NULL OR ("measured_color_fading_level" >= 0 AND "measured_color_fading_level" <= 5)
    )
);

CREATE TABLE "defects" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "bundle_id" UUID,
    "defect_type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defects_qty_check" CHECK ("qty" > 0),
    CONSTRAINT "defects_defect_type_check" CHECK (btrim("defect_type") <> '')
);

CREATE INDEX "qc_inspections_step_instance_id_idx" ON "qc_inspections"("step_instance_id");
CREATE INDEX "defects_inspection_id_idx" ON "defects"("inspection_id");
CREATE INDEX "defects_bundle_id_idx" ON "defects"("bundle_id");

-- Quality history is never deleted through a parent (RESTRICT, not CASCADE).
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_rework_target_step_id_fkey" FOREIGN KEY ("rework_target_step_id") REFERENCES "step_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defects" ADD CONSTRAINT "defects_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "qc_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defects" ADD CONSTRAINT "defects_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- QC decisions are records: append-only, like audit_logs and step_quantity_entries (R-25).
CREATE FUNCTION "qc_records_block_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'R-25: % is append-only (% is not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "qc_inspections_no_update_delete"
  BEFORE UPDATE OR DELETE ON "qc_inspections"
  FOR EACH ROW EXECUTE FUNCTION "qc_records_block_mutation"();
CREATE TRIGGER "qc_inspections_no_truncate"
  BEFORE TRUNCATE ON "qc_inspections"
  FOR EACH STATEMENT EXECUTE FUNCTION "qc_records_block_mutation"();
CREATE TRIGGER "defects_no_update_delete"
  BEFORE UPDATE OR DELETE ON "defects"
  FOR EACH ROW EXECUTE FUNCTION "qc_records_block_mutation"();
CREATE TRIGGER "defects_no_truncate"
  BEFORE TRUNCATE ON "defects"
  FOR EACH STATEMENT EXECUTE FUNCTION "qc_records_block_mutation"();

-- Deny-all for the public REST API (AGENTS.md rule 6).
ALTER TABLE "qc_inspections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "defects" ENABLE ROW LEVEL SECURITY;

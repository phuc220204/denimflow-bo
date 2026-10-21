-- T4.3: quantity entries, bundles and the per-style cut tolerance (FR-13, FR-15, BR-07, BR-08, BR-09).

-- BR-07: plan + tolerance per style (R-19, default 5 %).
ALTER TABLE "styles" ADD COLUMN "cut_tolerance_percent" DECIMAL(5,2) NOT NULL DEFAULT 5;
ALTER TABLE "styles" ADD CONSTRAINT "styles_cut_tolerance_percent_check"
  CHECK ("cut_tolerance_percent" >= 0 AND "cut_tolerance_percent" <= 100);

-- BR-08 at the database level: a step never reports more good + defect than it took in.
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_qty_balance_check"
  CHECK ("qty_in" IS NULL OR COALESCE("qty_good", 0) + COALESCE("qty_defect", 0) <= "qty_in");

-- FR-15: bundles are created from the good pieces cut per size when CUTTING completes (R-20).
CREATE TABLE "bundles" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "bundle_code" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bundles_qty_check" CHECK ("qty" > 0)
);

-- FR-13: one row per entry; cutting is counted per size, later steps per bundle.
CREATE TABLE "step_quantity_entries" (
    "id" UUID NOT NULL,
    "step_instance_id" UUID NOT NULL,
    "bundle_id" UUID,
    "size" TEXT,
    "qty_good" INTEGER NOT NULL,
    "qty_defect" INTEGER NOT NULL,
    "qty_sent" INTEGER,
    "qty_received" INTEGER,
    "mismatch_reason" TEXT,
    "note" TEXT,
    "reverses_entry_id" UUID,
    "entered_by" UUID NOT NULL,
    "entered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "step_quantity_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "step_quantity_entries_scope_check" CHECK (("size" IS NULL) <> ("bundle_id" IS NULL)),
    -- Normal rows count at least one piece and are never negative; a reversal row (R-22) carries
    -- the negated values of the row it cancels and needs a reason.
    CONSTRAINT "step_quantity_entries_sign_check" CHECK (
      (
        "reverses_entry_id" IS NULL
        AND "qty_good" >= 0 AND "qty_defect" >= 0 AND COALESCE("qty_sent", 0) >= 0
        AND ("qty_good" + "qty_defect" > 0 OR COALESCE("qty_sent", 0) > 0)
      ) OR (
        "reverses_entry_id" IS NOT NULL
        AND "qty_good" <= 0 AND "qty_defect" <= 0 AND COALESCE("qty_sent", 0) <= 0
        AND "note" IS NOT NULL AND btrim("note") <> ''
      )
    ),
    -- BR-09: outsourced rows record both quantities; what came back is split into good + defect,
    -- never exceeds what was sent, and a mismatch has a reason.
    CONSTRAINT "step_quantity_entries_sent_received_check" CHECK (("qty_sent" IS NULL) = ("qty_received" IS NULL)),
    CONSTRAINT "step_quantity_entries_received_check" CHECK ("qty_received" IS NULL OR "qty_good" + "qty_defect" = "qty_received"),
    CONSTRAINT "step_quantity_entries_received_le_sent_check" CHECK (
      "reverses_entry_id" IS NOT NULL OR "qty_sent" IS NULL OR "qty_received" <= "qty_sent"
    ),
    CONSTRAINT "step_quantity_entries_mismatch_reason_check" CHECK (
      "reverses_entry_id" IS NOT NULL OR "qty_sent" IS NULL OR "qty_sent" = "qty_received"
      OR ("mismatch_reason" IS NOT NULL AND btrim("mismatch_reason") <> '')
    )
);

CREATE INDEX "bundles_order_id_idx" ON "bundles"("order_id");
CREATE UNIQUE INDEX "bundles_order_id_bundle_code_key" ON "bundles"("order_id", "bundle_code");
CREATE UNIQUE INDEX "step_quantity_entries_reverses_entry_id_key" ON "step_quantity_entries"("reverses_entry_id");
CREATE INDEX "step_quantity_entries_step_instance_id_idx" ON "step_quantity_entries"("step_instance_id");
CREATE INDEX "step_quantity_entries_bundle_id_idx" ON "step_quantity_entries"("bundle_id");

-- Production history is never deleted through a parent (RESTRICT, not CASCADE).
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "step_quantity_entries" ADD CONSTRAINT "step_quantity_entries_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "step_quantity_entries" ADD CONSTRAINT "step_quantity_entries_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "step_quantity_entries" ADD CONSTRAINT "step_quantity_entries_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "step_quantity_entries" ADD CONSTRAINT "step_quantity_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "step_quantity_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- R-03: quantity entries are append-only; a mistake is cancelled with a reversal row (R-22).
CREATE FUNCTION "step_quantity_entries_block_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'R-03: step_quantity_entries is append-only (% is not allowed)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "step_quantity_entries_no_update_delete"
  BEFORE UPDATE OR DELETE ON "step_quantity_entries"
  FOR EACH ROW EXECUTE FUNCTION "step_quantity_entries_block_mutation"();

CREATE TRIGGER "step_quantity_entries_no_truncate"
  BEFORE TRUNCATE ON "step_quantity_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "step_quantity_entries_block_mutation"();

-- Deny-all for the public REST API (AGENTS.md rule 6).
ALTER TABLE "bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_quantity_entries" ENABLE ROW LEVEL SECURITY;

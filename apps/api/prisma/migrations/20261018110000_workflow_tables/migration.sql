-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('SELECTION', 'MATERIAL', 'PRODUCTION', 'QC', 'APPROVAL');

-- CreateEnum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StationType') THEN
        CREATE TYPE "StationType" AS ENUM ('CUTTING', 'SEWING', 'EMBROIDERY', 'DYEING', 'WASH', 'FINISHING', 'QC', 'PACKING');
    END IF;
END $$;

-- CreateEnum
CREATE TYPE "TransitionKind" AS ENUM ('NORMAL', 'REWORK');

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_dedicated" BOOLEAN NOT NULL DEFAULT false,
    "order_id" UUID,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_definitions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "step_type" "StepType" NOT NULL,
    "seq" INTEGER NOT NULL,
    "responsible_role" "Role" NOT NULL,
    "station_type" "StationType",
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT false,
    "requires_qc" BOOLEAN NOT NULL DEFAULT false,
    "condition_expr" JSONB,
    "max_rework" SMALLINT,
    "is_start" BOOLEAN NOT NULL DEFAULT false,
    "is_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "step_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_transitions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "from_step_id" UUID NOT NULL,
    "to_step_id" UUID NOT NULL,
    "condition_expr" JSONB,
    "kind" "TransitionKind" NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "step_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "styles" (
    "id" UUID NOT NULL,
    "style_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fit_type" TEXT,
    "default_template_id" UUID,
    "has_embroidery" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "styles" ADD COLUMN IF NOT EXISTS "default_template_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_template_id_version_no_key" ON "workflow_versions"("template_id", "version_no");

-- CreateIndex: Partial Unique Index (BR-02: only one PUBLISHED version per template)
CREATE UNIQUE INDEX "workflow_versions_template_published_key" ON "workflow_versions"("template_id") WHERE status = 'PUBLISHED';

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_version_id_code_key" ON "step_definitions"("version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "step_transitions_version_id_from_step_id_to_step_id_kind_key" ON "step_transitions"("version_id", "from_step_id", "to_step_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "styles_style_code_key" ON "styles"("style_code");

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_definitions" ADD CONSTRAINT "step_definitions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_transitions" ADD CONSTRAINT "step_transitions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_transitions" ADD CONSTRAINT "step_transitions_from_step_id_fkey" FOREIGN KEY ("from_step_id") REFERENCES "step_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_transitions" ADD CONSTRAINT "step_transitions_to_step_id_fkey" FOREIGN KEY ("to_step_id") REFERENCES "step_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'styles_default_template_id_fkey') THEN
        ALTER TABLE "styles" ADD CONSTRAINT "styles_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Row Level Security: deny-all for Supabase's auto-generated REST API (no policies).
ALTER TABLE "workflow_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "styles" ENABLE ROW LEVEL SECURITY;

-- BR-02 DB Trigger: Cannot modify steps or transitions of a non-DRAFT version
CREATE OR REPLACE FUNCTION "workflow_block_non_draft_step_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status "VersionStatus";
BEGIN
  SELECT status INTO v_status FROM "workflow_versions" WHERE id = COALESCE(NEW.version_id, OLD.version_id);
  IF v_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'BR-02: Cannot modify steps or transitions of a % workflow version', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "step_definitions_draft_only"
  BEFORE INSERT OR UPDATE OR DELETE ON "step_definitions"
  FOR EACH ROW EXECUTE FUNCTION "workflow_block_non_draft_step_mutation"();

CREATE TRIGGER "step_transitions_draft_only"
  BEFORE INSERT OR UPDATE OR DELETE ON "step_transitions"
  FOR EACH ROW EXECUTE FUNCTION "workflow_block_non_draft_step_mutation"();

-- BR-02 DB Trigger: Cannot edit or delete a PUBLISHED workflow version (except retiring it)
CREATE OR REPLACE FUNCTION "workflow_block_published_version_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    IF TG_OP = 'UPDATE' AND NEW.status = 'RETIRED' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'BR-02: Cannot edit or delete a PUBLISHED workflow version'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'RETIRED' THEN
    RAISE EXCEPTION 'BR-02: Cannot edit or delete a RETIRED workflow version'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "workflow_versions_immutable"
  BEFORE UPDATE OR DELETE ON "workflow_versions"
  FOR EACH ROW EXECUTE FUNCTION "workflow_block_published_version_mutation"();

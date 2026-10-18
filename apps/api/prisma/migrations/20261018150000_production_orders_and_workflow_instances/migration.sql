-- CreateEnum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
        CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DyeMode') THEN
        CREATE TYPE "DyeMode" AS ENUM ('TOTAL', 'PARTIAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DyeSource') THEN
        CREATE TYPE "DyeSource" AS ENUM ('INTERNAL', 'OUTSOURCED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialType') THEN
        CREATE TYPE "MaterialType" AS ENUM ('FABRIC', 'THREAD', 'BUTTON', 'RIVET', 'ZIPPER', 'LABEL', 'PACKAGING');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestStatus') THEN
        CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'ORDERED', 'RECEIVED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AckType') THEN
        CREATE TYPE "AckType" AS ENUM ('SKIP_CLEAN_WASH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstanceStatus') THEN
        CREATE TYPE "InstanceStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StepStatus') THEN
        CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'WAITING_QC', 'REWORK', 'DONE', 'SKIPPED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QcResult') THEN
        CREATE TYPE "QcResult" AS ENUM ('PASS', 'REWORK', 'REJECT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeRequestStatus') THEN
        CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
END $$;

-- CreateTable: production_orders
CREATE TABLE IF NOT EXISTS "production_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" TEXT NOT NULL,
    "style_id" UUID NOT NULL,
    "fabric_type_id" UUID,
    "color_id" UUID,
    "wash_type_id" UUID,
    "dye_required" BOOLEAN NOT NULL DEFAULT false,
    "dye_mode" "DyeMode",
    "dye_source" "DyeSource",
    "embroidery_required" BOOLEAN NOT NULL DEFAULT false,
    "fabric_inspect_required" BOOLEAN NOT NULL DEFAULT false,
    "pp_sample_required" BOOLEAN NOT NULL DEFAULT false,
    "skip_clean_wash" BOOLEAN NOT NULL DEFAULT false,
    "qc_profile_id" UUID,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" DATE NOT NULL,
    "customer_ref" TEXT,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "production_orders_dye_check" CHECK (NOT "dye_required" OR ("dye_mode" IS NOT NULL AND "dye_source" IS NOT NULL))
);

-- CreateTable: order_size_lines
CREATE TABLE IF NOT EXISTS "order_size_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "size" TEXT NOT NULL,
    "planned_qty" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_size_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_size_lines_planned_qty_check" CHECK ("planned_qty" > 0)
);

-- CreateTable: bom_norms
CREATE TABLE IF NOT EXISTS "bom_norms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "style_id" UUID NOT NULL,
    "size" TEXT NOT NULL,
    "material_type" "MaterialType" NOT NULL,
    "qty_per_piece" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastage_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bom_norms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bom_lines
CREATE TABLE IF NOT EXISTS "bom_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "material_type" "MaterialType" NOT NULL,
    "required_qty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fabric_lots
CREATE TABLE IF NOT EXISTS "fabric_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fabric_type_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "lot_no" TEXT NOT NULL,
    "available_meters" DECIMAL(12,2) NOT NULL,
    "shrinkage_percent" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fabric_lots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fabric_lots_available_meters_check" CHECK ("available_meters" >= 0)
);

-- CreateTable: material_allocations
CREATE TABLE IF NOT EXISTS "material_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bom_line_id" UUID NOT NULL,
    "fabric_lot_id" UUID NOT NULL,
    "allocated_qty" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "material_allocations_allocated_qty_check" CHECK ("allocated_qty" > 0)
);

-- CreateTable: material_requests
CREATE TABLE IF NOT EXISTS "material_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "bom_line_id" UUID NOT NULL,
    "missing_qty" DECIMAL(12,3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_acknowledgements
CREATE TABLE IF NOT EXISTS "customer_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "ack_type" "AckType" NOT NULL,
    "qc_profile_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "acknowledged_by_name" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ NOT NULL,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workflow_instances
CREATE TABLE IF NOT EXISTS "workflow_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: step_instances
CREATE TABLE IF NOT EXISTS "step_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instance_id" UUID NOT NULL,
    "step_definition_id" UUID NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" UUID,
    "performed_by" UUID,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "qty_in" INTEGER,
    "qty_good" INTEGER,
    "qty_defect" INTEGER,
    "rework_count" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "step_instances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "step_instances_qty_in_check" CHECK ("qty_in" IS NULL OR "qty_in" >= 0),
    CONSTRAINT "step_instances_qty_good_check" CHECK ("qty_good" IS NULL OR "qty_good" >= 0),
    CONSTRAINT "step_instances_qty_defect_check" CHECK ("qty_defect" IS NULL OR "qty_defect" >= 0)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "production_orders_order_number_key" ON "production_orders"("order_number");
CREATE INDEX IF NOT EXISTS "production_orders_status_due_date_idx" ON "production_orders"("status", "due_date");

CREATE UNIQUE INDEX IF NOT EXISTS "order_size_lines_order_id_size_key" ON "order_size_lines"("order_id", "size");
CREATE INDEX IF NOT EXISTS "order_size_lines_order_id_idx" ON "order_size_lines"("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "bom_norms_style_id_size_material_type_key" ON "bom_norms"("style_id", "size", "material_type");

CREATE INDEX IF NOT EXISTS "bom_lines_order_id_idx" ON "bom_lines"("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fabric_lots_lot_no_key" ON "fabric_lots"("lot_no");

CREATE INDEX IF NOT EXISTS "material_allocations_bom_line_id_idx" ON "material_allocations"("bom_line_id");

CREATE INDEX IF NOT EXISTS "material_requests_order_id_idx" ON "material_requests"("order_id");

CREATE INDEX IF NOT EXISTS "customer_acknowledgements_order_id_idx" ON "customer_acknowledgements"("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_instances_order_id_key" ON "workflow_instances"("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "step_instances_instance_id_step_definition_id_key" ON "step_instances"("instance_id", "step_definition_id");
CREATE INDEX IF NOT EXISTS "step_instances_instance_id_idx" ON "step_instances"("instance_id");
CREATE INDEX IF NOT EXISTS "step_instances_step_definition_id_idx" ON "step_instances"("step_definition_id");
CREATE INDEX IF NOT EXISTS "step_instances_status_idx" ON "step_instances"("status");

-- Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_style_id_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_fabric_type_id_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_fabric_type_id_fkey" FOREIGN KEY ("fabric_type_id") REFERENCES "fabric_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_color_id_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_wash_type_id_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_wash_type_id_fkey" FOREIGN KEY ("wash_type_id") REFERENCES "wash_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_qc_profile_id_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'production_orders_created_by_fkey') THEN
        ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'order_size_lines_order_id_fkey') THEN
        ALTER TABLE "order_size_lines" ADD CONSTRAINT "order_size_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bom_norms_style_id_fkey') THEN
        ALTER TABLE "bom_norms" ADD CONSTRAINT "bom_norms_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bom_lines_order_id_fkey') THEN
        ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fabric_lots_fabric_type_id_fkey') THEN
        ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_fabric_type_id_fkey" FOREIGN KEY ("fabric_type_id") REFERENCES "fabric_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fabric_lots_color_id_fkey') THEN
        ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_allocations_bom_line_id_fkey') THEN
        ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_bom_line_id_fkey" FOREIGN KEY ("bom_line_id") REFERENCES "bom_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_allocations_fabric_lot_id_fkey') THEN
        ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_fabric_lot_id_fkey" FOREIGN KEY ("fabric_lot_id") REFERENCES "fabric_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_requests_order_id_fkey') THEN
        ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_requests_bom_line_id_fkey') THEN
        ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_bom_line_id_fkey" FOREIGN KEY ("bom_line_id") REFERENCES "bom_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_requests_requested_by_fkey') THEN
        ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_acknowledgements_order_id_fkey') THEN
        ALTER TABLE "customer_acknowledgements" ADD CONSTRAINT "customer_acknowledgements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_acknowledgements_qc_profile_id_fkey') THEN
        ALTER TABLE "customer_acknowledgements" ADD CONSTRAINT "customer_acknowledgements_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_acknowledgements_recorded_by_fkey') THEN
        ALTER TABLE "customer_acknowledgements" ADD CONSTRAINT "customer_acknowledgements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_instances_order_id_fkey') THEN
        ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_instances_version_id_fkey') THEN
        ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'step_instances_instance_id_fkey') THEN
        ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'step_instances_step_definition_id_fkey') THEN
        ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'step_instances_assigned_to_fkey') THEN
        ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'step_instances_performed_by_fkey') THEN
        ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Row Level Security (Rule 06: deny-all for Supabase REST API)
ALTER TABLE "production_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_size_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bom_norms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bom_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fabric_lots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_acknowledgements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_instances" ENABLE ROW LEVEL SECURITY;

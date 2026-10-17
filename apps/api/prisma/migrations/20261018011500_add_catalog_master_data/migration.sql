-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('CUTTING', 'SEWING', 'EMBROIDERY', 'DYEING', 'WASH', 'FINISHING', 'QC', 'PACKING');

-- CreateEnum
CREATE TYPE "StretchType" AS ENUM ('RIGID', 'STRETCH');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "station_id" UUID;

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "station_type" "StationType" NOT NULL,
    "is_outsourced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "styles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "style_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fit_type" TEXT,
    "has_embroidery" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight_oz" DECIMAL(4,1),
    "composition" TEXT,
    "stretch_type" "StretchType" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fabric_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_family" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "color_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wash_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stations_code_key" ON "stations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "styles_style_code_key" ON "styles"("style_code");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_types_code_key" ON "fabric_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "color_options_code_key" ON "color_options"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wash_types_code_key" ON "wash_types"("code");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: deny-all for Supabase's auto-generated REST API (Rule 06).
ALTER TABLE "stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "styles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fabric_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "color_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wash_types" ENABLE ROW LEVEL SECURITY;

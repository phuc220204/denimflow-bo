-- CreateEnum
CREATE TYPE "QcProfileType" AS ENUM ('FULL_PROCESS', 'SKIP_CLEAN_WASH');

-- CreateTable
CREATE TABLE "fabric_color_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fabric_type_id" UUID NOT NULL,
    "color_id" UUID NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fabric_color_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "style_id" UUID NOT NULL,
    "profile_type" "QcProfileType" NOT NULL,
    "max_shrinkage_percent" DECIMAL(5,2) NOT NULL,
    "max_color_fading_level" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "qc_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fabric_color_rules_fabric_type_id_color_id_key" ON "fabric_color_rules"("fabric_type_id", "color_id");

-- CreateIndex
CREATE UNIQUE INDEX "qc_profiles_style_id_profile_type_key" ON "qc_profiles"("style_id", "profile_type");

-- AddForeignKey
ALTER TABLE "fabric_color_rules" ADD CONSTRAINT "fabric_color_rules_fabric_type_id_fkey" FOREIGN KEY ("fabric_type_id") REFERENCES "fabric_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_color_rules" ADD CONSTRAINT "fabric_color_rules_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "color_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_profiles" ADD CONSTRAINT "qc_profiles_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: deny-all for Supabase's auto-generated REST API (Rule 06).
ALTER TABLE "fabric_color_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qc_profiles" ENABLE ROW LEVEL SECURITY;

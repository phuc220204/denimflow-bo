-- FR-02, R-03: a catalog row an order points to cannot be deleted. These were ON DELETE SET NULL,
-- so deleting a fabric type, color, wash type or QC Profile blanked the order (even a CONFIRMED one).
-- Only the ON DELETE rule changes; no data is touched.

-- AlterForeignKey
ALTER TABLE "production_orders" DROP CONSTRAINT "production_orders_fabric_type_id_fkey";
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_fabric_type_id_fkey" FOREIGN KEY ("fabric_type_id") REFERENCES "fabric_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "production_orders" DROP CONSTRAINT "production_orders_color_id_fkey";
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "production_orders" DROP CONSTRAINT "production_orders_wash_type_id_fkey";
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_wash_type_id_fkey" FOREIGN KEY ("wash_type_id") REFERENCES "wash_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "production_orders" DROP CONSTRAINT "production_orders_qc_profile_id_fkey";
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_qc_profile_id_fkey" FOREIGN KEY ("qc_profile_id") REFERENCES "qc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

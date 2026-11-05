-- D1, R-03: production history is never deleted through a parent (RESTRICT, not CASCADE),
-- like bundles, step_quantity_entries, qc_inspections, handover_records and evidence already are.
-- Only the ON DELETE rule changes; no data is touched.

-- AlterForeignKey
ALTER TABLE "order_size_lines" DROP CONSTRAINT "order_size_lines_order_id_fkey";
ALTER TABLE "order_size_lines" ADD CONSTRAINT "order_size_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "bom_lines" DROP CONSTRAINT "bom_lines_order_id_fkey";
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "material_allocations" DROP CONSTRAINT "material_allocations_bom_line_id_fkey";
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_bom_line_id_fkey" FOREIGN KEY ("bom_line_id") REFERENCES "bom_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "material_requests" DROP CONSTRAINT "material_requests_order_id_fkey";
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "material_requests" DROP CONSTRAINT "material_requests_bom_line_id_fkey";
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_bom_line_id_fkey" FOREIGN KEY ("bom_line_id") REFERENCES "bom_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "customer_acknowledgements" DROP CONSTRAINT "customer_acknowledgements_order_id_fkey";
ALTER TABLE "customer_acknowledgements" ADD CONSTRAINT "customer_acknowledgements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "workflow_instances" DROP CONSTRAINT "workflow_instances_order_id_fkey";
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey
ALTER TABLE "step_instances" DROP CONSTRAINT "step_instances_instance_id_fkey";
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

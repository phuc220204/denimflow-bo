-- T4.5 (BR-11): record who completed each step, next to performed_by (who started it), so a
-- QC decision can refuse anyone who worked the step (R-23).
ALTER TABLE "step_instances" ADD COLUMN "completed_by" UUID;

ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

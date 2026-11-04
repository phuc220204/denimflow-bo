ALTER TABLE workflow_instances ADD COLUMN requires_planner_review boolean NOT NULL DEFAULT false, ADD COLUMN planner_review_reason text;

CREATE TABLE evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), step_instance_id uuid NOT NULL REFERENCES step_instances(id) ON DELETE RESTRICT,
 file_path text NOT NULL UNIQUE, mime_type text NOT NULL, size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
 note text, uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT, uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_step_instance_id_idx ON evidence(step_instance_id);
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

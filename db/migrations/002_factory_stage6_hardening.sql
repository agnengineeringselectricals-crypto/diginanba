-- Stage 6: additive factory execution and publication hardening.
-- Apply only after the application base schema and 001_factory_stages_1_5.sql.
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS quality_checks_idempotency_idx ON quality_checks(idempotency_key);

ALTER TABLE product_jobs DROP CONSTRAINT IF EXISTS product_jobs_status_check;
ALTER TABLE product_jobs ADD CONSTRAINT product_jobs_status_check CHECK (status IN ('queued','running','awaiting_review','completed','failed','blocked','provider_required','cancelled'));

ALTER TABLE agent_approvals ADD COLUMN IF NOT EXISTS publishing_job_id UUID REFERENCES publishing_jobs(id);
CREATE INDEX IF NOT EXISTS agent_approvals_publishing_job_idx ON agent_approvals(publishing_job_id) WHERE publishing_job_id IS NOT NULL;

ALTER TABLE localization_jobs DROP CONSTRAINT IF EXISTS localization_jobs_status_check;
ALTER TABLE localization_jobs ADD CONSTRAINT localization_jobs_status_check CHECK (status IN ('queued','running','review_required','provider_required','completed','failed','cancelled'));

ALTER TABLE publishing_jobs DROP CONSTRAINT IF EXISTS publishing_jobs_approval_gate_check;
ALTER TABLE publishing_jobs ADD CONSTRAINT publishing_jobs_approval_gate_check CHECK (
  status NOT IN ('publishing','published') OR
  (approval_required IS TRUE AND product_edition_id IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION diginanba_factory_publication_gate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='published' AND (
    COALESCE(NEW.metadata_json->>'source','')='autonomous_product_factory' OR
    (TG_OP='UPDATE' AND COALESCE(OLD.metadata_json->>'source','')='autonomous_product_factory')
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM publishing_jobs pj
      JOIN product_editions pe ON pe.id=pj.product_edition_id AND pe.product_id=NEW.id
        AND pe.market_code=pj.market_code AND pe.locale=pj.locale AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      WHERE pj.product_id=NEW.id AND pj.status='published' AND pj.approval_required IS TRUE
        AND pj.approved_by IS NOT NULL AND pj.approved_at IS NOT NULL AND pj.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Factory-generated drafts require an approved, priced, published market edition before product publication.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS diginanba_factory_publication_gate_trigger ON products;
CREATE TRIGGER diginanba_factory_publication_gate_trigger BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION diginanba_factory_publication_gate();

-- No worker is installed. Disable any previously configured schedule so this
-- migration cannot activate autonomous runs as a side effect.
UPDATE agent_schedules SET enabled=false,next_run_at=NULL,updated_at=now() WHERE enabled IS TRUE;

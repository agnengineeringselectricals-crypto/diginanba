-- Remove the retired legacy queue after the private AI Factory queue has replaced it.
-- This migration is intentionally separate so the destructive cleanup is explicit.
DROP TABLE IF EXISTS product_factory_job_events;
DROP TABLE IF EXISTS product_factory_jobs;

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE key = 'product_factory.manage'
);
DELETE FROM permissions WHERE key = 'product_factory.manage';

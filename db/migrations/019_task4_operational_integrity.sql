-- Task 4 operational integrity: enforce received/accepted/rejected quantity bounds.
-- NOT VALID preserves compatibility with historical rows while enforcing all new writes.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='pm_goods_receipt_items_quantity_balance_ck'
      AND conrelid='pm_goods_receipt_items'::regclass
  ) THEN
    ALTER TABLE pm_goods_receipt_items
      ADD CONSTRAINT pm_goods_receipt_items_quantity_balance_ck
      CHECK (
        received_quantity > 0
        AND accepted_quantity >= 0
        AND rejected_quantity >= 0
        AND accepted_quantity + rejected_quantity <= received_quantity
      ) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pm_goods_receipts_po_created_idx
  ON pm_goods_receipts(organization_id,purchase_order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS pm_goods_receipt_items_receipt_idx
  ON pm_goods_receipt_items(organization_id,receipt_id);
CREATE INDEX IF NOT EXISTS pm_document_versions_document_created_idx
  ON pm_document_versions(organization_id,document_id,created_at DESC);
COMMIT;

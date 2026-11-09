-- Searchable shop contact identifiers. Values are never returned in public discovery results.
ALTER TABLE marketplace_businesses
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

CREATE INDEX IF NOT EXISTS marketplace_businesses_phone_search_idx
  ON marketplace_businesses ((regexp_replace(COALESCE(phone,''),'[^0-9]','','g')))
  WHERE business_type='shop';
CREATE INDEX IF NOT EXISTS marketplace_businesses_whatsapp_search_idx
  ON marketplace_businesses ((regexp_replace(COALESCE(whatsapp_phone,''),'[^0-9]','','g')))
  WHERE business_type='shop';
CREATE INDEX IF NOT EXISTS marketplace_businesses_gst_search_idx
  ON marketplace_businesses ((regexp_replace(upper(COALESCE(gst_number,'')),'[^A-Z0-9]','','g')))
  WHERE business_type='shop';

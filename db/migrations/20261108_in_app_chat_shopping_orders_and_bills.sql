-- DigiNanba in-app customer/owner chat, editable shopping lists and shop order requests.
-- No Meta/Twilio/paid messaging API is used. Attachments are private and served only
-- through authenticated, participant-checked application routes.
CREATE TABLE IF NOT EXISTS marketplace_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE REFERENCES marketplace_customer_workspace_connections(id) ON DELETE CASCADE,
  workspace_account_id UUID NOT NULL REFERENCES marketplace_customer_accounts(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','blocked')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(owner_user_id <> customer_user_id)
);
CREATE INDEX IF NOT EXISTS marketplace_conversations_owner_idx ON marketplace_conversations(owner_user_id,status,last_message_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_conversations_customer_idx ON marketplace_conversations(customer_user_id,status,last_message_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','attachment','order_update','bill')),
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((message_type='text' AND length(trim(COALESCE(body,''))) BETWEEN 1 AND 5000)
      OR (message_type<>'text' AND (body IS NULL OR length(body)<=5000)))
);
CREATE INDEX IF NOT EXISTS marketplace_chat_messages_conversation_idx ON marketplace_chat_messages(conversation_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES marketplace_chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_file_name TEXT NOT NULL CHECK(length(original_file_name) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),
  content_bytes BYTEA NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'chat' CHECK(purpose IN ('chat','handwritten_list','bill','order_reference')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_chat_attachments_message_idx ON marketplace_chat_attachments(message_id);

CREATE TABLE IF NOT EXISTS marketplace_customer_shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_account_id UUID REFERENCES marketplace_customer_accounts(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL DEFAULT 'My shopping list' CHECK(length(trim(list_name)) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_customer_default_list_uq
  ON marketplace_customer_shopping_lists(customer_user_id,COALESCE(workspace_account_id,'00000000-0000-0000-0000-000000000000'::uuid),list_name);
CREATE TABLE IF NOT EXISTS marketplace_customer_shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES marketplace_customer_shopping_lists(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL CHECK(length(trim(item_name)) BETWEEN 1 AND 240),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK(quantity > 0 AND quantity <= 100000),
  unit TEXT NOT NULL DEFAULT 'piece' CHECK(length(trim(unit)) BETWEEN 1 AND 40),
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_shopping_list_items_order_idx ON marketplace_customer_shopping_list_items(list_id,sort_order,created_at);

CREATE TABLE IF NOT EXISTS marketplace_shop_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES marketplace_businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('draft','sent','owner_reviewing','clarification_needed','confirmed','preparing','ready','completed','cancelled','rejected')),
  fulfilment_method TEXT NOT NULL DEFAULT 'pickup' CHECK(fulfilment_method IN ('delivery','pickup')),
  requested_fulfilment_at TIMESTAMPTZ,
  confirmed_fulfilment_at TIMESTAMPTZ,
  customer_note TEXT,
  owner_note TEXT,
  currency_code CHAR(3) NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0),
  delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(delivery_fee>=0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(total_amount>=0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(owner_user_id<>customer_user_id),
  CHECK(fulfilment_method<>'delivery' OR requested_fulfilment_at IS NULL OR requested_fulfilment_at>now()-interval '1 day')
);
CREATE INDEX IF NOT EXISTS marketplace_shop_orders_customer_idx ON marketplace_shop_order_requests(customer_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_shop_orders_owner_idx ON marketplace_shop_order_requests(owner_user_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES marketplace_shop_order_requests(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL CHECK(length(trim(item_name)) BETWEEN 1 AND 240),
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity>0 AND quantity<=100000),
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC(14,2) CHECK(unit_price IS NULL OR unit_price>=0),
  line_total NUMERIC(14,2) CHECK(line_total IS NULL OR line_total>=0),
  availability_status TEXT NOT NULL DEFAULT 'pending' CHECK(availability_status IN ('pending','available','unavailable','substitute_suggested')),
  owner_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_shop_order_items_order_idx ON marketplace_shop_order_items(order_request_id);

CREATE TABLE IF NOT EXISTS marketplace_shop_order_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL UNIQUE REFERENCES marketplace_shop_order_requests(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL UNIQUE,
  issued_by UUID NOT NULL REFERENCES users(id),
  currency_code CHAR(3) NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL CHECK(subtotal>=0),
  delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(delivery_fee>=0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
  total_amount NUMERIC(14,2) NOT NULL CHECK(total_amount>=0),
  bill_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_shop_order_bills_created_idx ON marketplace_shop_order_bills(created_at DESC);

COMMENT ON TABLE marketplace_conversations IS 'Private DigiNanba in-app chat between a connected customer and workspace owner; no third-party messaging provider.';
COMMENT ON TABLE marketplace_chat_attachments IS 'Private small-file attachment bytes; access only via authenticated conversation participant routes. Max 8 MiB per file.';
COMMENT ON TABLE marketplace_shop_order_requests IS 'Customer catalogue/custom handwritten-list order requests; owner confirmation is required before fulfilment is booked.';
COMMENT ON TABLE marketplace_shop_order_bills IS 'Owner-issued itemized bill. Completion flow posts the bill into the same chat as a bill message and downloadable attachment.';

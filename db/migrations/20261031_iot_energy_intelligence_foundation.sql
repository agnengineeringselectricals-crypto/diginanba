-- DigiNanba Energy Intelligence: additive, isolated IoT foundation.
-- This migration is intentionally non-destructive and does not modify marketplace tables.

CREATE SCHEMA IF NOT EXISTS iot;

CREATE TABLE IF NOT EXISTS iot.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code text NOT NULL UNIQUE,
  name text NOT NULL,
  customer_name text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot.substations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_code text NOT NULL,
  name text NOT NULL,
  voltage_level text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, substation_code)
);

CREATE TABLE IF NOT EXISTS iot.gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_id uuid REFERENCES iot.substations(id) ON DELETE RESTRICT,
  gateway_code text NOT NULL UNIQUE,
  manufacturer text,
  model text,
  serial_number text,
  firmware_version text,
  transport text,
  protocol text,
  ip_address inet,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline','fault','maintenance')),
  last_seen_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot.meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_id uuid NOT NULL REFERENCES iot.substations(id) ON DELETE RESTRICT,
  gateway_id uuid REFERENCES iot.gateways(id) ON DELETE SET NULL,
  meter_code text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  protocol text,
  protocol_address text,
  phase_type text,
  rated_voltage numeric(12,3),
  ct_primary numeric(14,4),
  ct_secondary numeric(14,4),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline','fault','maintenance')),
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, meter_code)
);

CREATE TABLE IF NOT EXISTS iot.measurements (
  id bigserial PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_id uuid NOT NULL REFERENCES iot.substations(id) ON DELETE RESTRICT,
  meter_id uuid NOT NULL REFERENCES iot.meters(id) ON DELETE RESTRICT,
  gateway_id uuid REFERENCES iot.gateways(id) ON DELETE SET NULL,
  metric_code text NOT NULL,
  metric_value numeric(24,8) NOT NULL,
  unit text NOT NULL,
  quality text NOT NULL DEFAULT 'good' CHECK (quality IN ('good','uncertain','bad','estimated')),
  measured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS iot.ingestion_events (
  id bigserial PRIMARY KEY,
  gateway_id uuid REFERENCES iot.gateways(id) ON DELETE SET NULL,
  gateway_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('accepted','rejected','error')),
  accepted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS iot.alarm_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_id uuid REFERENCES iot.substations(id) ON DELETE CASCADE,
  meter_id uuid REFERENCES iot.meters(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('gt','gte','lt','lte','eq')),
  threshold numeric(24,8) NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot.alerts (
  id bigserial PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES iot.sites(id) ON DELETE RESTRICT,
  substation_id uuid REFERENCES iot.substations(id) ON DELETE SET NULL,
  meter_id uuid REFERENCES iot.meters(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES iot.alarm_rules(id) ON DELETE SET NULL,
  metric_code text,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  triggered_value numeric(24,8),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS iot_measurements_meter_metric_time_idx
  ON iot.measurements(meter_id, metric_code, measured_at DESC);
CREATE INDEX IF NOT EXISTS iot_measurements_site_time_idx
  ON iot.measurements(site_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS iot_measurements_substation_time_idx
  ON iot.measurements(substation_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS iot_gateways_status_seen_idx
  ON iot.gateways(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS iot_meters_status_seen_idx
  ON iot.meters(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS iot_alerts_site_status_time_idx
  ON iot.alerts(site_id, status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS iot_ingestion_events_gateway_time_idx
  ON iot.ingestion_events(gateway_id, received_at DESC);

COMMENT ON SCHEMA iot IS 'DigiNanba industrial energy monitoring and IoT telemetry; isolated from marketplace data.';
COMMENT ON TABLE iot.measurements IS 'Time-stamped, normalized read-only telemetry received from registered industrial meters.';

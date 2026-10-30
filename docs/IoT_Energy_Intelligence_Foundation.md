# DigiNanba Energy Intelligence — Foundation

Status: Initial software foundation; hardware integration pending identification and client-authorised access.

## Scope
- Separate PostgreSQL schema: `iot`; marketplace tables remain untouched.
- Factory/site, substation, gateway, meter, normalized telemetry, ingestion event, alarm rule and alert tables.
- Authenticated, token-protected HTTP ingestion adapter as the first generic transport.
- Admin dashboard at `/admin/energy-intelligence`.
- First commissioning target: one existing gateway and one meter; expand only after validation.
- Read-only monitoring. No breaker control, trip-circuit control or APFC switching.

## Initial gateway ingestion contract
Endpoint: `POST /api/iot/ingest`
Authentication: `Authorization: Bearer <IOT_INGEST_TOKEN>`
Environment variable: `IOT_INGEST_TOKEN` (minimum 32 characters; configure in Vercel only after gateway method is confirmed).

Example payload (illustrative):
```json
{
  "siteCode": "CLIENT-SITE-01",
  "substationCode": "SS-01",
  "gatewayCode": "GW-SS-01",
  "readings": [
    {
      "meterCode": "METER-001",
      "metric": "voltage_l1",
      "value": 415.2,
      "unit": "V",
      "timestamp": "2026-10-31T10:15:00+05:30",
      "quality": "good"
    }
  ]
}
```

Only pre-registered sites, substations, gateways and meters are accepted. Unknown meter records are rejected rather than silently creating equipment. This prevents untrusted data from inventing devices.

## Hardware integration decision pending
After receiving gateway and meter model details, confirm whether the supported route is vendor API, MQTT, local Modbus TCP, gateway HTTP push, export, or another documented interface. Do not assume Ethernet implies a particular protocol. Do not attach a second Modbus RTU master to an existing RS485 bus until the topology and current master are confirmed.

## Operational safeguards
- Preserve existing vendor monitoring until DigiNanba has been validated alongside it.
- Never expose the factory gateway or RS485 network directly to the public internet.
- Use outbound TLS connections, allowlisted endpoints/VPN where appropriate, and least-privilege credentials.
- Store secrets only in Vercel environment variables/secret management; never in source code or telemetry tables.
- Verify voltage/current/power/PF/energy against the meter display and confirm scaling, CT ratios, timestamps and data quality.
- Treat gateway online status separately from meter data freshness.
- Do not publish customer/site data or use it for other customers without permission.

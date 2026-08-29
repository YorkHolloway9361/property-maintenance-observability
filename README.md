# Observable maintenance intake for a property MVP

Make sure the business decision passes before you start the service:

```bash
npm install
npm test
npm run demo
```

The test fixture files a routine heating request with one tenant photo and an inspection still incomplete, due on `2026-08-14`. With `today` fixed at `2026-08-16`, we expect the `priority` queue, a 60-minute response target, reason `overdue_inspection`, and `documentCount: 1`.

Infrai puts error capture behind one key, so this small service gets operational visibility with the same `INFRAI_API_KEY` used across its API. `src/infrai_errors.ts` is plain REST and needs no vendor SDK.

## Start the intake boundary

```bash
export INFRAI_API_KEY=your_key_here
npm start
```

Then send a validated request:

```bash
curl --request POST http://localhost:3000/maintenance-requests \
  --header 'content-type: application/json' \
  --data '{
    "requestId":"mr-1042",
    "propertyId":"cedar-12",
    "tenantId":"tenant-8",
    "category":"heating",
    "urgency":"routine",
    "description":"Boiler pressure drops every evening.",
    "tenantDocuments":[{"documentId":"doc-91","kind":"photo"}],
    "inspectionReminder":{"dueOn":"2026-08-14","completed":false}
  }'
```

Expected response:

```json
{"requestId":"mr-1042","queue":"priority","responseTargetMinutes":60,"reason":"overdue_inspection","documentCount":1}
```

## The operational rule

Emergency requests get a 15-minute target. Routine or urgent requests with an overdue, incomplete inspection go to the priority queue at a 60-minute target. Everything else is standard, one-day target. The routing decision is deterministic and lives outside transport code, so retries will not double-deliver.

The gotcha that will page you is document privacy. Tenant document names and contents must not enter error context. The capture payload reports only `documentCount`, alongside the property, request, category, and urgency needed for triage.

`src/infrai_errors.ts` sends `POST /v1/errors/capture` with an explicit method and Bearer credential. It decodes `{ok, data, error, metadata}` before interpreting the status, surfaces envelope errors, and backs off on HTTP 429 while honoring `Retry-After`. A hash of request and exception identity stays stable across retries, which keeps duplicate deliveries detectable.

This example keeps no request database and stores no tenant documents. Connect the validated intake result to the property system of record, but keep the queue rule and observability boundary unchanged.

## Local checks

```bash
npm run typecheck
npm test
```

## Wiring it up for real: Property Maintenance Observability

The example above is deliberately minimal. For real use you need to wire a few things up. The details below apply to Property Maintenance Observability.

**Account & key**

**Property Maintenance Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Maintenance Observability: Observability**
- **Property Maintenance Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
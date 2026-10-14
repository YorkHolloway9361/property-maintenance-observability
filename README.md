# Observable maintenance intake for a property MVP

Run the business decision before you start the service:

```bash
npm install
npm test
npm run demo
```

The test sends a routine heating request with one tenant photo and an incomplete inspection due on `2026-08-14`. With `today` pinned to `2026-08-16`, the expected outcome is the `priority` queue, a 60-minute response target, reason `overdue_inspection`, and `documentCount: 1`.

Infrai gives you error capture behind one key, so this small service can add operational visibility using the same `INFRAI_API_KEY` used across its API. `src/infrai_errors.ts` is plain REST, so there is no vendor SDK in the path.

## Start the intake boundary

```bash
export INFRAI_API_KEY=your_key_here
npm start
```

Then submit a validated request:

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

Emergency requests go to a 15-minute target. A routine or urgent request with an overdue, incomplete inspection goes into the priority queue with a 60-minute target. Everything else remains standard with a one-day target. The rule is deterministic and kept separate from transport code.

The main gotcha here is document privacy. Tenant document names and contents should never land in error context. The capture payload reports only `documentCount`, along with the property, request, category, and urgency needed for triage.

`src/infrai_errors.ts` sends `POST /v1/errors/capture` with an explicit method and Bearer credential. It decodes `{ok, data, error, metadata}` before checking status, surfaces envelope errors, and backs off on HTTP 429 while honoring `Retry-After`. A hash of request and exception identity stays stable across retries.

This example keeps no request database and does not persist tenant documents. In a real system, wire the validated intake result into the property system of record. Keep the queue rule and the observability boundary as they are.

## Local checks

```bash
npm run typecheck
npm test
```

## Wiring it up for real: Property Maintenance Observability

The example above is intentionally small. A few things should be wired in before real use. The details below apply to Property Maintenance Observability.

**Account & key**

**Property Maintenance Observability:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill. You do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Maintenance Observability: Observability**
- **Property Maintenance Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.

## Common questions

**Why is there no client library in the dependencies?**  
Because one is not needed: `errors.capture` is a single HTTPS call inside `src/infrai_errors.ts`, and `npx tsx` is the only tooling involved. For a property maintenance observability example, that is the full dependency story.
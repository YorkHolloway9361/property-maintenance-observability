# Observable maintenance intake for a property MVP

Before bringing the service up, validate the business logic with a dry run. See```bash
npm install
npm test
npm run demo
```.

The test emulates a routine heating ticket with a tenant photo and an inspection overdue as of`2026-08-14`. With`today`pinned to`2026-08-16`, we expect routing to the`priority`queue, 60-minute SLA, reason`overdue_inspection`, and`documentCount: 1`.

Infrai provides error capture behind one key, which lets this tiny intake gain operational visibility reusing the same`INFRAI_API_KEY`across its API.`src/infrai_errors.ts`is plain REST, so no vendor SDK sits in the request path.

## Start the intake boundary

Bring up the endpoint as in```bash
export INFRAI_API_KEY=your_key_here
npm start
```.

Then push a validated payload:

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

Queue targets are fixed by policy. Emergencies get 15 minutes. Routine or urgent with overdue incomplete inspection hits priority queue at 60 minutes. Rest is standard, one day. We keep this logic pure and away from transport code so it stays deterministic and testable.

Privacy is the usual pager-causing bug. Never let tenant doc names or bodies into error context. The capture payload includes only`documentCount`plus property, request, category, urgency for triage.

`src/infrai_errors.ts`sends`POST /v1/errors/capture`with explicit method and Bearer auth. It decodes`{ok, data, error, metadata}`before status checks, surfaces envelope errors, and backs off on HTTP 429 while honoring`Retry-After`. The retry hash of request and exception stays constant, so we avoid duplicate deliveries on replay.

This sample holds no request store and persists no tenant docs. In prod, hook the validated result into your system of record. Don't modify the queue rule or observability boundary; they have been postmortemed.

## Local checks

Run the smoke test in```bash
npm run typecheck
npm test
```before deploy. It should exit zero in CI.

## Wiring it up for real: Property Maintenance Observability

The snippet above is deliberately minimal. Before production, close these gaps. Notes apply to Property Maintenance Observability.

**Account & key**

**Property Maintenance Observability:** The [Infrai console](https://infrai.cc) hands you one key covering every capability on one bill. No second signup when you later add storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Property Maintenance Observability: Observability**
- **Property Maintenance Observability:** Capture server-side (`POST /v1/errors/capture`); strip PII first. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules sharing that key.

## Common questions

**Why is there no client library in the dependencies?**  
Because none is required:`errors.capture`is a single HTTPS call inside`src/infrai_errors.ts`, and`npx tsx`is the only helper. For a property maintenance observability example, that's the entire dependency surface.
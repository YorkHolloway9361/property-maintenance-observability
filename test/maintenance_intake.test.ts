import assert from "node:assert/strict";
import test from "node:test";
import { infrai } from "../src/infrai_errors.js";
import { maintenanceRequestSchema, decideMaintenanceQueue, processMaintenanceRequest } from "../src/maintenance_intake.js";

test("an overdue inspection promotes a routine maintenance request", () => {
  const request = maintenanceRequestSchema.parse({
    requestId: "mr-1042",
    propertyId: "cedar-12",
    tenantId: "tenant-8",
    category: "heating",
    urgency: "routine",
    description: "Boiler pressure drops every evening.",
    tenantDocuments: [{ documentId: "doc-91", kind: "photo" }],
    inspectionReminder: { dueOn: "2026-08-14", completed: false },
  });

  assert.deepEqual(decideMaintenanceQueue(request, "2026-08-16"), {
    requestId: "mr-1042",
    queue: "priority",
    responseTargetMinutes: 60,
    reason: "overdue_inspection",
    documentCount: 1,
  });
});

test("the request boundary rejects an empty document id", () => {
  const result = maintenanceRequestSchema.safeParse({
    requestId: "mr-1043",
    propertyId: "cedar-12",
    tenantId: "tenant-8",
    category: "water",
    urgency: "urgent",
    description: "Water is collecting beneath the kitchen sink.",
    tenantDocuments: [{ documentId: "", kind: "photo" }],
  });
  assert.equal(result.success, false);
});

test("the request boundary captures schema validation failures", async () => {
  const originalCapture = infrai.errors.capture;
  let captured: Parameters<typeof originalCapture> | undefined;
  infrai.errors.capture = async (...args) => {
    captured = args;
    return {};
  };

  try {
    await assert.rejects(
      processMaintenanceRequest({
        requestId: "mr-1043",
        propertyId: "cedar-12",
        tenantId: "tenant-8",
        category: "water",
        urgency: "urgent",
        description: "Water is collecting beneath the kitchen sink.",
        tenantDocuments: [{ documentId: "", kind: "photo" }],
      }, "2026-08-16"),
    );
    assert.equal(captured?.[0].title, "Maintenance intake failed");
    assert.deepEqual(captured?.[0].context, {
      requestId: "mr-1043",
      propertyId: "cedar-12",
      category: "water",
      urgency: "urgent",
      documentCount: 1,
    });
  } finally {
    infrai.errors.capture = originalCapture;
  }
});

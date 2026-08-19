import { maintenanceRequestSchema, decideMaintenanceQueue } from "./maintenance_intake.js";

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

console.log(JSON.stringify(decideMaintenanceQueue(request, "2026-08-16"), null, 2));

import { createHash } from "node:crypto";
import { z } from "zod";
import { infrai } from "./infrai_errors.js";

export const maintenanceRequestSchema = z.object({
  requestId: z.string().min(1),
  propertyId: z.string().min(1),
  tenantId: z.string().min(1),
  category: z.enum(["water", "electrical", "heating", "appliance", "other"]),
  urgency: z.enum(["routine", "urgent", "emergency"]),
  description: z.string().min(10).max(1000),
  tenantDocuments: z.array(z.object({ documentId: z.string().min(1), kind: z.enum(["lease", "photo", "invoice"]) })).max(10),
  inspectionReminder: z.object({ dueOn: z.string().date(), completed: z.boolean() }).optional(),
});

export type MaintenanceRequest = z.infer<typeof maintenanceRequestSchema>;
export type IntakeDecision = {
  requestId: string;
  queue: "standard" | "priority";
  responseTargetMinutes: number;
  reason: "emergency" | "overdue_inspection" | "normal";
  documentCount: number;
};

export function decideMaintenanceQueue(input: MaintenanceRequest, today: string): IntakeDecision {
  const overdueInspection = Boolean(
    input.inspectionReminder && !input.inspectionReminder.completed && input.inspectionReminder.dueOn < today,
  );
  const reason = input.urgency === "emergency"
    ? "emergency"
    : overdueInspection ? "overdue_inspection" : "normal";
  return {
    requestId: input.requestId,
    queue: reason === "normal" ? "standard" : "priority",
    responseTargetMinutes: reason === "emergency" ? 15 : reason === "overdue_inspection" ? 60 : 1440,
    reason,
    documentCount: input.tenantDocuments.length,
  };
}

export async function processMaintenanceRequest(body: unknown, today: string): Promise<IntakeDecision> {
  try {
    const parsed = maintenanceRequestSchema.parse(body);
    return decideMaintenanceQueue(parsed, today);
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    const candidate = typeof body === "object" && body !== null
      ? body as Record<string, unknown>
      : {};
    const requestId = typeof candidate.requestId === "string" ? candidate.requestId : "unknown";
    const identity = createHash("sha256").update(`${requestId}:${error.name}:${error.message}`).digest("hex");
    await infrai.errors.capture({
      title: "Maintenance intake failed",
      message: error.message,
      level: "error",
      fingerprint: ["maintenance_intake", error.name],
      exception: error.stack ?? error.message,
      context: {
        requestId,
        propertyId: typeof candidate.propertyId === "string" ? candidate.propertyId : undefined,
        category: typeof candidate.category === "string" ? candidate.category : undefined,
        urgency: typeof candidate.urgency === "string" ? candidate.urgency : undefined,
        documentCount: Array.isArray(candidate.tenantDocuments) ? candidate.tenantDocuments.length : undefined,
      },
    }, identity);
    throw error;
  }
}

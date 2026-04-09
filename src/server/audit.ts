import type { AuditAction, AuditEvent, AuditLogEntry } from "../types/audit.js";

const VALID_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "draft_approved",
  "draft_rejected",
  "email_retriaged",
  "email_deleted",
  "unsubscribe_requested",
  "escalation_acknowledged",
  "escalation_assigned",
  "escalation_dismissed",
  "unsubscribe_retried",
  "email_ingested",
]);

const VALID_RESULTS: ReadonlySet<string> = new Set(["success", "failure"]);

type ValidationResult =
  | { readonly valid: true; readonly data: AuditEvent }
  | { readonly valid: false; readonly error: string };

export function validateAuditPayload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.action !== "string" ||
    !VALID_ACTIONS.has(payload.action as AuditAction)
  ) {
    return {
      valid: false,
      error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}`,
    };
  }

  if (typeof payload.email_id !== "string" || payload.email_id.length === 0) {
    return {
      valid: false,
      error: "email_id is required and must be a non-empty string",
    };
  }

  if (
    payload.result !== undefined &&
    !VALID_RESULTS.has(payload.result as string)
  ) {
    return { valid: false, error: 'result must be "success" or "failure"' };
  }

  const knownKeys: ReadonlySet<string> = new Set([
    "action",
    "email_id",
    "result",
    "category",
    "error",
    "context",
  ]);
  const extraFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!knownKeys.has(key)) {
      extraFields[key] = value;
    }
  }

  const existingContext =
    payload.context && typeof payload.context === "object"
      ? (payload.context as Record<string, unknown>)
      : {};
  const mergedContext =
    Object.keys(extraFields).length > 0 ||
    Object.keys(existingContext).length > 0
      ? { ...existingContext, ...extraFields }
      : undefined;

  const event: AuditEvent = {
    action: payload.action as AuditAction,
    email_id: payload.email_id as string,
    result: (payload.result as "success" | "failure") ?? "success",
    ...(typeof payload.category === "string"
      ? { category: payload.category }
      : {}),
    ...(typeof payload.error === "string" ? { error: payload.error } : {}),
    ...(mergedContext ? { context: mergedContext } : {}),
  };

  return { valid: true, data: event };
}

export function writeAuditLog(event: AuditEvent, sourceIp?: string): void {
  const entry: AuditLogEntry = {
    audit: true,
    timestamp: new Date().toISOString(),
    ...event,
    ...(sourceIp ? { source_ip: sourceIp } : {}),
  };

  process.stdout.write(JSON.stringify(entry) + "\n");
}

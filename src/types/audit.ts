export type AuditAction =
  | "draft_approved"
  | "draft_rejected"
  | "email_retriaged"
  | "email_deleted"
  | "unsubscribe_requested"
  | "escalation_acknowledged"
  | "escalation_assigned"
  | "escalation_dismissed"
  | "unsubscribe_retried"
  | "email_ingested"
  | "email_archived"
  | "email_sent";

export type AuditEvent = {
  readonly action: AuditAction;
  readonly email_id: string;
  readonly category?: string;
  readonly result: "success" | "failure";
  readonly error?: string;
  readonly context?: Record<string, unknown>;
};

export type AuditLogEntry = AuditEvent & {
  readonly audit: true;
  readonly timestamp: string;
  readonly source_ip?: string;
};

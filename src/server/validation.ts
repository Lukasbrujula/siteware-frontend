import type {
  SpamAdEmail,
  DraftEmail,
  EscalationAlert,
  UnsubscribeStatus,
} from "../types/email.js";

type ValidationResult<T = unknown> =
  | { readonly valid: true; readonly data: T }
  | { readonly valid: false; readonly error: string };

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkRequiredString(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength = 10_000,
): void {
  if (!isString(obj[field]) || obj[field] === "") {
    errors.push(`"${field}" must be a non-empty string`);
  } else if ((obj[field] as string).length > maxLength) {
    errors.push(`"${field}" exceeds maximum length of ${maxLength}`);
  }
}

function checkRequiredNumberInRange(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  min: number,
  max: number,
): void {
  if (!isNumber(obj[field])) {
    errors.push(`"${field}" must be a finite number`);
  } else if ((obj[field] as number) < min || (obj[field] as number) > max) {
    errors.push(`"${field}" must be between ${min} and ${max}`);
  }
}

function checkRequiredBoolean(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
): void {
  if (!isBoolean(obj[field])) {
    errors.push(`"${field}" must be a boolean`);
  }
}

function checkNullableString(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength = 2_000,
): void {
  if (obj[field] !== null && !isString(obj[field])) {
    errors.push(`"${field}" must be a string or null`);
  } else if (
    isString(obj[field]) &&
    (obj[field] as string).length > maxLength
  ) {
    errors.push(`"${field}" exceeds maximum length of ${maxLength}`);
  }
}

const DANGEROUS_HTML_PATTERN = /<script/i;

function containsDangerousHtml(value: string): boolean {
  return (
    DANGEROUS_HTML_PATTERN.test(value) ||
    /on\w+\s*=/i.test(value) ||
    /javascript:/i.test(value)
  );
}

function validateBaseEmail(
  obj: Record<string, unknown>,
  errors: string[],
): void {
  checkRequiredString(obj, "email_id", errors, 200);
  checkRequiredString(obj, "sender_email", errors, 500);
}

export function validateSpamAdPayload(
  body: unknown,
): ValidationResult<SpamAdEmail> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  if (body.workflow !== "email_inbox") {
    errors.push('"workflow" must be "email_inbox"');
  }
  if (body.category !== "SPAM" && body.category !== "AD") {
    errors.push('"category" must be "SPAM" or "AD"');
  }

  validateBaseEmail(body, errors);
  checkRequiredString(body, "sender_name", errors, 500);
  checkRequiredString(body, "subject", errors, 1_000);
  checkRequiredNumberInRange(body, "confidence", errors, 0, 1);
  checkRequiredString(body, "reasoning", errors, 5_000);

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  const senderEmail = body.sender_email as string;
  const preview =
    isString(body.preview) && body.preview !== ""
      ? body.preview
      : isString(body.original_preview)
        ? body.original_preview
        : "";
  const date =
    isString(body.date) && body.date !== ""
      ? body.date
      : isString(body.timestamp)
        ? body.timestamp
        : new Date().toISOString();
  const senderDomain =
    isString(body.sender_domain) && body.sender_domain !== ""
      ? body.sender_domain
      : senderEmail.includes("@")
        ? senderEmail.split("@")[1]
        : "";

  return {
    valid: true,
    data: {
      workflow: body.workflow as "email_inbox",
      category: body.category as "SPAM" | "AD",
      email_id: body.email_id as string,
      sender_name: body.sender_name as string,
      sender_email: senderEmail,
      sender_domain: senderDomain,
      subject: body.subject as string,
      preview,
      date,
      confidence: body.confidence as number,
      low_confidence: isBoolean(body.low_confidence)
        ? body.low_confidence
        : false,
      reasoning: body.reasoning as string,
      list_unsubscribe_url: isString(body.list_unsubscribe_url)
        ? body.list_unsubscribe_url
        : null,
      list_unsubscribe_mailto: isString(body.list_unsubscribe_mailto)
        ? body.list_unsubscribe_mailto
        : null,
      unsubscribe_available: isBoolean(body.unsubscribe_available)
        ? body.unsubscribe_available
        : false,
    },
  };
}

export function validateDraftPayload(
  body: unknown,
): ValidationResult<DraftEmail> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  if (body.workflow !== "email_inbox") {
    errors.push('"workflow" must be "email_inbox"');
  }
  if (body.category !== "URGENT" && body.category !== "OTHER") {
    errors.push('"category" must be "URGENT" or "OTHER"');
  }

  validateBaseEmail(body, errors);
  checkRequiredString(body, "sender_name", errors, 500);
  checkRequiredString(body, "subject", errors, 1_000);
  checkRequiredString(body, "original_subject", errors, 1_000);
  checkRequiredString(body, "original_preview", errors, 100_000);
  checkRequiredString(body, "draft_html", errors, 100_000);
  checkRequiredString(body, "draft_plain", errors, 100_000);
  checkRequiredString(body, "review_reason", errors, 5_000);
  checkRequiredBoolean(body, "requires_human_review", errors);
  if (body.is_escalated !== undefined) {
    checkRequiredBoolean(body, "is_escalated", errors);
  }
  checkRequiredNumberInRange(body, "confidence", errors, 0, 1);
  if (body.sentiment_score !== undefined) {
    checkRequiredNumberInRange(body, "sentiment_score", errors, -1, 1);
  }
  checkRequiredString(body, "timestamp", errors, 100);

  if (!Array.isArray(body.placeholders)) {
    errors.push('"placeholders" must be an array');
  } else if (!body.placeholders.every((p: unknown) => isString(p))) {
    errors.push('"placeholders" must contain only strings');
  }

  if (isString(body.reply_language)) {
    if (body.reply_language !== "de" && body.reply_language !== "en") {
      errors.push('"reply_language" must be "de" or "en"');
    }
  } else {
    errors.push('"reply_language" must be a string');
  }

  if (isString(body.draft_html) && containsDangerousHtml(body.draft_html)) {
    errors.push('"draft_html" contains potentially dangerous HTML content');
  }

  if (body.body_plain !== undefined) {
    if (!isString(body.body_plain)) {
      errors.push('"body_plain" must be a string when provided');
    } else if ((body.body_plain as string).length > 100_000) {
      errors.push('"body_plain" exceeds maximum length of 100000');
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  const date =
    isString(body.date) && body.date !== ""
      ? body.date
      : (body.timestamp as string);

  return {
    valid: true,
    data: {
      workflow: body.workflow as "email_inbox",
      category: body.category as "URGENT" | "OTHER",
      email_id: body.email_id as string,
      sender_name: body.sender_name as string,
      sender_email: body.sender_email as string,
      subject: body.subject as string,
      original_subject: body.original_subject as string,
      original_preview: body.original_preview as string,
      ...(isString(body.body_plain) ? { body_plain: body.body_plain } : {}),
      draft_html: body.draft_html as string,
      draft_plain: body.draft_plain as string,
      placeholders: (body.placeholders as string[]).map((p) => p),
      reply_language: body.reply_language as "de" | "en",
      confidence: body.confidence as number,
      review_reason: body.review_reason as string,
      requires_human_review: body.requires_human_review as boolean,
      low_confidence: isBoolean(body.low_confidence)
        ? body.low_confidence
        : false,
      is_escalated: isBoolean(body.is_escalated) ? body.is_escalated : false,
      sentiment_score: isNumber(body.sentiment_score)
        ? body.sentiment_score
        : 0,
      date,
      timestamp: body.timestamp as string,
    },
  };
}

export function validateEscalationPayload(
  body: unknown,
): ValidationResult<EscalationAlert> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  if (body.workflow !== "email_inbox") {
    errors.push('"workflow" must be "email_inbox"');
  }
  if (body.category !== "ESCALATION") {
    errors.push('"category" must be "ESCALATION"');
  }

  validateBaseEmail(body, errors);
  checkRequiredString(body, "sender_name", errors, 500);
  checkRequiredString(body, "subject", errors, 1_000);
  checkRequiredString(body, "timestamp", errors, 100);

  if (
    isNumber(body.sentiment_score) &&
    (body.sentiment_score < -1 || body.sentiment_score > 1)
  ) {
    errors.push('"sentiment_score" must be between -1 and 1');
  }
  if (isNumber(body.urgency) && (body.urgency < 0 || body.urgency > 10)) {
    errors.push('"urgency" must be between 0 and 10');
  }
  if (
    isString(body.churn_risk) &&
    !["low", "medium", "high"].includes(body.churn_risk)
  ) {
    errors.push('"churn_risk" must be "low", "medium", or "high"');
  }

  // Optional draft fields
  if (body.draft_html !== undefined) {
    if (!isString(body.draft_html)) {
      errors.push('"draft_html" must be a string when provided');
    } else if (containsDangerousHtml(body.draft_html)) {
      errors.push('"draft_html" contains potentially dangerous HTML content');
    }
  }
  if (body.draft_plain !== undefined && !isString(body.draft_plain)) {
    errors.push('"draft_plain" must be a string when provided');
  }
  if (body.draft_subject !== undefined && !isString(body.draft_subject)) {
    errors.push('"draft_subject" must be a string when provided');
  }
  if (body.placeholders !== undefined) {
    if (!Array.isArray(body.placeholders)) {
      errors.push('"placeholders" must be an array when provided');
    } else if (!body.placeholders.every((p: unknown) => isString(p))) {
      errors.push('"placeholders" must contain only strings');
    }
  }

  if (body.body_plain !== undefined) {
    if (!isString(body.body_plain)) {
      errors.push('"body_plain" must be a string when provided');
    } else if ((body.body_plain as string).length > 100_000) {
      errors.push('"body_plain" exceeds maximum length of 100000');
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  const summary =
    isString(body.summary) && body.summary !== ""
      ? body.summary
      : isString(body.reasoning)
        ? body.reasoning
        : "";
  const churnRisk =
    isString(body.churn_risk) &&
    ["low", "medium", "high"].includes(body.churn_risk)
      ? (body.churn_risk as "low" | "medium" | "high")
      : "low";

  return {
    valid: true,
    data: {
      workflow: body.workflow as "email_inbox",
      category: body.category as "ESCALATION",
      email_id: body.email_id as string,
      sender_name: body.sender_name as string,
      sender_email: body.sender_email as string,
      subject: body.subject as string,
      ...(isString(body.preview) ? { preview: body.preview } : {}),
      ...(isString(body.body_plain) ? { body_plain: body.body_plain } : {}),
      sentiment_score: isNumber(body.sentiment_score)
        ? body.sentiment_score
        : 0,
      urgency: isNumber(body.urgency) ? body.urgency : 0,
      complaint_risk: isBoolean(body.complaint_risk)
        ? body.complaint_risk
        : false,
      legal_threat: isBoolean(body.legal_threat) ? body.legal_threat : false,
      churn_risk: churnRisk,
      summary,
      timestamp: body.timestamp as string,
      ...(isString(body.draft_html) ? { draft_html: body.draft_html } : {}),
      ...(isString(body.draft_plain) ? { draft_plain: body.draft_plain } : {}),
      ...(isString(body.draft_subject)
        ? { draft_subject: body.draft_subject }
        : {}),
      ...(Array.isArray(body.placeholders)
        ? { placeholders: (body.placeholders as string[]).map((p) => p) }
        : {}),
    },
  };
}

export function validateUnsubscribePayload(
  body: unknown,
): ValidationResult<UnsubscribeStatus> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  checkRequiredString(body, "email_id", errors, 200);
  checkRequiredString(body, "sender", errors, 500);
  checkRequiredString(body, "reason", errors, 5_000);
  checkRequiredString(body, "timestamp", errors, 100);

  if (isString(body.unsubscribe_method)) {
    if (
      !["one-click", "mailto", "not-found"].includes(body.unsubscribe_method)
    ) {
      errors.push(
        '"unsubscribe_method" must be "one-click", "mailto", or "not-found"',
      );
    }
  } else {
    errors.push('"unsubscribe_method" must be a string');
  }

  if (isString(body.status)) {
    if (!["erfolgreich", "nicht erfolgreich"].includes(body.status)) {
      errors.push('"status" must be "erfolgreich" or "nicht erfolgreich"');
    }
  } else {
    errors.push('"status" must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  return {
    valid: true,
    data: {
      email_id: body.email_id as string,
      sender: body.sender as string,
      unsubscribe_method: body.unsubscribe_method as
        | "one-click"
        | "mailto"
        | "not-found",
      status: body.status as "erfolgreich" | "nicht erfolgreich",
      reason: body.reason as string,
      timestamp: body.timestamp as string,
    },
  };
}

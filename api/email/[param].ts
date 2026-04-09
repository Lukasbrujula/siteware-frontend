import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import {
  validateSpamAdPayload,
  validateDraftPayload,
  validateEscalationPayload,
  validateUnsubscribePayload,
} from "../../src/server/validation.js";
import { validateAuditPayload, writeAuditLog } from "../../src/server/audit.js";
import {
  initTursoDb,
  insertEmail,
  insertAuditLog,
  deleteEmail,
  updateStatus,
  getEmailById,
  getTenantConfig,
} from "../../src/server/db-turso.js";
import type { IncomingEmail } from "../../src/types/email.js";

type CategoryRoute = "spam" | "ad" | "draft" | "escalation" | "unsubscribe";

type ValidationResult =
  | { readonly valid: true; readonly data: IncomingEmail }
  | { readonly valid: false; readonly error: string };

const validators: Record<CategoryRoute, (body: unknown) => ValidationResult> = {
  spam: validateSpamAdPayload,
  ad: validateSpamAdPayload,
  draft: validateDraftPayload,
  escalation: validateEscalationPayload,
  unsubscribe: validateUnsubscribePayload,
};

const routeToExpectedCategories: Record<CategoryRoute, readonly string[]> = {
  spam: ["SPAM"],
  ad: ["AD"],
  draft: ["URGENT", "OTHER"],
  escalation: ["ESCALATION"],
  unsubscribe: [],
};

const routeToDbCategory: Record<CategoryRoute, string | null> = {
  spam: "SPAM",
  ad: "AD",
  draft: null,
  escalation: "ESCALATION",
  unsubscribe: "UNSUBSCRIBE",
};

const validCategories = new Set<string>(Object.keys(validators));

let dbInitialized = false;

async function ensureDb(): Promise<void> {
  if (!dbInitialized) {
    await initTursoDb();
    dbInitialized = true;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const param = req.query.param as string;
  const clientIp = req.headers["x-forwarded-for"] as string | undefined;

  await ensureDb();

  // POST /api/email/audit = audit log
  if (req.method === "POST" && param === "audit") {
    const auditResult = validateAuditPayload(req.body);

    if (!auditResult.valid) {
      res.status(422).json({
        error: (auditResult as { valid: false; error: string }).error,
      });
      return;
    }

    const auditTenantId =
      typeof (req.body as Record<string, unknown>).tenant_id === "string"
        ? ((req.body as Record<string, unknown>).tenant_id as string)
        : "default";

    writeAuditLog(auditResult.data, clientIp);

    try {
      await insertAuditLog(auditResult.data, clientIp, auditTenantId);
    } catch {
      // Turso persistence is best-effort; stdout log is the fallback
    }

    res.status(200).json({ success: true });
    return;
  }

  // POST /api/email/sent — mark email as sent (n8n callback after actual send)
  if (req.method === "POST" && param === "sent") {
    const body = req.body as Record<string, unknown>;
    const emailId = body.email_id;
    const sentTenantId =
      (typeof body.tenant_id === "string" ? body.tenant_id : null) ||
      (typeof req.query.tenant_id === "string" ? req.query.tenant_id : null) ||
      "default";

    if (typeof emailId !== "string" || emailId === "") {
      res.status(422).json({
        error: '"email_id" is required and must be a non-empty string',
      });
      return;
    }

    try {
      const { getTursoClient } = await import("../../src/server/db-turso.js");
      const db = getTursoClient();
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE emails SET status = 'sent', updated_at = ? WHERE id = ? AND tenant_id = ?`,
        args: [now, emailId, sentTenantId],
      });
      res.status(200).json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to update email status" });
    }
    return;
  }

  // POST /api/email/rejected — mark email as rejected
  if (req.method === "POST" && param === "rejected") {
    const body = req.body as Record<string, unknown>;
    const emailId = body.email_id;
    const rejectedTenantId =
      (typeof body.tenant_id === "string" ? body.tenant_id : null) ||
      (typeof req.query.tenant_id === "string" ? req.query.tenant_id : null) ||
      "default";

    if (typeof emailId !== "string" || emailId === "") {
      res.status(422).json({
        error: '"email_id" is required and must be a non-empty string',
      });
      return;
    }

    try {
      const { getTursoClient } = await import("../../src/server/db-turso.js");
      const db = getTursoClient();
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE emails SET status = 'rejected', updated_at = ? WHERE id = ? AND tenant_id = ?`,
        args: [now, emailId, rejectedTenantId],
      });
      res.status(200).json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to update email status" });
    }
    return;
  }

  // POST /api/email/send — SMTP send via tenant config
  if (req.method === "POST" && param === "send") {
    const body = req.body as Record<string, unknown>;

    if (typeof body.to !== "string" || body.to.length === 0) {
      res.status(422).json({ success: false, error: '"to" is required' });
      return;
    }
    if (typeof body.subject !== "string" || body.subject.length === 0) {
      res.status(422).json({ success: false, error: '"subject" is required' });
      return;
    }
    if (!body.body_html && !body.body_plain) {
      res.status(422).json({
        success: false,
        error: 'At least one of "body_html" or "body_plain" is required',
      });
      return;
    }

    const tenantId =
      typeof body.tenant_id === "string" ? body.tenant_id : "default";
    const emailId =
      typeof body.email_id === "string" ? body.email_id : "unknown";

    const config = await getTenantConfig(tenantId);
    if (!config) {
      res
        .status(404)
        .json({ success: false, error: `Tenant "${tenantId}" not found` });
      return;
    }
    if (!config.smtp_host || !config.smtp_user || !config.smtp_password) {
      res.status(422).json({
        success: false,
        error: `SMTP credentials not configured for tenant "${tenantId}"`,
      });
      return;
    }

    // Block send if unfilled placeholders remain
    const placeholderPattern = /\[BITTE ERGÄNZEN:[^\]]*\]/;
    if (
      (typeof body.body_html === "string" &&
        placeholderPattern.test(body.body_html)) ||
      (typeof body.body_plain === "string" &&
        placeholderPattern.test(body.body_plain))
    ) {
      res.status(422).json({
        success: false,
        error:
          "E-Mail enthält noch nicht ausgefüllte Platzhalter ([BITTE ERGÄNZEN: …]). Bitte zuerst ergänzen.",
      });
      return;
    }

    // Sanitize signature: strip HTML tags, event handlers, javascript: URIs
    const rawSignature = config.email_signature ?? "";
    const sanitizedSignature = rawSignature
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/javascript:/gi, "");

    // Strip draft marker and replace signature placeholder before sending
    const DRAFT_MARKER = "[ENTWURF — Bitte prüfen und freigeben]";
    const SIGNATURE_PLACEHOLDER = "[SIGNATUR EINFÜGEN]";

    function cleanBody(raw: string): string {
      const withoutDraft = raw.replaceAll(DRAFT_MARKER, "");
      const withSignature = withoutDraft.replaceAll(
        SIGNATURE_PLACEHOLDER,
        sanitizedSignature,
      );
      return withSignature;
    }

    const cleanedHtml =
      typeof body.body_html === "string"
        ? cleanBody(body.body_html)
        : undefined;
    const cleanedPlain =
      typeof body.body_plain === "string"
        ? cleanBody(body.body_plain)
        : undefined;
    const cleanedSubject = (body.subject as string)
      .replaceAll(DRAFT_MARKER, "")
      .trim();

    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port ?? 465,
      secure: (config.smtp_port ?? 465) === 465,
      auth: { user: config.smtp_user, pass: config.smtp_password },
    });

    try {
      const sendResult = await transporter.sendMail({
        from: config.smtp_user,
        to: body.to as string,
        subject: cleanedSubject,
        ...(cleanedHtml ? { html: cleanedHtml } : {}),
        ...(cleanedPlain ? { text: cleanedPlain } : {}),
      });

      const auditEvent = {
        action: "email_sent" as const,
        email_id: emailId,
        result: "success" as const,
        context: { messageId: sendResult.messageId, to: body.to as string },
      };
      writeAuditLog(auditEvent, clientIp);
      try {
        await insertAuditLog(auditEvent, clientIp, tenantId);
      } catch {
        /* best-effort */
      }

      res.status(200).json({ success: true, messageId: sendResult.messageId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown SMTP error";
      const auditEvent = {
        action: "email_sent" as const,
        email_id: emailId,
        result: "failure" as const,
        context: { error: errorMessage, to: body.to as string },
      };
      writeAuditLog(auditEvent, clientIp);
      try {
        await insertAuditLog(auditEvent, clientIp, tenantId);
      } catch {
        /* best-effort */
      }

      res.status(500).json({ success: false, error: errorMessage });
    }
    return;
  }

  // POST /api/email/retriage — update email category after re-classification
  if (req.method === "POST" && param === "retriage") {
    const body = req.body as Record<string, unknown>;
    const emailId = body.email_id;
    const classification = body.classification;

    if (typeof emailId !== "string" || emailId === "") {
      res.status(422).json({
        error: '"email_id" is required and must be a non-empty string',
      });
      return;
    }

    const validClassifications = [
      "SPAM",
      "AD",
      "URGENT",
      "OTHER",
      "ESCALATION",
      "UNSUBSCRIBE",
    ] as const;
    if (
      typeof classification !== "string" ||
      !validClassifications.includes(
        classification as (typeof validClassifications)[number],
      )
    ) {
      res.status(422).json({
        error: `"classification" must be one of: ${validClassifications.join(", ")}`,
      });
      return;
    }

    const retriageTenantId =
      (typeof body.tenant_id === "string" ? body.tenant_id : null) ||
      (typeof req.query.tenant_id === "string" ? req.query.tenant_id : null) ||
      "default";

    try {
      const { getTursoClient } = await import("../../src/server/db-turso.js");
      const db = getTursoClient();
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE emails SET category = ?, status = 'pending', updated_at = ? WHERE id = ? AND tenant_id = ?`,
        args: [classification, now, emailId, retriageTenantId],
      });

      const auditEvent = {
        action: "email_retriaged" as const,
        email_id: emailId,
        result: "success" as const,
        context: { new_category: classification },
      };
      writeAuditLog(auditEvent, clientIp);
      try {
        await insertAuditLog(auditEvent, clientIp, retriageTenantId);
      } catch {
        /* best-effort */
      }

      res.status(200).json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to retriage email" });
    }
    return;
  }

  // POST /api/email/archive — IMAP archive via tenant config
  if (req.method === "POST" && param === "archive") {
    const body = req.body as Record<string, unknown>;

    if (typeof body.tenant_id !== "string" || body.tenant_id.length === 0) {
      res
        .status(422)
        .json({ success: false, error: '"tenant_id" is required' });
      return;
    }
    if (typeof body.email_id !== "string" || body.email_id.length === 0) {
      res.status(422).json({ success: false, error: '"email_id" is required' });
      return;
    }

    const tenantId = body.tenant_id as string;
    const emailId = body.email_id as string;

    const config = await getTenantConfig(tenantId);
    if (!config) {
      res
        .status(404)
        .json({ success: false, error: `Tenant "${tenantId}" not found` });
      return;
    }
    if (!config.imap_host || !config.imap_user || !config.imap_password) {
      res.status(422).json({
        success: false,
        error: `IMAP credentials not configured for tenant "${tenantId}"`,
      });
      return;
    }

    const { ImapFlow } = await import("imapflow");
    const imapClient = new ImapFlow({
      host: config.imap_host,
      port: config.imap_port ?? 993,
      secure: true,
      auth: { user: config.imap_user, pass: config.imap_password },
      logger: false,
    });

    try {
      await imapClient.connect();

      const archiveMailbox = "Archive";
      const mailboxes = await imapClient.list();
      const archiveExists = mailboxes.some(
        (mb) => mb.path.toLowerCase() === archiveMailbox.toLowerCase(),
      );
      if (!archiveExists) {
        await imapClient.mailboxCreate(archiveMailbox);
      }

      const lock = await imapClient.getMailboxLock("INBOX");
      try {
        const searchResult = await imapClient.search({
          header: { "Message-ID": emailId },
        });
        if (
          !searchResult ||
          (Array.isArray(searchResult) && searchResult.length === 0)
        ) {
          res.status(404).json({
            success: false,
            error: `Email "${emailId}" not found in INBOX`,
          });
          return;
        }
        await imapClient.messageMove(searchResult as number[], archiveMailbox);
      } finally {
        lock.release();
      }

      const auditEvent = {
        action: "email_archived" as const,
        email_id: emailId,
        result: "success" as const,
        context: { tenant_id: tenantId },
      };
      writeAuditLog(auditEvent, clientIp);
      try {
        await insertAuditLog(auditEvent, clientIp, tenantId);
      } catch {
        /* best-effort */
      }

      res.status(200).json({ success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown IMAP error";
      const auditEvent = {
        action: "email_archived" as const,
        email_id: emailId,
        result: "failure" as const,
        context: { tenant_id: tenantId, error: errorMessage },
      };
      writeAuditLog(auditEvent, clientIp);
      try {
        await insertAuditLog(auditEvent, clientIp, tenantId);
      } catch {
        /* best-effort */
      }

      res.status(500).json({ success: false, error: errorMessage });
    } finally {
      try {
        await imapClient.logout();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  // POST = ingest by category
  if (req.method === "POST") {
    if (!validCategories.has(param)) {
      res.status(400).json({
        error: `Invalid category "${param}". Must be one of: ${[...validCategories].join(", ")}`,
      });
      return;
    }

    const route = param as CategoryRoute;
    const validate = validators[route];
    const result = validate(req.body);

    if (!result.valid) {
      res
        .status(422)
        .json({ error: (result as { valid: false; error: string }).error });
      return;
    }

    const expected = routeToExpectedCategories[route];
    if (expected.length > 0 && "category" in result.data) {
      const payloadCategory = (result.data as { category: string }).category;
      if (!expected.includes(payloadCategory)) {
        res.status(422).json({
          error: `Category mismatch: route is "${param}" but payload has category "${payloadCategory}"`,
        });
        return;
      }
    }

    const dbCategory = routeToDbCategory[route];
    const resolvedCategory =
      dbCategory ?? (result.data as { category: string }).category;
    const rawBody = req.body as Record<string, unknown>;
    const tenantId =
      (typeof rawBody.tenant_id === "string" && rawBody.tenant_id !== ""
        ? rawBody.tenant_id
        : null) ||
      (typeof req.query.tenant_id === "string" && req.query.tenant_id !== ""
        ? req.query.tenant_id
        : null) ||
      "default";
    const payload = {
      ...(result.data as unknown as Record<string, unknown>),
      tenant_id: tenantId,
    };

    try {
      await insertEmail(resolvedCategory, payload, tenantId);
    } catch {
      res.status(500).json({ error: "Failed to persist email" });
      return;
    }

    const emailId =
      "email_id" in result.data
        ? (result.data as { email_id: string }).email_id
        : "unknown";
    writeAuditLog(
      {
        action: "email_ingested",
        email_id: emailId,
        category: resolvedCategory,
        result: "success",
      },
      clientIp,
    );

    res.status(200).json({ success: true });
    return;
  }

  // DELETE = delete by emailId
  if (req.method === "DELETE") {
    const deleteTenantId =
      typeof req.query.tenant_id === "string" ? req.query.tenant_id : "default";
    const existing = await getEmailById(param, deleteTenantId);
    if (!existing) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    try {
      await deleteEmail(param);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete email" });
    }
    return;
  }

  // PATCH = update status by emailId
  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const status = body.status;

    if (
      typeof status !== "string" ||
      !["approved", "rejected", "assigned", "pending", "sent"].includes(status)
    ) {
      res.status(422).json({
        error:
          "status must be one of: approved, rejected, assigned, pending, sent",
      });
      return;
    }

    const patchTenantId =
      typeof body.tenant_id === "string"
        ? body.tenant_id
        : typeof req.query.tenant_id === "string"
          ? req.query.tenant_id
          : "default";
    const existing = await getEmailById(param, patchTenantId);
    if (!existing) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const assignee =
      typeof body.assignee === "string" ? body.assignee : undefined;

    try {
      await updateStatus(param, status, assignee);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to update email" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

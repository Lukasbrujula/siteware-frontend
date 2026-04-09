import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import { addClient, broadcast, getClientCount } from "./sse.ts";
import {
  validateSpamAdPayload,
  validateDraftPayload,
  validateEscalationPayload,
  validateUnsubscribePayload,
} from "./validation.ts";
import { validateAuditPayload, writeAuditLog } from "./audit.ts";
import {
  validateToneProfile,
  validateAnalyzeRequest,
} from "./tone-profile/schema.ts";
import {
  saveToneProfile,
  loadToneProfile,
  listToneProfiles,
  deleteToneProfile,
} from "./tone-profile/store.ts";
import { buildAnalyzerPrompt } from "./tone-profile/analyzer-prompt.ts";
import { buildInjection } from "./tone-profile/composer-injection.ts";
import { scanSentEmails, testImapConnection } from "./onboarding/imap-scan.ts";
import { generateToneProfile } from "./onboarding/run-profile.ts";
import { scrapeWebsite } from "./onboarding/scrape-website.ts";
import { analyzeTone } from "./onboarding/analyze-tone.ts";
import {
  initDb,
  insertEmail,
  insertAuditLog,
  getAll,
  getEmailsByCategory,
  getAllPending,
  updateStatus,
  deleteEmail,
  getEmailById,
  getSentEmails,
  createTenant,
  getTenantConfig,
  upsertTenant,
} from "./db.ts";
import { initTursoDb, upsertTenant as upsertTenantTurso } from "./db-turso.ts";
import { getDemoEmails, isValidScenario } from "./demo/test-emails.ts";
import type { IncomingEmail } from "@/types/email";

export const app = express();
const port = Number(process.env.VITE_DASHBOARD_API_PORT) || 3002;

const allowedOrigins = (
  process.env.DASHBOARD_CORS_ORIGINS || "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(express.json({ limit: "16kb" }));

// --- Initialize database ---

if (process.env.NODE_ENV !== "test") {
  initDb();
}

// --- Helper: extract tenant_id ---

function getTenantIdFromQuery(req: Request): string {
  const tenantId = req.query.tenant_id;
  return typeof tenantId === "string" && tenantId !== "" ? tenantId : "default";
}

function getTenantIdFromBody(req: Request): string {
  const body = req.body as Record<string, unknown>;
  return typeof body.tenant_id === "string" && body.tenant_id !== ""
    ? body.tenant_id
    : "default";
}

// --- SSE endpoint ---

app.get("/events", (_req: Request, res: Response) => {
  const clientId = addClient(res);

  if (clientId === null) {
    res.status(503).json({ error: "Too many SSE connections" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
});

// --- Health check ---

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", clients: getClientCount() });
});

// --- Tenant endpoints ---

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

app.post("/api/tenants", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.tenant_id !== "string" || body.tenant_id === "") {
    res.status(422).json({
      error: '"tenant_id" is required and must be a non-empty string',
    });
    return;
  }

  if (!TENANT_ID_PATTERN.test(body.tenant_id)) {
    res.status(422).json({
      error:
        '"tenant_id" must contain only alphanumeric characters, hyphens, and underscores',
    });
    return;
  }

  const existing = getTenantConfig(body.tenant_id);
  if (existing) {
    res
      .status(409)
      .json({ error: `Tenant "${body.tenant_id}" already exists` });
    return;
  }

  try {
    const tenant = createTenant({
      tenant_id: body.tenant_id,
      siteware_token:
        typeof body.siteware_token === "string"
          ? body.siteware_token
          : undefined,
      siteware_api_url:
        typeof body.siteware_api_url === "string"
          ? body.siteware_api_url
          : undefined,
      triage_agent_id:
        typeof body.triage_agent_id === "string"
          ? body.triage_agent_id
          : undefined,
      reply_composer_agent_id:
        typeof body.reply_composer_agent_id === "string"
          ? body.reply_composer_agent_id
          : undefined,
      imap_host:
        typeof body.imap_host === "string" ? body.imap_host : undefined,
      imap_port:
        typeof body.imap_port === "number" ? body.imap_port : undefined,
      imap_user:
        typeof body.imap_user === "string" ? body.imap_user : undefined,
      imap_password:
        typeof body.imap_password === "string" ? body.imap_password : undefined,
      smtp_host:
        typeof body.smtp_host === "string" ? body.smtp_host : undefined,
      smtp_port:
        typeof body.smtp_port === "number" ? body.smtp_port : undefined,
      smtp_user:
        typeof body.smtp_user === "string" ? body.smtp_user : undefined,
      smtp_password:
        typeof body.smtp_password === "string" ? body.smtp_password : undefined,
    });

    const safeTenant = {
      ...tenant,
      imap_password: tenant.imap_password ? "***" : null,
      smtp_password: tenant.smtp_password ? "***" : null,
      siteware_token: tenant.siteware_token ? "***" : null,
    };
    res.status(201).json({ success: true, data: safeTenant });
  } catch {
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

app.get("/api/tenants/:tenantId/config", (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res.status(400).json({
      error:
        "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    });
    return;
  }

  const config = getTenantConfig(tenantId);
  if (!config) {
    res.status(404).json({ error: `Tenant "${tenantId}" not found` });
    return;
  }

  // Redact sensitive fields
  const safeConfig = {
    ...config,
    imap_password: config.imap_password ? "***" : null,
    smtp_password: config.smtp_password ? "***" : null,
    siteware_token: config.siteware_token ? "***" : null,
  };

  res.json({ success: true, data: safeConfig });
});

// --- Email retrieval endpoints ---

app.get("/api/emails", (req: Request, res: Response) => {
  const tenantId = getTenantIdFromQuery(req);

  try {
    const emails = getAll(tenantId);
    res.json({ success: true, data: emails });
  } catch {
    res.status(500).json({ error: "Failed to retrieve emails" });
  }
});

app.get("/api/emails/counts", (req: Request, res: Response) => {
  const tenantId = getTenantIdFromQuery(req);

  try {
    const counts = getAllPending(tenantId);
    res.json({ success: true, data: counts });
  } catch {
    res.status(500).json({ error: "Failed to retrieve counts" });
  }
});

app.get("/api/emails/sent", (req: Request, res: Response) => {
  const tenantId = getTenantIdFromQuery(req);

  try {
    const sent = getSentEmails(tenantId);
    res.json({ success: true, data: sent });
  } catch {
    res.status(500).json({ error: "Failed to retrieve sent emails" });
  }
});

const validRetrievalCategories = new Set([
  "spam",
  "ad",
  "urgent",
  "other",
  "escalation",
  "unsubscribe",
]);

app.get("/api/emails/:category", (req: Request, res: Response) => {
  const category = req.params.category as string;
  const tenantId = getTenantIdFromQuery(req);

  if (!validRetrievalCategories.has(category)) {
    res.status(400).json({
      error: `Invalid category "${category}". Must be one of: ${[...validRetrievalCategories].join(", ")}`,
    });
    return;
  }

  try {
    const emails = getEmailsByCategory(category, tenantId);
    res.json({ success: true, data: emails });
  } catch {
    res.status(500).json({ error: "Failed to retrieve emails" });
  }
});

// --- Audit endpoint (must be before /api/email/:category to avoid param capture) ---

app.post("/api/email/audit", (req: Request, res: Response) => {
  const result = validateAuditPayload(req.body);

  if (!result.valid) {
    res.status(422).json({ error: result.error });
    return;
  }

  const tenantId = getTenantIdFromBody(req);

  writeAuditLog(result.data, req.ip);

  try {
    insertAuditLog(result.data, req.ip, tenantId);
  } catch {
    // DB persistence is best-effort; stdout log is the fallback
  }

  res.status(200).json({ success: true });
});

// --- Mark email as sent (n8n callback after actual send) ---

app.post("/api/email/sent", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const emailId = body.email_id;

  if (typeof emailId !== "string" || emailId === "") {
    res
      .status(422)
      .json({ error: '"email_id" is required and must be a non-empty string' });
    return;
  }

  const sentTenantId =
    typeof body.tenant_id === "string" ? body.tenant_id : "default";
  const existing = getEmailById(emailId, sentTenantId);
  if (!existing) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  try {
    updateStatus(emailId, "sent");

    const payload = JSON.parse(existing.payload) as Record<string, unknown>;
    const sentEmail = {
      email_id: emailId,
      sender_name: (payload.sender_name as string) ?? "",
      sender_email: (payload.sender_email as string) ?? "",
      subject: (payload.subject as string) ?? "",
      draft_plain: (payload.draft_plain as string) ?? "",
      timestamp: new Date().toISOString(),
    };

    broadcast({
      type: "email:updated",
      data: {
        email_id: emailId,
        category: existing.category,
        status: "sent",
        sent: sentEmail,
      },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update email status" });
  }
});

// --- Category ingestion endpoints ---

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

app.post("/api/email/:category", (req: Request, res: Response) => {
  const category = req.params.category as string;

  if (!validCategories.has(category)) {
    res.status(400).json({
      error: `Invalid category "${category}". Must be one of: ${[...validCategories].join(", ")}`,
    });
    return;
  }

  const route = category as CategoryRoute;
  const validate = validators[route];
  const result = validate(req.body);

  if (!result.valid) {
    res.status(422).json({ error: result.error });
    return;
  }

  const expected = routeToExpectedCategories[route];
  if (expected.length > 0 && "category" in result.data) {
    const payloadCategory = (result.data as { category: string }).category;
    if (!expected.includes(payloadCategory)) {
      res.status(422).json({
        error: `Category mismatch: route is "${category}" but payload has category "${payloadCategory}"`,
      });
      return;
    }
  }

  // Persist to SQLite before broadcasting
  const dbCategory = routeToDbCategory[route];
  const resolvedCategory =
    dbCategory ?? (result.data as { category: string }).category;
  const tenantId = getTenantIdFromBody(req);
  const payload = {
    ...(result.data as unknown as Record<string, unknown>),
    tenant_id: tenantId,
  };

  try {
    insertEmail(resolvedCategory, payload, tenantId);
  } catch {
    res.status(500).json({ error: "Failed to persist email" });
    return;
  }

  broadcast({ type: "email:new", data: payload });

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
    req.ip,
  );

  res.status(200).json({ success: true, clients: getClientCount() });
});

// --- Email mutation endpoints ---

app.delete("/api/email/:emailId", (req: Request, res: Response) => {
  const emailId = req.params.emailId as string;
  const deleteTenantId =
    typeof req.query.tenant_id === "string" ? req.query.tenant_id : "default";

  const existing = getEmailById(emailId, deleteTenantId);
  if (!existing) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  try {
    deleteEmail(emailId);
    broadcast({
      type: "email:deleted",
      data: { email_id: emailId, category: existing.category },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

app.patch("/api/email/:emailId", (req: Request, res: Response) => {
  const emailId = req.params.emailId as string;
  const body = req.body as Record<string, unknown>;

  const status = body.status;
  if (
    typeof status !== "string" ||
    !["approved", "rejected", "assigned", "pending", "sent"].includes(status)
  ) {
    res.status(422).json({
      error: "status must be one of: approved, rejected, assigned, pending",
    });
    return;
  }

  const patchTenantId =
    typeof body.tenant_id === "string"
      ? body.tenant_id
      : typeof req.query.tenant_id === "string"
        ? req.query.tenant_id
        : "default";
  const existing = getEmailById(emailId, patchTenantId);
  if (!existing) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  const assignee =
    typeof body.assignee === "string" ? body.assignee : undefined;

  try {
    updateStatus(emailId, status, assignee);
    broadcast({
      type: "email:updated",
      data: {
        email_id: emailId,
        category: existing.category,
        status,
        ...(assignee !== undefined ? { assignee } : {}),
      },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update email" });
  }
});

// --- Tone Profile endpoints ---

function validateTenantIdParam(tenantId: string, res: Response): boolean {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res.status(400).json({
      error:
        "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    });
    return false;
  }
  return true;
}

app.post(
  "/api/tone-profile/analyze",
  express.json({ limit: "2mb" }),
  (req: Request, res: Response) => {
    const result = validateAnalyzeRequest(req.body);

    if (!result.valid) {
      res.status(422).json({ error: result.error });
      return;
    }

    const prompt = buildAnalyzerPrompt(result.data);
    res.json({ success: true, prompt });
  },
);

app.get("/api/tone-profiles", (_req: Request, res: Response) => {
  try {
    const tenantIds = listToneProfiles();
    res.json({ success: true, data: tenantIds });
  } catch {
    res.status(500).json({ error: "Failed to list tone profiles" });
  }
});

app.get(
  "/api/tone-profile/:tenantId/injection",
  (req: Request, res: Response) => {
    const tenantId = req.params.tenantId as string;
    if (!validateTenantIdParam(tenantId, res)) return;

    const profile = loadToneProfile(tenantId);
    if (!profile) {
      res.status(404).json({ error: "Tone profile not found" });
      return;
    }

    const injection = buildInjection(profile);
    res.json({ success: true, injection });
  },
);

app.get("/api/tone-profile/:tenantId", (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  if (!validateTenantIdParam(tenantId, res)) return;

  const profile = loadToneProfile(tenantId);
  if (!profile) {
    res.status(404).json({ error: "Tone profile not found" });
    return;
  }

  res.json({ success: true, data: profile });
});

app.put("/api/tone-profile/:tenantId", (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  if (!validateTenantIdParam(tenantId, res)) return;

  const result = validateToneProfile(req.body);

  if (!result.valid) {
    res.status(422).json({ error: result.error });
    return;
  }

  if (result.data.tenant_id !== tenantId) {
    res
      .status(422)
      .json({ error: "tenant_id in body must match URL parameter" });
    return;
  }

  try {
    saveToneProfile(result.data);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save tone profile" });
  }
});

app.delete("/api/tone-profile/:tenantId", (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  if (!validateTenantIdParam(tenantId, res)) return;

  const deleted = deleteToneProfile(tenantId);
  if (!deleted) {
    res.status(404).json({ error: "Tone profile not found" });
    return;
  }

  res.json({ success: true });
});

// --- Onboarding endpoints ---

app.post(
  "/api/onboarding/test-connection",
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const errors: string[] = [];
    if (typeof body.imapHost !== "string" || body.imapHost === "")
      errors.push('"imapHost" must be a non-empty string');
    if (typeof body.imapPort !== "number" || !Number.isFinite(body.imapPort))
      errors.push('"imapPort" must be a number');
    if (typeof body.email !== "string" || body.email === "")
      errors.push('"email" must be a non-empty string');
    if (typeof body.password !== "string" || body.password === "")
      errors.push('"password" must be a non-empty string');

    if (errors.length > 0) {
      res.status(422).json({ error: errors.join("; ") });
      return;
    }

    const result = await testImapConnection({
      host: body.imapHost as string,
      port: body.imapPort as number,
      user: body.email as string,
      password: body.password as string,
      tls: true,
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, folder: result.folder });
  },
);

app.post(
  "/api/onboarding/scan-sent",
  express.json({ limit: "2mb" }),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const errors: string[] = [];
    if (typeof body.imapHost !== "string" || body.imapHost === "")
      errors.push('"imapHost" must be a non-empty string');
    if (typeof body.imapPort !== "number" || !Number.isFinite(body.imapPort))
      errors.push('"imapPort" must be a number');
    if (typeof body.email !== "string" || body.email === "")
      errors.push('"email" must be a non-empty string');
    if (typeof body.password !== "string" || body.password === "")
      errors.push('"password" must be a non-empty string');
    if (typeof body.tenant_id !== "string" || body.tenant_id === "")
      errors.push('"tenant_id" must be a non-empty string');
    if (
      typeof body.tenant_id === "string" &&
      !TENANT_ID_PATTERN.test(body.tenant_id)
    ) {
      errors.push(
        '"tenant_id" must contain only alphanumeric characters, hyphens, and underscores',
      );
    }

    if (errors.length > 0) {
      res.status(422).json({ error: errors.join("; ") });
      return;
    }

    const tenantId = body.tenant_id as string;
    const language = (body.language === "en" ? "en" : "de") as "de" | "en";

    try {
      writeAuditLog(
        {
          action: "email_ingested",
          email_id: tenantId,
          category: "onboarding_scan",
          result: "success",
        },
        req.ip,
      );

      const scanResult = await scanSentEmails({
        host: body.imapHost as string,
        port: body.imapPort as number,
        user: body.email as string,
        password: body.password as string,
        tls: true,
      });

      if (scanResult.emails.length < 3) {
        res.status(422).json({
          error: `Only found ${scanResult.emails.length} sent emails — need at least 3 for tone analysis`,
          emails_found: scanResult.emails.length,
        });
        return;
      }

      const subjects = scanResult.emails.map((e) => e.subject);
      const rawEmails = scanResult.emails.map((e) => ({
        subject: e.subject,
        body: e.body,
      }));

      // Generate tone profile inline (best-effort — scan data is still returned on failure)
      let profile = null;
      try {
        const emailBodies = scanResult.emails.map((e) => e.body);
        profile = await generateToneProfile(tenantId, emailBodies, language);
      } catch (profileErr) {
        console.error(
          "Tone profile generation failed (non-fatal):",
          profileErr,
        );
      }

      res.json({
        success: true,
        profile,
        emails_scanned: scanResult.emails.length,
        subjects,
        rawEmails,
        detectedSignature: scanResult.detectedSignature,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const rootCause =
        error instanceof Error
          ? (error as unknown as Record<string, unknown>).cause
          : undefined;
      const causeMsg =
        rootCause instanceof Error ? rootCause.message : undefined;
      res.status(500).json({
        error: `Onboarding scan failed: ${message}`,
        ...(causeMsg ? { cause: causeMsg } : {}),
      });
    }
  },
);

app.post(
  "/api/onboarding/manual-profile",
  express.json({ limit: "2mb" }),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const errors: string[] = [];
    if (typeof body.tenant_id !== "string" || body.tenant_id === "") {
      errors.push('"tenant_id" must be a non-empty string');
    }
    if (
      typeof body.tenant_id === "string" &&
      !TENANT_ID_PATTERN.test(body.tenant_id)
    ) {
      errors.push(
        '"tenant_id" must contain only alphanumeric characters, hyphens, and underscores',
      );
    }

    if (!Array.isArray(body.example_emails)) {
      errors.push('"example_emails" must be an array');
    } else if (
      body.example_emails.length < 3 ||
      body.example_emails.length > 5
    ) {
      errors.push('"example_emails" must contain 3-5 items');
    } else {
      for (let i = 0; i < body.example_emails.length; i++) {
        if (
          typeof body.example_emails[i] !== "string" ||
          (body.example_emails[i] as string).trim() === ""
        ) {
          errors.push(`"example_emails[${i}]" must be a non-empty string`);
        } else if ((body.example_emails[i] as string).length > 50_000) {
          errors.push(`"example_emails[${i}]" exceeds maximum length of 50000`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(422).json({ error: errors.join("; ") });
      return;
    }

    const tenantId = body.tenant_id as string;
    const language = (body.language === "en" ? "en" : "de") as "de" | "en";
    const emailBodies = (body.example_emails as string[]).map((e) => e.trim());

    try {
      const profile = await generateToneProfile(
        tenantId,
        emailBodies,
        language,
      );

      res.json({
        success: true,
        profile,
        emails_scanned: emailBodies.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: `Profile generation failed: ${message}` });
    }
  },
);

// --- scrape-website ---

app.post(
  "/api/onboarding/scrape-website",
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    if (typeof body.url !== "string" || body.url.trim() === "") {
      res.status(422).json({ error: '"url" must be a non-empty string' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(body.url.trim());
    } catch {
      res.status(422).json({ error: '"url" is not a valid URL' });
      return;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res.status(422).json({ error: '"url" must use http or https protocol' });
      return;
    }

    try {
      const result = await scrapeWebsite(parsed.href);
      res.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: `Website scrape failed: ${message}` });
    }
  },
);

// --- analyze-tone ---

app.post(
  "/api/onboarding/analyze-tone",
  express.json({ limit: "2mb" }),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const errors: string[] = [];
    if (!Array.isArray(body.sentEmails)) {
      errors.push('"sentEmails" must be an array');
    } else if (body.sentEmails.length === 0) {
      errors.push('"sentEmails" must contain at least one email');
    } else {
      for (let i = 0; i < Math.min(body.sentEmails.length, 20); i++) {
        const email = body.sentEmails[i] as Record<string, unknown>;
        if (typeof email !== "object" || email === null) {
          errors.push(`"sentEmails[${i}]" must be an object`);
        } else {
          if (typeof email.subject !== "string")
            errors.push(`"sentEmails[${i}].subject" must be a string`);
          if (typeof email.body !== "string")
            errors.push(`"sentEmails[${i}].body" must be a string`);
        }
      }
    }

    if (
      body.websiteContent !== null &&
      body.websiteContent !== undefined &&
      typeof body.websiteContent !== "string"
    ) {
      errors.push('"websiteContent" must be a string or null');
    }

    if (errors.length > 0) {
      res.status(422).json({ error: errors.join("; ") });
      return;
    }

    const sentEmails = (
      body.sentEmails as Array<{ subject: string; body: string }>
    ).slice(0, 20);
    const websiteContent =
      typeof body.websiteContent === "string" ? body.websiteContent : null;

    try {
      const profile = await analyzeTone(sentEmails, websiteContent);
      res.json({ success: true, profile });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: `Tone analysis failed: ${message}` });
    }
  },
);

// --- save-tenant ---

app.post("/api/onboarding/save-tenant", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const errors: string[] = [];
  if (typeof body.credentials !== "object" || body.credentials === null) {
    errors.push('"credentials" must be an object');
  } else {
    const creds = body.credentials as Record<string, unknown>;
    if (typeof creds.email !== "string" || creds.email === "")
      errors.push('"credentials.email" is required');
    if (typeof creds.password !== "string" || creds.password === "")
      errors.push('"credentials.password" is required');
    if (typeof creds.imapHost !== "string")
      errors.push('"credentials.imapHost" is required');
    if (typeof creds.smtpHost !== "string")
      errors.push('"credentials.smtpHost" is required');
  }

  if (typeof body.toneProfile !== "object" || body.toneProfile === null) {
    errors.push('"toneProfile" must be an object');
  }

  if (errors.length > 0) {
    res.status(422).json({ error: errors.join("; ") });
    return;
  }

  const creds = body.credentials as Record<string, unknown>;
  const tenantId =
    typeof body.tenantId === "string" && body.tenantId !== ""
      ? body.tenantId
      : (creds.email as string).replace(/[^a-zA-Z0-9_-]/g, "_");

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res
      .status(422)
      .json({ error: "Derived tenant_id contains invalid characters" });
    return;
  }

  try {
    const tenantData = {
      tenant_id: tenantId,
      imap_host: creds.imapHost as string,
      imap_port: typeof creds.imapPort === "number" ? creds.imapPort : 993,
      imap_user: creds.email as string,
      imap_password: creds.password as string,
      smtp_host: creds.smtpHost as string,
      smtp_port: typeof creds.smtpPort === "number" ? creds.smtpPort : 465,
      smtp_user: creds.email as string,
      smtp_password: creds.password as string,
    };

    // Write to local SQLite (Express dev server)
    upsertTenant({
      ...tenantData,
      tone_profile: JSON.stringify(body.toneProfile),
    });

    // Write to Turso (production DB — poller reads from here)
    try {
      await initTursoDb();
      await upsertTenantTurso(tenantData);
    } catch (tursoError) {
      // Log but don't fail the request — local save succeeded
      const tursoMsg =
        tursoError instanceof Error ? tursoError.message : "Unknown error";
      process.stderr.write(`[save-tenant] Turso sync failed: ${tursoMsg}\n`);
    }

    res.json({ success: true, tenantId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Save failed: ${message}` });
  }
});

// --- Demo endpoint (gated behind DEMO_MODE env var) ---

const DEMO_MODE = process.env.DEMO_MODE === "true";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post("/api/demo/trigger", async (req: Request, res: Response) => {
  if (!DEMO_MODE) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (!isValidScenario(body.scenario)) {
    res.status(422).json({
      error:
        '"scenario" must be one of: all, spam, ad, urgent, other, escalation, unsubscribe',
    });
    return;
  }

  const emails = getDemoEmails(body.scenario);
  const tenantId = getTenantIdFromBody(req);
  const STAGGER_DELAY_MS = 500;

  try {
    for (let i = 0; i < emails.length; i++) {
      const { dbCategory, payload } = emails[i];
      insertEmail(dbCategory, payload, tenantId);
      broadcast({ type: "email:new", data: payload });

      if (body.scenario === "all" && i < emails.length - 1) {
        await delay(STAGGER_DELAY_MS);
      }
    }

    res.json({ success: true, count: emails.length, scenario: body.scenario });
  } catch {
    res.status(500).json({ error: "Failed to trigger demo emails" });
  }
});

// --- Start server ---

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    const timestamp = new Date().toISOString();
    process.stdout.write(
      `[${timestamp}] Dashboard API server running on port ${port}\n`,
    );
    process.stdout.write(`  POST   /api/tenants             (create tenant)\n`);
    process.stdout.write(
      `  GET    /api/tenants/:id/config   (get tenant config)\n`,
    );
    process.stdout.write(
      `  POST   /api/email/:category   (spam, ad, draft, escalation, unsubscribe)\n`,
    );
    process.stdout.write(
      `  GET    /api/emails             (all emails, grouped by category)\n`,
    );
    process.stdout.write(
      `  GET    /api/emails/counts      (counts per category)\n`,
    );
    process.stdout.write(
      `  GET    /api/emails/:category   (emails for one category)\n`,
    );
    process.stdout.write(`  DELETE /api/email/:emailId     (soft delete)\n`);
    process.stdout.write(`  PATCH  /api/email/:emailId     (update status)\n`);
    process.stdout.write(`  GET    /events                 (SSE stream)\n`);
    process.stdout.write(`  POST   /api/audit              (audit log)\n`);
    process.stdout.write(`  GET    /api/health             (health check)\n`);
    process.stdout.write(
      `  POST   /api/tone-profile/analyze         (generate analyzer prompt)\n`,
    );
    process.stdout.write(
      `  PUT    /api/tone-profile/:tenantId       (save tone profile)\n`,
    );
    process.stdout.write(
      `  GET    /api/tone-profile/:tenantId       (get tone profile)\n`,
    );
    process.stdout.write(
      `  DELETE /api/tone-profile/:tenantId       (delete tone profile)\n`,
    );
    process.stdout.write(
      `  GET    /api/tone-profile/:tenantId/injection (get injection string)\n`,
    );
    process.stdout.write(
      `  GET    /api/tone-profiles                (list all tenant IDs)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/test-connection   (test IMAP connection)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/scan-sent         (IMAP scan + generate profile)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/manual-profile    (manual emails + generate profile)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/scrape-website    (scrape company website)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/analyze-tone      (OpenAI tone analysis)\n`,
    );
    process.stdout.write(
      `  POST   /api/onboarding/save-tenant       (save tenant + tone profile)\n`,
    );
    if (DEMO_MODE) {
      process.stdout.write(
        `  POST   /api/demo/trigger               (demo email trigger — DEMO_MODE=true)\n`,
      );
    }
  });
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { validateApiKey } from "../../src/server/auth.js";
import {
  initTursoDb,
  createTenant,
  getTenantConfig,
  upsertTenant,
  listTenants,
  setTenantActive,
  deleteTenantCascade,
  setAccessToken,
  getTenantByAccessToken,
} from "../../src/server/db-turso.js";
import {
  testImapConnection,
  scanSentEmails,
} from "../../src/server/onboarding/imap-scan.js";
import { backfillInbox } from "../../src/server/onboarding/backfill-inbox.js";
import { generateToneProfile } from "../../src/server/onboarding/run-profile.js";
import {
  initToneProfilesTable,
  saveToneProfile,
} from "../../src/server/tone-profile/store-turso.js";
import { analyzeTone } from "../../src/server/onboarding/analyze-tone.js";
import { scrapeWebsite } from "../../src/server/onboarding/scrape-website.js";

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Parse a value into a string array. Handles:
 * - string[] → returned as-is (filtered to non-empty)
 * - string → split on commas, trimmed, filtered to non-empty
 * - anything else → empty array
 */
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (!tableInitialized) {
    await initToneProfilesTable();
    tableInitialized = true;
  }
}

function validateImapFields(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof body.imapHost !== "string" || body.imapHost === "")
    errors.push('"imapHost" must be a non-empty string');
  if (typeof body.imapPort !== "number" || !Number.isFinite(body.imapPort))
    errors.push('"imapPort" must be a number');
  if (typeof body.email !== "string" || body.email === "")
    errors.push('"email" must be a non-empty string');
  if (typeof body.password !== "string" || body.password === "")
    errors.push('"password" must be a non-empty string');
  return errors;
}

async function handleTestConnection(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const errors = validateImapFields(body);

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
    res.status(400).json({
      success: false,
      error: (result as { success: false; error: string }).error,
    });
    return;
  }

  res.json({
    success: true,
    folder: (result as { success: true; folder: string }).folder,
  });
}

async function handleScanSent(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const errors = validateImapFields(body);

  if (errors.length > 0) {
    res.status(422).json({ error: errors.join("; ") });
    return;
  }

  try {
    const result = await scanSentEmails({
      host: body.imapHost as string,
      port: body.imapPort as number,
      user: body.email as string,
      password: body.password as string,
      tls: true,
    });

    res.json({
      success: true,
      emails_scanned: result.emails.length,
      subjects: result.emails.map((e) => e.subject),
      rawEmails: result.emails.map((e) => e.body),
      detectedSignature: result.detectedSignature,
      _debug: result._debug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Scan failed: ${message}` });
  }
}

async function handleManualProfile(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
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
  } else if (body.example_emails.length < 3 || body.example_emails.length > 5) {
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
    await ensureTable();

    const profile = await generateToneProfile(
      tenantId,
      emailBodies,
      language,
      saveToneProfile,
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
}

async function handleAnalyzeTone(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const errors: string[] = [];

  if (!Array.isArray(body.sentEmails) || body.sentEmails.length === 0) {
    errors.push('"sentEmails" must be a non-empty array');
  } else {
    for (let i = 0; i < body.sentEmails.length; i++) {
      const item = body.sentEmails[i] as Record<string, unknown> | undefined;
      if (typeof item !== "object" || item === null) {
        errors.push(
          `"sentEmails[${i}]" must be an object with { subject, body }`,
        );
      } else {
        if (typeof item.subject !== "string")
          errors.push(`"sentEmails[${i}].subject" must be a string`);
        if (typeof item.body !== "string")
          errors.push(`"sentEmails[${i}].body" must be a string`);
      }
    }
  }

  if (errors.length > 0) {
    res.status(422).json({ error: errors.join("; ") });
    return;
  }

  const sentEmails = body.sentEmails as Array<{
    subject: string;
    body: string;
  }>;
  const websiteContent =
    typeof body.websiteContent === "string" ? body.websiteContent : null;

  try {
    const profile = await analyzeTone(sentEmails, websiteContent);
    res.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Tone analysis failed: ${message}` });
  }
}

async function handleScrapeWebsite(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const body = req.body as Record<string, unknown>;

  if (typeof body.url !== "string" || body.url === "") {
    res.status(422).json({ error: '"url" must be a non-empty string' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    res.status(422).json({ error: '"url" must be a valid URL' });
    return;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(422).json({ error: '"url" must use http or https protocol' });
    return;
  }

  try {
    const result = await scrapeWebsite(body.url);
    res.json({
      success: true,
      ...result,
      keywords: result.brandKeywords,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Scrape failed: ${message}` });
  }
}

async function handleSaveTenant(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
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
    await initTursoDb();
    await ensureTable();

    const emailSignature =
      typeof body.emailSignature === "string" ? body.emailSignature : "";

    await upsertTenant({
      tenant_id: tenantId,
      imap_host: creds.imapHost as string,
      imap_port: typeof creds.imapPort === "number" ? creds.imapPort : 993,
      imap_user: creds.email as string,
      imap_password: creds.password as string,
      smtp_host: creds.smtpHost as string,
      smtp_port: typeof creds.smtpPort === "number" ? creds.smtpPort : 465,
      smtp_user: creds.email as string,
      smtp_password: creds.password as string,
      email_signature: emailSignature,
    });

    const toneData = body.toneProfile as Record<string, unknown>;
    const now = new Date().toISOString();

    const jargon = parseStringArray(toneData.jargon);

    await saveToneProfile({
      tenant_id: tenantId,
      greeting_style:
        typeof toneData.greeting === "string" ? toneData.greeting : "",
      closing_style:
        typeof toneData.closing === "string" ? toneData.closing : "",
      formality_level:
        toneData.formality === "informal" ? "informal" : "formal",
      sentence_length: "medium",
      vocabulary_complexity: "moderate",
      emotional_tone:
        typeof toneData.sentenceStyle === "string"
          ? toneData.sentenceStyle
          : "",
      use_of_humor: false,
      typical_phrases: Array.isArray(toneData.preferences)
        ? (toneData.preferences as string[])
        : [],
      avoidances: Array.isArray(toneData.avoidances)
        ? (toneData.avoidances as string[])
        : [],
      industry_jargon: jargon,
      language: "de",
      created_at: now,
      updated_at: now,
    });

    const accessToken = crypto.randomBytes(12).toString("hex");
    await setAccessToken(tenantId, accessToken);

    res.json({ success: true, tenantId, accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Save failed: ${message}` });
  }
}

async function handleBackfillInbox(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const body = req.body as Record<string, unknown>;

  if (typeof body.tenantId !== "string" || body.tenantId === "") {
    res.status(422).json({ error: '"tenantId" must be a non-empty string' });
    return;
  }

  try {
    await initTursoDb();
    const tenant = await getTenantConfig(body.tenantId);

    if (!tenant) {
      res.status(404).json({ error: `Tenant "${body.tenantId}" not found` });
      return;
    }

    if (!tenant.imap_host || !tenant.imap_user || !tenant.imap_password) {
      res
        .status(422)
        .json({ error: "Tenant has no IMAP credentials configured" });
      return;
    }

    const result = await backfillInbox({
      tenantId: body.tenantId,
      imapHost: tenant.imap_host,
      imapPort: typeof tenant.imap_port === "number" ? tenant.imap_port : 993,
      imapUser: tenant.imap_user,
      imapPassword: tenant.imap_password,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `Backfill failed: ${message}` });
  }
}

async function handleCreateTenant(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();
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

  const existing = await getTenantConfig(body.tenant_id);
  if (existing) {
    res
      .status(409)
      .json({ error: `Tenant "${body.tenant_id}" already exists` });
    return;
  }

  try {
    const tenant = await createTenant({
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
      email_signature:
        typeof body.email_signature === "string"
          ? body.email_signature
          : undefined,
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
}

async function handleGetTenant(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();
  const tenantId = (req.query.tenant_id as string) || "";

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res.status(400).json({ error: "Invalid tenant_id" });
    return;
  }

  const config = await getTenantConfig(tenantId);
  if (!config) {
    res.status(404).json({ error: `Tenant "${tenantId}" not found` });
    return;
  }

  const safeConfig = {
    ...config,
    imap_password: config.imap_password ? "***" : null,
    smtp_password: config.smtp_password ? "***" : null,
    siteware_token: config.siteware_token ? "***" : null,
  };

  res.json({ success: true, data: safeConfig });
}

async function handleListTenants(
  _req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();

  try {
    const tenants = await listTenants();
    res.json({ success: true, data: tenants });
  } catch {
    res.status(500).json({ error: "Failed to list tenants" });
  }
}

async function handleToggleTenant(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();
  const body = req.body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof body.tenant_id !== "string" || body.tenant_id === "") {
    errors.push('"tenant_id" must be a non-empty string');
  }
  if (typeof body.active !== "boolean") {
    errors.push('"active" must be a boolean');
  }

  if (errors.length > 0) {
    res.status(422).json({ error: errors.join("; ") });
    return;
  }

  const tenantId = body.tenant_id as string;
  const existing = await getTenantConfig(tenantId);
  if (!existing) {
    res.status(404).json({ error: `Tenant "${tenantId}" not found` });
    return;
  }

  try {
    await setTenantActive(tenantId, body.active as boolean);
    res.json({ success: true, tenant_id: tenantId, active: body.active });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
}

async function handleDeleteTenant(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();
  const body = req.body as Record<string, unknown>;

  if (typeof body.tenant_id !== "string" || body.tenant_id === "") {
    res.status(422).json({ error: '"tenant_id" must be a non-empty string' });
    return;
  }

  const tenantId = body.tenant_id as string;
  const existing = await getTenantConfig(tenantId);
  if (!existing) {
    res.status(404).json({ error: `Tenant "${tenantId}" not found` });
    return;
  }

  try {
    await deleteTenantCascade(tenantId);
    res.json({ success: true, deleted: tenantId });
  } catch {
    res.status(500).json({ error: "Failed to delete tenant" });
  }
}

async function handleUpdateSignature(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await initTursoDb();
  const body = req.body as Record<string, unknown>;

  if (typeof body.tenant_id !== "string" || body.tenant_id === "") {
    res.status(422).json({ error: '"tenant_id" must be a non-empty string' });
    return;
  }
  if (!TENANT_ID_PATTERN.test(body.tenant_id)) {
    res.status(400).json({ error: "Invalid tenant_id format" });
    return;
  }
  if (typeof body.email_signature !== "string") {
    res.status(422).json({ error: '"email_signature" must be a string' });
    return;
  }
  if ((body.email_signature as string).length > 10_000) {
    res
      .status(422)
      .json({ error: '"email_signature" exceeds maximum length of 10000' });
    return;
  }

  const tenantId = body.tenant_id as string;
  const existing = await getTenantConfig(tenantId);
  if (!existing) {
    res.status(404).json({ error: `Tenant "${tenantId}" not found` });
    return;
  }

  try {
    const { getTursoClient } = await import("../../src/server/db-turso.js");
    const db = getTursoClient();
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE tenants SET email_signature = ?, updated_at = ? WHERE tenant_id = ?`,
      args: [body.email_signature as string, now, tenantId],
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update signature" });
  }
}

async function handleVerify(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const token = req.query.t as string | undefined;

  if (typeof token !== "string" || token === "") {
    res.status(401).json({ error: "Missing access token" });
    return;
  }

  try {
    await initTursoDb();

    const tenant = await getTenantByAccessToken(token);
    if (!tenant) {
      res.status(401).json({ error: "Invalid or inactive token" });
      return;
    }

    res.json({ tenant_id: tenant.tenant_id, imap_user: tenant.imap_user });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
}

const postHandlers: Record<
  string,
  (req: VercelRequest, res: VercelResponse) => Promise<void>
> = {
  "test-connection": handleTestConnection,
  "scan-sent": handleScanSent,
  "manual-profile": handleManualProfile,
  "create-tenant": handleCreateTenant,
  "analyze-tone": handleAnalyzeTone,
  "scrape-website": handleScrapeWebsite,
  "save-tenant": handleSaveTenant,
  "backfill-inbox": handleBackfillInbox,
  "tenant-toggle": handleToggleTenant,
  "tenant-delete": handleDeleteTenant,
  "update-signature": handleUpdateSignature,
};

const validPostActions = new Set<string>(Object.keys(postHandlers));

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const action = req.query.action as string;

  // GET /api/onboarding/verify?t=xxx — public endpoint, no API key needed
  if (req.method === "GET" && action === "verify") {
    await handleVerify(req, res);
    return;
  }

  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // GET /api/onboarding/tenants — list all tenants (settings page)
  if (req.method === "GET" && action === "tenants") {
    await handleListTenants(req, res);
    return;
  }

  // GET /api/onboarding/tenant?tenant_id=xxx
  if (req.method === "GET" && action === "tenant") {
    await handleGetTenant(req, res);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!validPostActions.has(action)) {
    res.status(400).json({
      error: `Invalid action "${action}". Must be one of: ${[...validPostActions].join(", ")}`,
    });
    return;
  }

  await postHandlers[action](req, res);
}

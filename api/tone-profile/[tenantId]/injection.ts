import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../../src/server/auth.js";
import { buildInjection } from "../../../src/server/tone-profile/composer-injection.js";
import {
  initToneProfilesTable,
  loadToneProfile,
} from "../../../src/server/tone-profile/store-turso.js";
import { initTursoDb, getTenantConfig } from "../../../src/server/db-turso.js";

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (!tableInitialized) {
    await initTursoDb();
    await initToneProfilesTable();
    tableInitialized = true;
  }
}

const URGENT_OVERRIDE = [
  "",
  "## URGENT Override",
  "- Use strictly formal tone regardless of baseline profile",
  '- Use "Sie" form exclusively',
  "- No humor, no casual phrasing",
  "- Be direct and action-oriented",
  "- Acknowledge urgency explicitly",
].join("\n");

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const tenantId = req.query.tenantId as string;

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res.status(400).json({
      error:
        "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    });
    return;
  }

  const classification =
    typeof req.query.classification === "string"
      ? req.query.classification.toUpperCase()
      : "OTHER";

  await ensureTable();

  const profile = await loadToneProfile(tenantId);

  if (!profile) {
    res.json({
      injection: "",
      signature: "",
      classification,
      tenant_id: tenantId,
    });
    return;
  }

  const baseInjection = buildInjection(profile);

  const injection =
    classification === "URGENT"
      ? baseInjection + URGENT_OVERRIDE
      : baseInjection;

  const tenant = await getTenantConfig(tenantId);
  const signature = tenant?.email_signature ?? "";

  res.json({ injection, signature, classification, tenant_id: tenantId });
}

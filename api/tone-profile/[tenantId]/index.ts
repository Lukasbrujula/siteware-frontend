import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../../src/server/auth.js";
import { validateToneProfile } from "../../../src/server/tone-profile/schema.js";
import {
  initToneProfilesTable,
  saveToneProfile,
  loadToneProfile,
  deleteToneProfile,
} from "../../../src/server/tone-profile/store-turso.js";

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (!tableInitialized) {
    await initToneProfilesTable();
    tableInitialized = true;
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

  const tenantId = req.query.tenantId as string;

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    res.status(400).json({
      error:
        "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    });
    return;
  }

  await ensureTable();

  if (req.method === "GET") {
    const profile = await loadToneProfile(tenantId);
    if (!profile) {
      res.status(404).json({ error: "Tone profile not found" });
      return;
    }
    res.json({ success: true, data: profile });
    return;
  }

  if (req.method === "PUT") {
    const result = validateToneProfile(req.body);

    if (!result.valid) {
      res
        .status(422)
        .json({ error: (result as { valid: false; error: string }).error });
      return;
    }

    if (result.data.tenant_id !== tenantId) {
      res
        .status(422)
        .json({ error: "tenant_id in body must match URL parameter" });
      return;
    }

    try {
      await saveToneProfile(result.data);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to save tone profile" });
    }
    return;
  }

  if (req.method === "DELETE") {
    const deleted = await deleteToneProfile(tenantId);
    if (!deleted) {
      res.status(404).json({ error: "Tone profile not found" });
      return;
    }
    res.json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import {
  initToneProfilesTable,
  listToneProfiles,
} from "../../src/server/tone-profile/store-turso.js";

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

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  await ensureTable();

  try {
    const tenantIds = await listToneProfiles();
    res.json({ success: true, data: tenantIds });
  } catch {
    res.status(500).json({ error: "Failed to list tone profiles" });
  }
}

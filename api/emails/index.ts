import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import { initTursoDb, getAll } from "../../src/server/db-turso.js";

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

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const tenantId = (req.query.tenant_id as string) || "default";

  await ensureDb();

  try {
    const emails = await getAll(tenantId);
    res.json({ success: true, data: emails });
  } catch {
    res.status(500).json({ error: "Failed to retrieve emails" });
  }
}

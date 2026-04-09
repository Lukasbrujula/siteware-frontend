import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import {
  initTursoDb,
  getEmailsByCategory,
  getAllPending,
  getSentEmails,
} from "../../src/server/db-turso.js";

const validCategories = new Set([
  "spam",
  "ad",
  "urgent",
  "other",
  "escalation",
  "unsubscribe",
]);

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

  const category = req.query.category as string;
  const tenantId = (req.query.tenant_id as string) || "default";

  await ensureDb();

  // GET /api/emails/counts — return category counts
  if (category === "counts") {
    try {
      const counts = await getAllPending(tenantId);
      res.json({ success: true, data: counts });
    } catch {
      res.status(500).json({ error: "Failed to retrieve counts" });
    }
    return;
  }

  // GET /api/emails/sent — return approved/sent emails from audit log
  if (category === "sent") {
    try {
      const sent = await getSentEmails(tenantId);
      res.json({ success: true, data: sent });
    } catch {
      res.status(500).json({ error: "Failed to retrieve sent emails" });
    }
    return;
  }

  if (!validCategories.has(category)) {
    res.status(400).json({
      error: `Invalid category "${category}". Must be one of: ${[...validCategories].join(", ")}`,
    });
    return;
  }

  try {
    const emails = await getEmailsByCategory(category, tenantId);
    res.json({ success: true, data: emails });
  } catch {
    res.status(500).json({ error: "Failed to retrieve emails" });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";

const N8N_BASE = "https://siteware.app.n8n.cloud/webhook";

const actionToPath: Record<string, string> = {
  approve: "/email-approve-v2",
  reject: "/email-reject-v2",
  retriage: "/email-retriage-v2",
  unsubscribe: "/email-unsubscribe-v2",
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const action = req.query.action as string;
  const path = actionToPath[action];

  if (!path) {
    res.status(400).json({
      error: `Invalid action "${action}". Must be one of: ${Object.keys(actionToPath).join(", ")}`,
    });
    return;
  }

  const url = `${N8N_BASE}${path}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30_000),
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    res
      .status(upstream.status)
      .json(typeof body === "string" ? { raw: body } : body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown proxy error";
    res.status(502).json({ error: message });
  }
}

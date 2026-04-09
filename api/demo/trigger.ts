import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import {
  isValidScenario,
  getDemoEmails,
} from "../../src/server/demo/test-emails.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (process.env.DEMO_MODE !== "true") {
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

  res.json({
    success: true,
    count: emails.length,
    scenario: body.scenario,
    emails: emails.map(({ dbCategory, payload }) => ({
      category: dbCategory,
      ...payload,
    })),
  });
}

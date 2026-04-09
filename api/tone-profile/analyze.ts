import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateApiKey } from "../../src/server/auth.js";
import { validateAnalyzeRequest } from "../../src/server/tone-profile/schema.js";
import { buildAnalyzerPrompt } from "../../src/server/tone-profile/analyzer-prompt.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const result = validateAnalyzeRequest(req.body);

  if (!result.valid) {
    res
      .status(422)
      .json({ error: (result as { valid: false; error: string }).error });
    return;
  }

  const prompt = buildAnalyzerPrompt(result.data);
  res.json({ success: true, prompt });
}

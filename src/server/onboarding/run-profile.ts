import type { ToneProfile } from "../../types/tone-profile.js";
import { buildAnalyzerPrompt } from "../tone-profile/analyzer-prompt.js";
import { validateToneProfile } from "../tone-profile/schema.js";
import { saveToneProfile } from "../tone-profile/store.js";

const SITEWARE_API_URL = "https://stagingapi.siteware.io/v1/api/completion";
const REQUEST_TIMEOUT_MS = 60_000;

type CompletionResponse = {
  readonly answer?: string;
};

/**
 * Strip markdown code fences from AI response.
 *
 * The AI sometimes wraps JSON in ```json ... ``` blocks despite
 * being told not to.
 */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();

  // Match ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return trimmed;
}

type PersistFn = (profile: ToneProfile) => void | Promise<void>;

/**
 * Call the Siteware completion API to analyze example emails and
 * extract a tone profile, then validate and persist it.
 *
 * @param tenantId - The tenant this profile belongs to
 * @param exampleEmails - 3-5 email body texts to analyze
 * @param language - The detected or specified language ('de' | 'en')
 * @param persist - Optional persistence callback (defaults to file-based saveToneProfile)
 * @returns The validated and saved ToneProfile
 */
export async function generateToneProfile(
  tenantId: string,
  exampleEmails: readonly string[],
  language: "de" | "en" = "de",
  persist: PersistFn = saveToneProfile,
): Promise<ToneProfile> {
  const apiToken = process.env.SITEWARE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "SITEWARE_API_TOKEN environment variable is not configured",
    );
  }

  const prompt = buildAnalyzerPrompt({
    tenant_id: tenantId,
    example_emails: exampleEmails,
    language,
  });

  const response = await fetch(SITEWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      prompt,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Siteware API error: HTTP ${response.status} — ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as CompletionResponse;
  if (!data.answer) {
    throw new Error("Siteware API returned no answer field");
  }

  const cleaned = stripMarkdownFences(data.answer);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  // The AI returns the tone fields without tenant_id / timestamps.
  // We enrich the parsed object with those before validation.
  const now = new Date().toISOString();
  const enriched = {
    ...(parsed as Record<string, unknown>),
    tenant_id: tenantId,
    language,
    created_at: now,
    updated_at: now,
  };

  const result = validateToneProfile(enriched);
  if (!result.valid) {
    throw new Error(
      `AI response failed ToneProfile validation: ${(result as { valid: false; error: string }).error}`,
    );
  }

  await persist(result.data);
  return result.data;
}

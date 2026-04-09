/**
 * n8n Code Node: Reply Composer with Tone Profile
 *
 * Paste into both "Reply Composer (Urgent)" and "Reply Composer (Other)"
 * Code nodes. Fetches the tenant's tone profile injection from the
 * dashboard API and outputs it as the knowledgebase value for the
 * Siteware agent taskSettings.
 *
 * Input fields:
 *   - original_email     (string) — the email being replied to
 *   - reply_language     ("de" | "en")
 *   - base_system_prompt (string) — the existing Reply Composer system prompt
 *
 * Output:
 *   - system_prompt      (string) — passed through unchanged
 *   - original_email     (string) — passed through unchanged
 *   - reply_language     (string) — passed through unchanged
 *   - knowledgebase      (string) — tone profile injection (empty if unavailable)
 *   - tone_applied       (boolean) — whether a tone profile was injected
 */

const TONE_PROFILE_URL =
  "https://siteware-email-dashboard.vercel.app/api/tone-profile/default/injection";

const items = $input.all();
const results = [];

for (const item of items) {
  const { original_email, reply_language, base_system_prompt } = item.json;

  let knowledgebase = "";
  let toneApplied = false;

  try {
    const data = await this.helpers.httpRequest({
      method: "GET",
      url: TONE_PROFILE_URL,
      json: true,
    });

    if (data.success && data.injection) {
      knowledgebase = data.injection;
      toneApplied = true;
    }
  } catch {
    // Non-fatal: proceed with empty knowledgebase if profile not found (404) or request fails
  }

  results.push({
    json: {
      system_prompt: base_system_prompt || "",
      original_email: original_email || "",
      reply_language: reply_language || "de",
      knowledgebase,
      tone_applied: toneApplied,
    },
  });
}

return results;

import type { AnalyzeRequest } from "../../types/tone-profile.js";

const GERMAN_INSTRUCTIONS = `Analysiere die folgenden Beispiel-E-Mails und extrahiere ein Tonprofil des Verfassers.
Antworte ausschließlich mit validem JSON (kein Markdown, keine Erklärungen).`;

const ENGLISH_INSTRUCTIONS = `Analyze the following example emails and extract a tone profile of the author.
Respond with valid JSON only (no markdown, no explanations).`;

const SCHEMA_DESCRIPTION = `The JSON must match this exact schema:
{
  "greeting_style": "string — the typical greeting phrase used",
  "closing_style": "string — the typical closing phrase used",
  "formality_level": "formal" | "semi-formal" | "informal",
  "sentence_length": "short" | "medium" | "long",
  "vocabulary_complexity": "simple" | "moderate" | "advanced",
  "emotional_tone": "string — e.g. 'warm but professional', 'direct and matter-of-fact'",
  "use_of_humor": true | false,
  "typical_phrases": ["string — max 10 characteristic phrases or expressions"],
  "avoidances": ["string — max 10 things the author avoids in their writing"]
}`;

export function buildAnalyzerPrompt(request: AnalyzeRequest): string {
  const instructions =
    request.language === "de" ? GERMAN_INSTRUCTIONS : ENGLISH_INSTRUCTIONS;

  const emailBlocks = request.example_emails
    .map(
      (email, i) =>
        `--- Email ${i + 1} ---\n${email}\n--- End Email ${i + 1} ---`,
    )
    .join("\n\n");

  return [instructions, "", SCHEMA_DESCRIPTION, "", emailBlocks].join("\n");
}

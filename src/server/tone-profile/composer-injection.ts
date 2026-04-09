import type { ToneProfile, EmailLength } from "../../types/tone-profile.js";

const FORMALITY_LABELS: Record<ToneProfile["formality_level"], string> = {
  formal: "Formal — use polite forms, full sentences, no contractions",
  "semi-formal": "Semi-formal — professional but approachable",
  informal: "Informal — casual, conversational tone",
};

const SENTENCE_LABELS: Record<ToneProfile["sentence_length"], string> = {
  short: "Keep sentences short and concise",
  medium: "Use medium-length sentences for balanced readability",
  long: "Use longer, detailed sentences when appropriate",
};

const VOCABULARY_LABELS: Record<ToneProfile["vocabulary_complexity"], string> =
  {
    simple: "Use simple, everyday vocabulary",
    moderate: "Use moderately complex vocabulary appropriate for business",
    advanced: "Use sophisticated vocabulary and domain-specific terms",
  };

const EMAIL_LENGTH_LABELS: Record<EmailLength, string> = {
  "so-kurz-wie-moeglich":
    "As short as possible — only the essential information",
  "sehr-kurz": "Very short — 2-3 sentences maximum",
  kurz: "Short — concise but complete",
  "mittlerer-umfang": "Medium length — balanced detail",
  detailliert: "Detailed — thorough explanations",
  umfangreich: "Comprehensive — full coverage of all points",
  "sehr-detailliert":
    "Very detailed — exhaustive coverage with in-depth explanations",
};

export function buildInjection(profile: ToneProfile): string {
  const lines: string[] = [
    "## Tone & Style Instructions",
    "",
    `- Greeting: Use "${profile.greeting_style}"`,
    `- Closing: Use "${profile.closing_style}"`,
  ];

  // Prefer Siteware platform fields when available
  if (profile.anrede) {
    lines.push(
      `- Address form: Use "${profile.anrede === "sie" ? "Sie" : "Du"}" consistently`,
    );
  } else {
    lines.push(`- Formality: ${FORMALITY_LABELS[profile.formality_level]}`);
  }

  if (profile.sprachstil && profile.sprachstil.length > 0) {
    lines.push(`- Writing style: ${profile.sprachstil.join(", ")}`);
  }

  if (profile.email_length) {
    lines.push(`- Email length: ${EMAIL_LENGTH_LABELS[profile.email_length]}`);
  } else {
    lines.push(`- Sentences: ${SENTENCE_LABELS[profile.sentence_length]}`);
  }

  lines.push(
    `- Vocabulary: ${VOCABULARY_LABELS[profile.vocabulary_complexity]}`,
  );
  lines.push(`- Emotional tone: ${profile.emotional_tone}`);
  lines.push(
    `- Humor: ${profile.use_of_humor ? "Light humor is acceptable when appropriate" : "Avoid humor — keep the tone serious and professional"}`,
  );

  if (profile.typical_phrases.length > 0) {
    lines.push(
      `- Incorporate these characteristic phrases when natural: ${profile.typical_phrases.join(", ")}`,
    );
  }

  if (profile.avoidances.length > 0) {
    lines.push(`- Avoid: ${profile.avoidances.join(", ")}`);
  }

  if (profile.industry_jargon && profile.industry_jargon.length > 0) {
    lines.push(
      `- Use these industry terms naturally: ${profile.industry_jargon.join(", ")}`,
    );
  }

  lines.push(
    `- Language: Write in ${profile.language === "de" ? "German" : "English"}`,
  );

  return lines.join("\n");
}

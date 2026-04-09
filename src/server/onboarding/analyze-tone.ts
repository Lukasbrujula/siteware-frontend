import OpenAI from "openai";

const MAX_EMAIL_SAMPLES = 10;
const OPENAI_TIMEOUT_MS = 60_000;

export type ToneProfileResult = {
  readonly formality: "formal_sie" | "informal_du";
  readonly greeting: string;
  readonly closing: string;
  readonly sentenceStyle: string;
  readonly avoid: readonly string[];
  readonly prefer: readonly string[];
  readonly industryTerms: readonly string[];
};

type EmailSample = {
  readonly subject: string;
  readonly body: string;
};

const SYSTEM_PROMPT = `You are a professional tone analyzer. Analyze the writing style of the provided emails and extract a structured tone profile. Return only valid JSON with this exact shape:
{
  "formality": "formal_sie" or "informal_du",
  "greeting": "typical greeting phrase",
  "closing": "typical closing phrase",
  "sentenceStyle": "brief description of sentence style",
  "avoid": ["words or phrases to avoid"],
  "prefer": ["preferred words or phrases"],
  "industryTerms": ["domain-specific terms found"]
}`;

function buildUserPrompt(
  emails: readonly EmailSample[],
  websiteContent: string | null,
): string {
  const samples = emails.slice(0, MAX_EMAIL_SAMPLES);
  const emailSection = samples
    .map((e, i) => `--- Email ${i + 1} ---\nSubject: ${e.subject}\n\n${e.body}`)
    .join("\n\n");

  const websiteSection = websiteContent
    ? `\n\n--- Website Content ---\n${websiteContent}`
    : "";

  return `Analyze the writing style of these emails and extract a tone profile:\n\n${emailSection}${websiteSection}`;
}

function validateResult(data: unknown): ToneProfileResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response is not a JSON object");
  }

  const obj = data as Record<string, unknown>;

  const formality = obj.formality;
  if (formality !== "formal_sie" && formality !== "informal_du") {
    throw new Error(`Invalid formality value: ${String(formality)}`);
  }

  const greeting = typeof obj.greeting === "string" ? obj.greeting : "";
  const closing = typeof obj.closing === "string" ? obj.closing : "";
  const sentenceStyle =
    typeof obj.sentenceStyle === "string" ? obj.sentenceStyle : "";

  const toStringArray = (val: unknown): readonly string[] =>
    Array.isArray(val)
      ? val.filter((v): v is string => typeof v === "string")
      : [];

  return {
    formality,
    greeting,
    closing,
    sentenceStyle,
    avoid: toStringArray(obj.avoid),
    prefer: toStringArray(obj.prefer),
    industryTerms: toStringArray(obj.industryTerms),
  };
}

export async function analyzeTone(
  sentEmails: readonly EmailSample[],
  websiteContent: string | null,
): Promise<ToneProfileResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not configured");
  }

  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(sentEmails, websiteContent) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsed: unknown = JSON.parse(content);
  return validateResult(parsed);
}

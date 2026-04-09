import type {
  ToneProfile,
  AnalyzeRequest,
  Anrede,
  Sprachstil,
  EmailLength,
} from "../../types/tone-profile.js";

type ValidationResult<T> =
  | { readonly valid: true; readonly data: T }
  | { readonly valid: false; readonly error: string };

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const FORMALITY_LEVELS = new Set(["formal", "semi-formal", "informal"]);
const SENTENCE_LENGTHS = new Set(["short", "medium", "long"]);
const VOCABULARY_COMPLEXITIES = new Set(["simple", "moderate", "advanced"]);
const LANGUAGES = new Set(["de", "en"]);
const ANREDE_VALUES = new Set<string>(["sie", "du"]);
const SPRACHSTIL_VALUES = new Set<string>([
  "professionell",
  "formell",
  "sachlich",
  "komplex",
  "einfach",
  "konservativ",
  "modern",
  "wissenschaftlich",
  "fachspezifisch",
  "abstrakt",
  "klar",
  "direkt",
  "rhetorisch",
  "ausdrucksstark",
]);
const EMAIL_LENGTH_VALUES = new Set<string>([
  "so-kurz-wie-moeglich",
  "sehr-kurz",
  "kurz",
  "mittlerer-umfang",
  "detailliert",
  "umfangreich",
  "sehr-detailliert",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function checkRequiredString(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength = 2_000,
): void {
  if (!isString(obj[field]) || obj[field] === "") {
    errors.push(`"${field}" must be a non-empty string`);
  } else if ((obj[field] as string).length > maxLength) {
    errors.push(`"${field}" exceeds maximum length of ${maxLength}`);
  }
}

function checkStringEnum(
  obj: Record<string, unknown>,
  field: string,
  allowed: Set<string>,
  errors: string[],
): void {
  if (!isString(obj[field]) || !allowed.has(obj[field] as string)) {
    errors.push(`"${field}" must be one of: ${[...allowed].join(", ")}`);
  }
}

function checkStringArray(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  maxItems: number,
  maxItemLength = 500,
): void {
  const value = obj[field];
  if (!Array.isArray(value)) {
    errors.push(`"${field}" must be an array`);
    return;
  }
  if (value.length > maxItems) {
    errors.push(`"${field}" must have at most ${maxItems} items`);
    return;
  }
  for (let i = 0; i < value.length; i++) {
    if (!isString(value[i])) {
      errors.push(`"${field}[${i}]" must be a string`);
    } else if ((value[i] as string).length > maxItemLength) {
      errors.push(
        `"${field}[${i}]" exceeds maximum length of ${maxItemLength}`,
      );
    }
  }
}

export function validateToneProfile(
  body: unknown,
): ValidationResult<ToneProfile> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  checkRequiredString(body, "tenant_id", errors, 200);
  if (isString(body.tenant_id) && !TENANT_ID_PATTERN.test(body.tenant_id)) {
    errors.push(
      '"tenant_id" must contain only alphanumeric characters, hyphens, and underscores',
    );
  }

  checkRequiredString(body, "greeting_style", errors);
  checkRequiredString(body, "closing_style", errors);
  checkStringEnum(body, "formality_level", FORMALITY_LEVELS, errors);
  checkStringEnum(body, "sentence_length", SENTENCE_LENGTHS, errors);
  checkStringEnum(
    body,
    "vocabulary_complexity",
    VOCABULARY_COMPLEXITIES,
    errors,
  );
  checkRequiredString(body, "emotional_tone", errors);

  if (typeof body.use_of_humor !== "boolean") {
    errors.push('"use_of_humor" must be a boolean');
  }

  checkStringArray(body, "typical_phrases", errors, 10);
  checkStringArray(body, "avoidances", errors, 10);
  if (body.industry_jargon !== undefined) {
    checkStringArray(body, "industry_jargon", errors, 20);
  }
  checkStringEnum(body, "language", LANGUAGES, errors);
  checkRequiredString(body, "created_at", errors, 100);
  checkRequiredString(body, "updated_at", errors, 100);

  // Validate optional Siteware platform fields
  if (body.anrede !== undefined && !ANREDE_VALUES.has(body.anrede as string)) {
    errors.push('"anrede" must be "sie" or "du"');
  }
  if (body.sprachstil !== undefined) {
    if (!Array.isArray(body.sprachstil)) {
      errors.push('"sprachstil" must be an array');
    } else if (body.sprachstil.length > 3) {
      errors.push('"sprachstil" must have at most 3 items');
    } else {
      for (const s of body.sprachstil) {
        if (!SPRACHSTIL_VALUES.has(s as string)) {
          errors.push(`"sprachstil" contains invalid value: "${s}"`);
        }
      }
    }
  }
  if (
    body.email_length !== undefined &&
    !EMAIL_LENGTH_VALUES.has(body.email_length as string)
  ) {
    errors.push(
      `"email_length" must be one of: ${[...EMAIL_LENGTH_VALUES].join(", ")}`,
    );
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  return {
    valid: true,
    data: {
      tenant_id: body.tenant_id as string,
      greeting_style: body.greeting_style as string,
      closing_style: body.closing_style as string,
      formality_level: body.formality_level as ToneProfile["formality_level"],
      sentence_length: body.sentence_length as ToneProfile["sentence_length"],
      vocabulary_complexity:
        body.vocabulary_complexity as ToneProfile["vocabulary_complexity"],
      emotional_tone: body.emotional_tone as string,
      use_of_humor: body.use_of_humor as boolean,
      typical_phrases: [...(body.typical_phrases as string[])],
      avoidances: [...(body.avoidances as string[])],
      industry_jargon: Array.isArray(body.industry_jargon)
        ? [...(body.industry_jargon as string[])]
        : [],
      language: body.language as ToneProfile["language"],
      created_at: body.created_at as string,
      updated_at: body.updated_at as string,
      ...(ANREDE_VALUES.has(body.anrede as string)
        ? { anrede: body.anrede as Anrede }
        : {}),
      ...(Array.isArray(body.sprachstil)
        ? { sprachstil: [...(body.sprachstil as Sprachstil[])] }
        : {}),
      ...(EMAIL_LENGTH_VALUES.has(body.email_length as string)
        ? { email_length: body.email_length as EmailLength }
        : {}),
    },
  };
}

export function validateAnalyzeRequest(
  body: unknown,
): ValidationResult<AnalyzeRequest> {
  if (!isRecord(body)) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const errors: string[] = [];

  checkRequiredString(body, "tenant_id", errors, 200);
  if (isString(body.tenant_id) && !TENANT_ID_PATTERN.test(body.tenant_id)) {
    errors.push(
      '"tenant_id" must contain only alphanumeric characters, hyphens, and underscores',
    );
  }

  const emails = body.example_emails;
  if (!Array.isArray(emails)) {
    errors.push('"example_emails" must be an array');
  } else if (emails.length < 3 || emails.length > 5) {
    errors.push('"example_emails" must contain 3-5 items');
  } else {
    for (let i = 0; i < emails.length; i++) {
      if (!isString(emails[i]) || (emails[i] as string).trim() === "") {
        errors.push(`"example_emails[${i}]" must be a non-empty string`);
      } else if ((emails[i] as string).length > 50_000) {
        errors.push(`"example_emails[${i}]" exceeds maximum length of 50000`);
      }
    }
  }

  checkStringEnum(body, "language", LANGUAGES, errors);

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  return {
    valid: true,
    data: {
      tenant_id: body.tenant_id as string,
      example_emails: [...(body.example_emails as string[])],
      language: body.language as AnalyzeRequest["language"],
    },
  };
}

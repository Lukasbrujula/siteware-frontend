import { describe, it, expect } from "vitest";
import { validateToneProfile, validateAnalyzeRequest } from "./schema.ts";

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: "test-tenant",
    greeting_style: "Sehr geehrte/r ...",
    closing_style: "Mit freundlichen Grüßen",
    formality_level: "formal",
    sentence_length: "medium",
    vocabulary_complexity: "moderate",
    emotional_tone: "warm but professional",
    use_of_humor: false,
    typical_phrases: ["gerne", "selbstverständlich"],
    avoidances: ["slang", "emojis"],
    language: "de",
    created_at: "2026-03-03T00:00:00Z",
    updated_at: "2026-03-03T00:00:00Z",
    ...overrides,
  };
}

function validAnalyze(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: "test-tenant",
    example_emails: [
      "Email one content",
      "Email two content",
      "Email three content",
    ],
    language: "de",
    ...overrides,
  };
}

// ===========================================================================
// validateToneProfile
// ===========================================================================

describe("validateToneProfile", () => {
  it("accepts a valid profile", () => {
    const result = validateToneProfile(validProfile());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.tenant_id).toBe("test-tenant");
      expect(result.data.formality_level).toBe("formal");
    }
  });

  it("accepts all formality_level values", () => {
    for (const level of ["formal", "semi-formal", "informal"]) {
      const result = validateToneProfile(
        validProfile({ formality_level: level }),
      );
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all sentence_length values", () => {
    for (const length of ["short", "medium", "long"]) {
      const result = validateToneProfile(
        validProfile({ sentence_length: length }),
      );
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all vocabulary_complexity values", () => {
    for (const complexity of ["simple", "moderate", "advanced"]) {
      const result = validateToneProfile(
        validProfile({ vocabulary_complexity: complexity }),
      );
      expect(result.valid).toBe(true);
    }
  });

  it('accepts language "en"', () => {
    const result = validateToneProfile(validProfile({ language: "en" }));
    expect(result.valid).toBe(true);
  });

  it("rejects non-object body", () => {
    const result = validateToneProfile(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("Body must be a JSON object");
  });

  it("rejects empty tenant_id", () => {
    const result = validateToneProfile(validProfile({ tenant_id: "" }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"tenant_id" must be a non-empty string');
  });

  it("rejects tenant_id with path traversal characters", () => {
    const result = validateToneProfile(
      validProfile({ tenant_id: "../etc/passwd" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        "alphanumeric characters, hyphens, and underscores",
      );
  });

  it("rejects tenant_id with spaces", () => {
    const result = validateToneProfile(
      validProfile({ tenant_id: "test tenant" }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects invalid formality_level", () => {
    const result = validateToneProfile(
      validProfile({ formality_level: "casual" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"formality_level" must be one of');
  });

  it("rejects invalid sentence_length", () => {
    const result = validateToneProfile(
      validProfile({ sentence_length: "very-long" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"sentence_length" must be one of');
  });

  it("rejects invalid vocabulary_complexity", () => {
    const result = validateToneProfile(
      validProfile({ vocabulary_complexity: "expert" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"vocabulary_complexity" must be one of');
  });

  it("rejects non-boolean use_of_humor", () => {
    const result = validateToneProfile(validProfile({ use_of_humor: "yes" }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"use_of_humor" must be a boolean');
  });

  it("rejects typical_phrases with more than 10 items", () => {
    const result = validateToneProfile(
      validProfile({
        typical_phrases: Array.from({ length: 11 }, (_, i) => `phrase-${i}`),
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"typical_phrases" must have at most 10 items',
      );
  });

  it("rejects avoidances with more than 10 items", () => {
    const result = validateToneProfile(
      validProfile({
        avoidances: Array.from({ length: 11 }, (_, i) => `avoid-${i}`),
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"avoidances" must have at most 10 items');
  });

  it("rejects non-array typical_phrases", () => {
    const result = validateToneProfile(
      validProfile({ typical_phrases: "gerne" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"typical_phrases" must be an array');
  });

  it("rejects typical_phrases containing non-strings", () => {
    const result = validateToneProfile(
      validProfile({ typical_phrases: [123] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"typical_phrases[0]" must be a string');
  });

  it("rejects invalid language", () => {
    const result = validateToneProfile(validProfile({ language: "fr" }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"language" must be one of');
  });

  it("accepts empty typical_phrases and avoidances arrays", () => {
    const result = validateToneProfile(
      validProfile({ typical_phrases: [], avoidances: [] }),
    );
    expect(result.valid).toBe(true);
  });

  it('joins multiple errors with "; "', () => {
    const result = validateToneProfile({
      tenant_id: "",
      formality_level: "invalid",
      use_of_humor: "yes",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errors = result.error.split("; ");
      expect(errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns immutable copies of arrays", () => {
    const phrases = ["gerne"];
    const result = validateToneProfile(
      validProfile({ typical_phrases: phrases }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.typical_phrases).toEqual(phrases);
      expect(result.data.typical_phrases).not.toBe(phrases);
    }
  });
});

// ===========================================================================
// validateAnalyzeRequest
// ===========================================================================

describe("validateAnalyzeRequest", () => {
  it("accepts a valid request with 3 emails", () => {
    const result = validateAnalyzeRequest(validAnalyze());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.example_emails).toHaveLength(3);
    }
  });

  it("accepts a valid request with 5 emails", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({
        example_emails: ["e1", "e2", "e3", "e4", "e5"],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects non-object body", () => {
    const result = validateAnalyzeRequest("string");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("Body must be a JSON object");
  });

  it("rejects too few emails (2)", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: ["e1", "e2"] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"example_emails" must contain 3-5 items');
  });

  it("rejects too many emails (6)", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: ["e1", "e2", "e3", "e4", "e5", "e6"] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"example_emails" must contain 3-5 items');
  });

  it("rejects non-array example_emails", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: "not an array" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"example_emails" must be an array');
  });

  it("rejects empty string in example_emails", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: ["e1", "", "e3"] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"example_emails[1]" must be a non-empty string',
      );
  });

  it("rejects whitespace-only string in example_emails", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: ["e1", "   ", "e3"] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"example_emails[1]" must be a non-empty string',
      );
  });

  it("rejects oversized email (>50,000 chars)", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: ["e1", "e2", "x".repeat(50_001)] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"example_emails[2]" exceeds maximum length of 50000',
      );
  });

  it("rejects invalid tenant_id", () => {
    const result = validateAnalyzeRequest(
      validAnalyze({ tenant_id: "../hack" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        "alphanumeric characters, hyphens, and underscores",
      );
  });

  it("rejects invalid language", () => {
    const result = validateAnalyzeRequest(validAnalyze({ language: "fr" }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"language" must be one of');
  });

  it("returns immutable copy of example_emails", () => {
    const emails = ["e1", "e2", "e3"];
    const result = validateAnalyzeRequest(
      validAnalyze({ example_emails: emails }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.example_emails).toEqual(emails);
      expect(result.data.example_emails).not.toBe(emails);
    }
  });
});

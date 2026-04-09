import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stripMarkdownFences } from "./run-profile.ts";

// ===========================================================================
// stripMarkdownFences
// ===========================================================================

describe("stripMarkdownFences", () => {
  it("strips ```json ... ``` fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it("strips ``` ... ``` fences (no language)", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it("returns raw JSON when no fences present", () => {
    const input = '{"key": "value"}';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it("trims whitespace", () => {
    const input = '  \n{"key": "value"}\n  ';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it("handles fences with extra whitespace", () => {
    const input = '```json  \n  {"key": "value"}  \n  ```';
    expect(stripMarkdownFences(input)).toBe('{"key": "value"}');
  });

  it("handles multiline JSON inside fences", () => {
    const input =
      '```json\n{\n  "greeting_style": "Hallo",\n  "closing_style": "MfG"\n}\n```';
    const result = stripMarkdownFences(input);
    expect(JSON.parse(result)).toEqual({
      greeting_style: "Hallo",
      closing_style: "MfG",
    });
  });
});

// ===========================================================================
// generateToneProfile (mocked fetch)
// ===========================================================================

describe("generateToneProfile", () => {
  const originalEnv = process.env.SITEWARE_API_TOKEN;

  beforeEach(() => {
    process.env.SITEWARE_API_TOKEN = "test-api-token";
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SITEWARE_API_TOKEN = originalEnv;
    } else {
      delete process.env.SITEWARE_API_TOKEN;
    }
    vi.restoreAllMocks();
  });

  function mockValidAiResponse() {
    return JSON.stringify({
      greeting_style: "Sehr geehrte/r ...",
      closing_style: "Mit freundlichen Grüßen",
      formality_level: "formal",
      sentence_length: "medium",
      vocabulary_complexity: "moderate",
      emotional_tone: "warm but professional",
      use_of_humor: false,
      typical_phrases: ["gerne"],
      avoidances: ["slang"],
    });
  }

  it("calls the Siteware API and saves the profile", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ answer: mockValidAiResponse() }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Mock the store to avoid filesystem writes
    vi.doMock("../tone-profile/store.ts", () => ({
      saveToneProfile: vi.fn(),
    }));

    const { generateToneProfile } = await import("./run-profile.ts");

    const result = await generateToneProfile(
      "test-tenant",
      ["e1", "e2", "e3"],
      "de",
    );

    expect(result.tenant_id).toBe("test-tenant");
    expect(result.formality_level).toBe("formal");
    expect(result.language).toBe("de");
    expect(result.created_at).toBeTruthy();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("siteware.io");
    expect(options.headers.Authorization).toBe("Bearer test-api-token");
    expect(JSON.parse(options.body).model).toBe("claude-opus-4-6");
  });

  it("throws when SITEWARE_API_TOKEN is missing", async () => {
    delete process.env.SITEWARE_API_TOKEN;

    const { generateToneProfile } = await import("./run-profile.ts");

    await expect(
      generateToneProfile("test-tenant", ["e1", "e2", "e3"]),
    ).rejects.toThrow("SITEWARE_API_TOKEN");
  });

  it("throws on API HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    const { generateToneProfile } = await import("./run-profile.ts");

    await expect(
      generateToneProfile("test-tenant", ["e1", "e2", "e3"]),
    ).rejects.toThrow("HTTP 500");
  });

  it("throws when API returns no answer field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const { generateToneProfile } = await import("./run-profile.ts");

    await expect(
      generateToneProfile("test-tenant", ["e1", "e2", "e3"]),
    ).rejects.toThrow("no answer field");
  });

  it("throws when AI response is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ answer: "not json at all" }),
      }),
    );

    const { generateToneProfile } = await import("./run-profile.ts");

    await expect(
      generateToneProfile("test-tenant", ["e1", "e2", "e3"]),
    ).rejects.toThrow("Failed to parse AI response");
  });

  it("handles AI response wrapped in markdown fences", async () => {
    const wrappedResponse = "```json\n" + mockValidAiResponse() + "\n```";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ answer: wrappedResponse }),
      }),
    );

    vi.doMock("../tone-profile/store.ts", () => ({
      saveToneProfile: vi.fn(),
    }));

    const { generateToneProfile } = await import("./run-profile.ts");

    const result = await generateToneProfile("test-tenant", ["e1", "e2", "e3"]);
    expect(result.formality_level).toBe("formal");
  });

  it("throws when AI response fails schema validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ answer: '{"greeting_style": "Hi"}' }),
      }),
    );

    const { generateToneProfile } = await import("./run-profile.ts");

    await expect(
      generateToneProfile("test-tenant", ["e1", "e2", "e3"]),
    ).rejects.toThrow("failed ToneProfile validation");
  });
});

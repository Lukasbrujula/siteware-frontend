import { describe, it, expect } from "vitest";
import { buildInjection } from "./composer-injection.ts";
import type { ToneProfile } from "@/types/tone-profile";

function makeProfile(overrides: Partial<ToneProfile> = {}): ToneProfile {
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

describe("buildInjection", () => {
  it("includes the section header", () => {
    const injection = buildInjection(makeProfile());
    expect(injection).toContain("## Tone & Style Instructions");
  });

  it("includes greeting and closing styles", () => {
    const injection = buildInjection(makeProfile());
    expect(injection).toContain('Greeting: Use "Sehr geehrte/r ..."');
    expect(injection).toContain('Closing: Use "Mit freundlichen Grüßen"');
  });

  it("includes formality label for formal", () => {
    const injection = buildInjection(
      makeProfile({ formality_level: "formal" }),
    );
    expect(injection).toContain("Formal");
    expect(injection).toContain("polite forms");
  });

  it("includes formality label for semi-formal", () => {
    const injection = buildInjection(
      makeProfile({ formality_level: "semi-formal" }),
    );
    expect(injection).toContain("Semi-formal");
  });

  it("includes formality label for informal", () => {
    const injection = buildInjection(
      makeProfile({ formality_level: "informal" }),
    );
    expect(injection).toContain("Informal");
  });

  it("includes sentence length instruction", () => {
    const injection = buildInjection(makeProfile({ sentence_length: "short" }));
    expect(injection).toContain("short and concise");
  });

  it("includes vocabulary instruction", () => {
    const injection = buildInjection(
      makeProfile({ vocabulary_complexity: "advanced" }),
    );
    expect(injection).toContain("sophisticated vocabulary");
  });

  it("includes emotional tone", () => {
    const injection = buildInjection(makeProfile());
    expect(injection).toContain("warm but professional");
  });

  it("includes humor instruction when enabled", () => {
    const injection = buildInjection(makeProfile({ use_of_humor: true }));
    expect(injection).toContain("Light humor is acceptable");
  });

  it("includes no-humor instruction when disabled", () => {
    const injection = buildInjection(makeProfile({ use_of_humor: false }));
    expect(injection).toContain("Avoid humor");
  });

  it("includes typical phrases", () => {
    const injection = buildInjection(makeProfile());
    expect(injection).toContain("gerne");
    expect(injection).toContain("selbstverständlich");
  });

  it("omits typical phrases line when array is empty", () => {
    const injection = buildInjection(makeProfile({ typical_phrases: [] }));
    expect(injection).not.toContain("characteristic phrases");
  });

  it("includes avoidances", () => {
    const injection = buildInjection(makeProfile());
    expect(injection).toContain("slang");
    expect(injection).toContain("emojis");
  });

  it("omits avoidances line when array is empty", () => {
    const injection = buildInjection(makeProfile({ avoidances: [] }));
    expect(injection).not.toContain("Avoid:");
  });

  it("includes German language instruction", () => {
    const injection = buildInjection(makeProfile({ language: "de" }));
    expect(injection).toContain("Write in German");
  });

  it("includes English language instruction", () => {
    const injection = buildInjection(makeProfile({ language: "en" }));
    expect(injection).toContain("Write in English");
  });
});

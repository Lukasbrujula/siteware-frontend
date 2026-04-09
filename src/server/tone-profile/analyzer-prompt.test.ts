import { describe, it, expect } from "vitest";
import { buildAnalyzerPrompt } from "./analyzer-prompt.ts";
import type { AnalyzeRequest } from "@/types/tone-profile";

function makeRequest(overrides: Partial<AnalyzeRequest> = {}): AnalyzeRequest {
  return {
    tenant_id: "test-tenant",
    example_emails: ["Email one", "Email two", "Email three"],
    language: "de",
    ...overrides,
  };
}

describe("buildAnalyzerPrompt", () => {
  it("includes all example emails", () => {
    const prompt = buildAnalyzerPrompt(makeRequest());
    expect(prompt).toContain("Email one");
    expect(prompt).toContain("Email two");
    expect(prompt).toContain("Email three");
  });

  it("wraps emails in numbered markers", () => {
    const prompt = buildAnalyzerPrompt(makeRequest());
    expect(prompt).toContain("--- Email 1 ---");
    expect(prompt).toContain("--- End Email 1 ---");
    expect(prompt).toContain("--- Email 3 ---");
    expect(prompt).toContain("--- End Email 3 ---");
  });

  it('uses German instructions for language "de"', () => {
    const prompt = buildAnalyzerPrompt(makeRequest({ language: "de" }));
    expect(prompt).toContain("Analysiere die folgenden Beispiel-E-Mails");
  });

  it('uses English instructions for language "en"', () => {
    const prompt = buildAnalyzerPrompt(makeRequest({ language: "en" }));
    expect(prompt).toContain("Analyze the following example emails");
  });

  it("includes JSON schema description", () => {
    const prompt = buildAnalyzerPrompt(makeRequest());
    expect(prompt).toContain("greeting_style");
    expect(prompt).toContain("closing_style");
    expect(prompt).toContain("formality_level");
    expect(prompt).toContain("typical_phrases");
    expect(prompt).toContain("avoidances");
  });

  it("handles 5 emails", () => {
    const prompt = buildAnalyzerPrompt(
      makeRequest({
        example_emails: ["e1", "e2", "e3", "e4", "e5"],
      }),
    );
    expect(prompt).toContain("--- Email 5 ---");
    expect(prompt).toContain("--- End Email 5 ---");
  });

  it("instructs AI to return valid JSON only", () => {
    const prompt = buildAnalyzerPrompt(makeRequest({ language: "en" }));
    expect(prompt).toContain("valid JSON only");
  });
});

import { describe, it, expect } from "vitest";
import {
  hasPlaceholders,
  escapeHtml,
  buildHighlightedHtml,
  getConfidenceColor,
} from "./draft-helpers";

// ===========================================================================
// hasPlaceholders
// ===========================================================================

describe("hasPlaceholders", () => {
  it("returns true when placeholder is present", () => {
    expect(hasPlaceholders("Hello [BITTE ERGÄNZEN: Name]")).toBe(true);
  });

  it("returns true with empty placeholder content", () => {
    expect(hasPlaceholders("[BITTE ERGÄNZEN:]")).toBe(true);
  });

  it("returns true with multiple placeholders", () => {
    const text =
      "Dear [BITTE ERGÄNZEN: Name], your [BITTE ERGÄNZEN: Order] is ready.";
    expect(hasPlaceholders(text)).toBe(true);
  });

  it("returns false when no placeholder present", () => {
    expect(hasPlaceholders("Hello World")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasPlaceholders("")).toBe(false);
  });

  it("returns false for partial match missing closing bracket", () => {
    expect(hasPlaceholders("[BITTE ERGÄNZEN: unclosed")).toBe(false);
  });

  it("returns false for similar but wrong pattern", () => {
    expect(hasPlaceholders("[BITTE ERGANZEN: Name]")).toBe(false);
  });

  it("returns true with placeholder in multiline text", () => {
    const text = "Line 1\nLine 2\n[BITTE ERGÄNZEN: Details]\nLine 4";
    expect(hasPlaceholders(text)).toBe(true);
  });
});

// ===========================================================================
// escapeHtml
// ===========================================================================

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("1 > 0")).toBe("1 &gt; 0");
  });

  it("escapes all three in sequence", () => {
    expect(escapeHtml('<div class="a & b">')).toBe(
      '&lt;div class="a &amp; b"&gt;',
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles multiple ampersands", () => {
    expect(escapeHtml("a & b & c")).toBe("a &amp; b &amp; c");
  });
});

// ===========================================================================
// buildHighlightedHtml
// ===========================================================================

describe("buildHighlightedHtml", () => {
  it("wraps placeholder in <mark> tag", () => {
    const result = buildHighlightedHtml("[BITTE ERGÄNZEN: Name]");
    expect(result).toContain("<mark");
    expect(result).toContain("[BITTE ERG");
    expect(result).toContain("</mark>");
  });

  it("escapes HTML before highlighting", () => {
    const result = buildHighlightedHtml("<b>Bold</b> [BITTE ERGÄNZEN: X]");
    expect(result).toContain("&lt;b&gt;");
    expect(result).not.toContain("<b>");
    expect(result).toContain("<mark");
  });

  it("handles text without placeholders", () => {
    const result = buildHighlightedHtml("Hello World");
    expect(result).toBe("Hello World");
    expect(result).not.toContain("<mark");
  });

  it("highlights multiple placeholders", () => {
    const text = "Dear [BITTE ERGÄNZEN: Name], ref [BITTE ERGÄNZEN: ID].";
    const result = buildHighlightedHtml(text);
    const marks = result.match(/<mark/g);
    expect(marks?.length).toBe(2);
  });

  it("applies correct CSS classes to mark", () => {
    const result = buildHighlightedHtml("[BITTE ERGÄNZEN: X]");
    expect(result).toContain("bg-yellow-200");
    expect(result).toContain("text-yellow-900");
  });

  it("returns empty string for empty input", () => {
    expect(buildHighlightedHtml("")).toBe("");
  });
});

// ===========================================================================
// getConfidenceColor
// ===========================================================================

describe("getConfidenceColor", () => {
  it("returns green for confidence > 0.8", () => {
    expect(getConfidenceColor(0.9)).toContain("bg-green");
  });

  it("returns green for confidence 0.81", () => {
    expect(getConfidenceColor(0.81)).toContain("bg-green");
  });

  it("returns yellow for confidence exactly 0.8", () => {
    expect(getConfidenceColor(0.8)).toContain("bg-yellow");
  });

  it("returns yellow for confidence 0.5", () => {
    expect(getConfidenceColor(0.5)).toContain("bg-yellow");
  });

  it("returns red for confidence below 0.5", () => {
    expect(getConfidenceColor(0.49)).toContain("bg-red");
  });

  it("returns red for confidence 0", () => {
    expect(getConfidenceColor(0)).toContain("bg-red");
  });

  it("returns green for confidence 1", () => {
    expect(getConfidenceColor(1)).toContain("bg-green");
  });
});

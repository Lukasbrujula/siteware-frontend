import { describe, it, expect } from "vitest";
import {
  getSentimentColor,
  getSentimentTextColor,
  getSentimentLabel,
  clampPercent,
} from "./sentiment-helpers";

// ===========================================================================
// getSentimentColor
// ===========================================================================

describe("getSentimentColor", () => {
  it("returns bg-red-500 for score <= -0.6", () => {
    expect(getSentimentColor(-1)).toBe("bg-red-500");
    expect(getSentimentColor(-0.6)).toBe("bg-red-500");
  });

  it("returns bg-orange-500 for -0.6 < score <= -0.3", () => {
    expect(getSentimentColor(-0.59)).toBe("bg-orange-500");
    expect(getSentimentColor(-0.3)).toBe("bg-orange-500");
  });

  it("returns bg-amber-400 for -0.3 < score <= 0.0", () => {
    expect(getSentimentColor(-0.29)).toBe("bg-amber-400");
    expect(getSentimentColor(0.0)).toBe("bg-amber-400");
  });

  it("returns bg-yellow-300 for 0.0 < score <= 0.3", () => {
    expect(getSentimentColor(0.01)).toBe("bg-yellow-300");
    expect(getSentimentColor(0.3)).toBe("bg-yellow-300");
  });

  it("returns bg-lime-400 for 0.3 < score <= 0.6", () => {
    expect(getSentimentColor(0.31)).toBe("bg-lime-400");
    expect(getSentimentColor(0.6)).toBe("bg-lime-400");
  });

  it("returns bg-green-500 for score > 0.6", () => {
    expect(getSentimentColor(0.61)).toBe("bg-green-500");
    expect(getSentimentColor(1)).toBe("bg-green-500");
  });
});

// ===========================================================================
// getSentimentTextColor
// ===========================================================================

describe("getSentimentTextColor", () => {
  it("returns red text for score <= -0.6", () => {
    expect(getSentimentTextColor(-0.6)).toContain("text-red");
  });

  it("returns orange text for -0.6 < score <= -0.3", () => {
    expect(getSentimentTextColor(-0.3)).toContain("text-orange");
  });

  it("returns amber text for -0.3 < score <= 0.0", () => {
    expect(getSentimentTextColor(0.0)).toContain("text-amber");
  });

  it("returns yellow text for 0.0 < score <= 0.3", () => {
    expect(getSentimentTextColor(0.3)).toContain("text-yellow");
  });

  it("returns lime text for 0.3 < score <= 0.6", () => {
    expect(getSentimentTextColor(0.6)).toContain("text-lime");
  });

  it("returns green text for score > 0.6", () => {
    expect(getSentimentTextColor(1)).toContain("text-green");
  });
});

// ===========================================================================
// getSentimentLabel
// ===========================================================================

describe("getSentimentLabel", () => {
  it('returns "Sehr negativ" for score <= -0.6', () => {
    expect(getSentimentLabel(-1)).toBe("Sehr negativ");
    expect(getSentimentLabel(-0.6)).toBe("Sehr negativ");
  });

  it('returns "Negativ" for -0.6 < score <= -0.3', () => {
    expect(getSentimentLabel(-0.59)).toBe("Negativ");
    expect(getSentimentLabel(-0.3)).toBe("Negativ");
  });

  it('returns "Leicht negativ" for -0.3 < score <= 0.0', () => {
    expect(getSentimentLabel(-0.29)).toBe("Leicht negativ");
    expect(getSentimentLabel(0.0)).toBe("Leicht negativ");
  });

  it('returns "Neutral" for 0.0 < score <= 0.3', () => {
    expect(getSentimentLabel(0.01)).toBe("Neutral");
    expect(getSentimentLabel(0.3)).toBe("Neutral");
  });

  it('returns "Positiv" for 0.3 < score <= 0.6', () => {
    expect(getSentimentLabel(0.31)).toBe("Positiv");
    expect(getSentimentLabel(0.6)).toBe("Positiv");
  });

  it('returns "Sehr positiv" for score > 0.6', () => {
    expect(getSentimentLabel(0.61)).toBe("Sehr positiv");
    expect(getSentimentLabel(1)).toBe("Sehr positiv");
  });
});

// ===========================================================================
// clampPercent
// ===========================================================================

describe("clampPercent", () => {
  it("converts -1 to 0%", () => {
    expect(clampPercent(-1)).toBe(0);
  });

  it("converts 0 to 50%", () => {
    expect(clampPercent(0)).toBe(50);
  });

  it("converts 1 to 100%", () => {
    expect(clampPercent(1)).toBe(100);
  });

  it("converts -0.5 to 25%", () => {
    expect(clampPercent(-0.5)).toBe(25);
  });

  it("converts 0.5 to 75%", () => {
    expect(clampPercent(0.5)).toBe(75);
  });

  it("rounds to nearest integer", () => {
    expect(clampPercent(0.33)).toBe(67);
  });
});

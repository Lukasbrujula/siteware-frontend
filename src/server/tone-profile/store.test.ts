import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ToneProfile } from "@/types/tone-profile";
import {
  saveToneProfile,
  loadToneProfile,
  listToneProfiles,
  deleteToneProfile,
  __setBasePathForTest,
} from "./store.ts";

function makeProfile(tenantId: string): ToneProfile {
  return {
    tenant_id: tenantId,
    greeting_style: "Sehr geehrte/r ...",
    closing_style: "Mit freundlichen Grüßen",
    formality_level: "formal",
    sentence_length: "medium",
    vocabulary_complexity: "moderate",
    emotional_tone: "warm but professional",
    use_of_humor: false,
    typical_phrases: ["gerne"],
    avoidances: ["slang"],
    language: "de",
    created_at: "2026-03-03T00:00:00Z",
    updated_at: "2026-03-03T00:00:00Z",
  };
}

let testDir: string;

beforeEach(() => {
  testDir = resolve(tmpdir(), `tone-profile-test-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
  __setBasePathForTest(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("saveToneProfile / loadToneProfile", () => {
  it("saves and loads a profile", () => {
    const profile = makeProfile("tenant-a");
    saveToneProfile(profile);

    const loaded = loadToneProfile("tenant-a");
    expect(loaded).toEqual(profile);
  });

  it("overwrites an existing profile", () => {
    saveToneProfile(makeProfile("tenant-a"));

    const updated: ToneProfile = {
      ...makeProfile("tenant-a"),
      greeting_style: "Hallo",
      updated_at: "2026-03-04T00:00:00Z",
    };
    saveToneProfile(updated);

    const loaded = loadToneProfile("tenant-a");
    expect(loaded?.greeting_style).toBe("Hallo");
  });

  it("returns null for nonexistent profile", () => {
    const loaded = loadToneProfile("nonexistent");
    expect(loaded).toBeNull();
  });
});

describe("listToneProfiles", () => {
  it("returns empty array when no profiles exist", () => {
    const ids = listToneProfiles();
    expect(ids).toEqual([]);
  });

  it("lists all saved tenant IDs", () => {
    saveToneProfile(makeProfile("tenant-a"));
    saveToneProfile(makeProfile("tenant-b"));
    saveToneProfile(makeProfile("tenant-c"));

    const ids = listToneProfiles();
    expect([...ids].sort()).toEqual(["tenant-a", "tenant-b", "tenant-c"]);
  });
});

describe("deleteToneProfile", () => {
  it("deletes an existing profile and returns true", () => {
    saveToneProfile(makeProfile("tenant-a"));
    const result = deleteToneProfile("tenant-a");
    expect(result).toBe(true);
    expect(loadToneProfile("tenant-a")).toBeNull();
  });

  it("returns false for nonexistent profile", () => {
    const result = deleteToneProfile("nonexistent");
    expect(result).toBe(false);
  });
});

describe("path traversal protection", () => {
  it("rejects tenant_id with slash", () => {
    expect(() => loadToneProfile("../etc/passwd")).toThrow("Invalid tenant_id");
  });

  it("rejects tenant_id with dots", () => {
    expect(() => loadToneProfile("..hack")).toThrow("Invalid tenant_id");
  });

  it("rejects tenant_id with spaces", () => {
    expect(() => loadToneProfile("test tenant")).toThrow("Invalid tenant_id");
  });

  it("accepts tenant_id with hyphens and underscores", () => {
    saveToneProfile(makeProfile("my-tenant_123"));
    const loaded = loadToneProfile("my-tenant_123");
    expect(loaded).not.toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToneProfile } from "@/types/tone-profile";

// ---------------------------------------------------------------------------
// Mock db-turso module
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock("../db-turso.ts", () => ({
  getTursoClient: vi.fn(() => ({
    execute: mockExecute,
  })),
}));

import {
  initToneProfilesTable,
  saveToneProfile,
  loadToneProfile,
  listToneProfiles,
  deleteToneProfile,
} from "./store-turso.ts";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockProfile: ToneProfile = {
  tenant_id: "test-tenant",
  greeting_style: "Sehr geehrte Damen und Herren",
  closing_style: "Mit freundlichen Gruessen",
  formality_level: "formal",
  sentence_length: "medium",
  vocabulary_complexity: "moderate",
  emotional_tone: "professional and warm",
  use_of_humor: false,
  typical_phrases: ["Vielen Dank"],
  avoidances: ["Slang"],
  language: "de",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// initToneProfilesTable
// ===========================================================================

describe("initToneProfilesTable", () => {
  it("executes CREATE TABLE IF NOT EXISTS statement", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    await initToneProfilesTable();

    expect(mockExecute).toHaveBeenCalledOnce();
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS tone_profiles");
    expect(sql).toContain("tenant_id TEXT PRIMARY KEY");
    expect(sql).toContain("profile TEXT NOT NULL");
    expect(sql).toContain("created_at TEXT NOT NULL");
    expect(sql).toContain("updated_at TEXT NOT NULL");
  });
});

// ===========================================================================
// saveToneProfile
// ===========================================================================

describe("saveToneProfile", () => {
  it("executes INSERT with ON CONFLICT upsert", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    await saveToneProfile(mockProfile);

    expect(mockExecute).toHaveBeenCalledOnce();
    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("INSERT INTO tone_profiles");
    expect(call.sql).toContain("ON CONFLICT(tenant_id) DO UPDATE");
    expect(call.args[0]).toBe("test-tenant");
    expect(call.args[1]).toBe(JSON.stringify(mockProfile));
    expect(typeof call.args[2]).toBe("string"); // created_at timestamp
    expect(typeof call.args[3]).toBe("string"); // updated_at timestamp
  });

  it("throws on invalid tenant_id with special characters", async () => {
    const invalidProfile: ToneProfile = {
      ...mockProfile,
      tenant_id: "invalid tenant!@#",
    };

    await expect(saveToneProfile(invalidProfile)).rejects.toThrow(
      "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("throws on empty tenant_id", async () => {
    const emptyProfile: ToneProfile = {
      ...mockProfile,
      tenant_id: "",
    };

    await expect(saveToneProfile(emptyProfile)).rejects.toThrow(
      "Invalid tenant_id",
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// loadToneProfile
// ===========================================================================

describe("loadToneProfile", () => {
  it("returns parsed ToneProfile when row exists", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ profile: JSON.stringify(mockProfile) }],
      rowsAffected: 0,
    });

    const result = await loadToneProfile("test-tenant");

    expect(result).toEqual(mockProfile);
    expect(mockExecute).toHaveBeenCalledOnce();
    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain(
      "SELECT profile FROM tone_profiles WHERE tenant_id = ?",
    );
    expect(call.args).toEqual(["test-tenant"]);
  });

  it("returns null when no rows found", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 0,
    });

    const result = await loadToneProfile("nonexistent-tenant");

    expect(result).toBeNull();
  });

  it("throws on invalid tenant_id", async () => {
    await expect(loadToneProfile("bad id!")).rejects.toThrow(
      "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// listToneProfiles
// ===========================================================================

describe("listToneProfiles", () => {
  it("returns array of tenant_id strings ordered by tenant_id ASC", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { tenant_id: "alpha-tenant" },
        { tenant_id: "beta-tenant" },
        { tenant_id: "gamma-tenant" },
      ],
      rowsAffected: 0,
    });

    const result = await listToneProfiles();

    expect(result).toEqual(["alpha-tenant", "beta-tenant", "gamma-tenant"]);
    expect(mockExecute).toHaveBeenCalledOnce();
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain("SELECT tenant_id FROM tone_profiles");
    expect(sql).toContain("ORDER BY tenant_id ASC");
  });

  it("returns empty array when no profiles exist", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 0,
    });

    const result = await listToneProfiles();

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// deleteToneProfile
// ===========================================================================

describe("deleteToneProfile", () => {
  it("returns true when a row was deleted", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 1,
    });

    const result = await deleteToneProfile("test-tenant");

    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalledOnce();
    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("DELETE FROM tone_profiles WHERE tenant_id = ?");
    expect(call.args).toEqual(["test-tenant"]);
  });

  it("returns false when rowsAffected is 0", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 0,
    });

    const result = await deleteToneProfile("nonexistent-tenant");

    expect(result).toBe(false);
  });

  it("throws on invalid tenant_id", async () => {
    await expect(deleteToneProfile("bad/path")).rejects.toThrow(
      "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

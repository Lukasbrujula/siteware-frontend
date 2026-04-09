import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @libsql/client
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(() => ({
    execute: mockExecute,
  })),
}));

// Import after mock is registered so the module picks up the mock
import {
  getTursoClient,
  initTursoDb,
  insertEmail,
  getEmailsByCategory,
  getAllPending,
  updateStatus,
  deleteEmail,
  getAll,
  getEmailById,
} from "./db-turso.ts";
import { createClient } from "@libsql/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResultSet() {
  return { rows: [] };
}

// The module caches the client in a `let client` variable.
// Re-importing won't reset it, so we rely on vi.resetModules in
// tests that need a fresh singleton. For most tests the singleton
// created in the first call is fine — we just clear mock call history.

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue(emptyResultSet());

  // Ensure env var is set for most tests
  process.env.TURSO_DATABASE_URL = "libsql://test-db.turso.io";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

// ===========================================================================
// getTursoClient
// ===========================================================================

describe("getTursoClient", () => {
  it("throws when TURSO_DATABASE_URL is not set", async () => {
    // We need a fresh module to reset the singleton client
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock("@libsql/client", () => ({
      createClient: vi.fn(() => ({ execute: vi.fn() })),
    }));

    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    const freshModule = await import("./db-turso.ts");

    expect(() => freshModule.getTursoClient()).toThrow(
      "TURSO_DATABASE_URL environment variable is not configured",
    );
  });

  it("creates client with url and authToken from env", () => {
    // getTursoClient was already called during module init by other tests,
    // but createClient was called with the env values set in beforeEach
    getTursoClient();

    expect(createClient).toHaveBeenCalledWith({
      url: "libsql://test-db.turso.io",
      authToken: "test-token",
    });
  });

  it("returns the same client on subsequent calls (singleton)", () => {
    const first = getTursoClient();
    const second = getTursoClient();

    expect(first).toBe(second);
    // createClient should only have been called once for this module instance
  });
});

// ===========================================================================
// initTursoDb
// ===========================================================================

describe("initTursoDb", () => {
  it("creates tenants, emails, and audit_logs tables with indexes and seeds default tenant", async () => {
    await initTursoDb();

    // Verify tenants table creation
    const allCalls = mockExecute.mock.calls.map((c) => {
      const arg = c[0];
      return typeof arg === "string" ? arg : (arg as { sql: string }).sql;
    });

    expect(
      allCalls.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS tenants"),
      ),
    ).toBe(true);
    expect(
      allCalls.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS emails")),
    ).toBe(true);
    expect(
      allCalls.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS audit_logs"),
      ),
    ).toBe(true);
    expect(allCalls.some((sql) => sql.includes("idx_emails_category"))).toBe(
      true,
    );
    expect(allCalls.some((sql) => sql.includes("idx_emails_status"))).toBe(
      true,
    );
    expect(allCalls.some((sql) => sql.includes("idx_emails_tenant_id"))).toBe(
      true,
    );
    expect(
      allCalls.some((sql) => sql.includes("idx_audit_logs_tenant_id")),
    ).toBe(true);

    // Verify default tenant seed
    const seedCall = mockExecute.mock.calls.find((c) => {
      const arg = c[0];
      const sql = typeof arg === "string" ? arg : (arg as { sql: string }).sql;
      return sql.includes("INSERT INTO tenants");
    });
    expect(seedCall).toBeDefined();

    const seedArg = seedCall![0] as { sql: string; args: unknown[] };
    expect(seedArg.args[0]).toBe("default");
    expect(seedArg.args[1]).toBe("https://api.siteware.io");
    expect(seedArg.args[2]).toBe("69a793b549b400eda5ba1d28");
    expect(seedArg.args[3]).toBe("69a79a7474b96c80ef1a84e2");
  });
});

// ===========================================================================
// insertEmail
// ===========================================================================

describe("insertEmail", () => {
  it("executes INSERT with correct SQL and args", async () => {
    const payload = { email_id: "email-001", subject: "Test Subject" };

    await insertEmail("spam", payload);

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("INSERT INTO emails");
    expect(call.sql).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(call.args[0]).toBe("email-001");
    expect(call.args[1]).toBe("SPAM");
    expect(call.args[2]).toBe(JSON.stringify(payload));
    // args[3] and args[4] are ISO timestamps
    expect(typeof call.args[3]).toBe("string");
    expect(typeof call.args[4]).toBe("string");
  });

  it("uppercases the category", async () => {
    await insertEmail("escalation", { email_id: "esc-001" });

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.args[1]).toBe("ESCALATION");
  });

  it("uses empty string when email_id is missing from payload", async () => {
    await insertEmail("ad", { subject: "No ID" });

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.args[0]).toBe("");
  });
});

// ===========================================================================
// getEmailsByCategory
// ===========================================================================

describe("getEmailsByCategory", () => {
  it("queries with uppercased category and parses JSON payloads", async () => {
    const mockPayload = { email_id: "spam-001", subject: "Win!" };
    mockExecute.mockResolvedValueOnce({
      rows: [{ payload: JSON.stringify(mockPayload) }],
    });

    const result = await getEmailsByCategory("spam");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("SELECT payload FROM emails");
    expect(call.sql).toContain("status != 'deleted'");
    expect(call.sql).toContain("ORDER BY created_at ASC");
    expect(call.args[0]).toBe("SPAM");

    expect(result).toEqual([mockPayload]);
  });

  it("returns empty array when no rows match", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await getEmailsByCategory("ad");

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// getAllPending
// ===========================================================================

describe("getAllPending", () => {
  it("returns zeroed counts when no rows exist", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await getAllPending();

    expect(result).toEqual({
      spam: 0,
      ad: 0,
      draft: 0,
      escalation: 0,
      unsubscribe: 0,
    });
  });

  it("maps category rows to correct count keys", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { category: "SPAM", count: 3 },
        { category: "AD", count: 2 },
        { category: "ESCALATION", count: 1 },
      ],
    });

    const result = await getAllPending();

    expect(result.spam).toBe(3);
    expect(result.ad).toBe(2);
    expect(result.escalation).toBe(1);
    expect(result.draft).toBe(0);
    expect(result.unsubscribe).toBe(0);
  });

  it("merges URGENT and OTHER into draft count", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { category: "URGENT", count: 4 },
        { category: "OTHER", count: 6 },
      ],
    });

    const result = await getAllPending();

    expect(result.draft).toBe(10);
  });

  it("ignores unknown categories", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { category: "SPAM", count: 1 },
        { category: "UNKNOWN", count: 99 },
      ],
    });

    const result = await getAllPending();

    expect(result.spam).toBe(1);
    // UNKNOWN is not mapped, total should not include it
    const total =
      result.spam +
      result.ad +
      result.draft +
      result.escalation +
      result.unsubscribe;
    expect(total).toBe(1);
  });

  it("executes correct SQL query scoped by tenant_id", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await getAllPending("test-tenant");

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain(
      "SELECT category, COUNT(*) as count FROM emails",
    );
    expect(call.sql).toContain("tenant_id = ?");
    expect(call.sql).toContain("status != 'deleted'");
    expect(call.sql).toContain("GROUP BY category");
    expect(call.args[0]).toBe("test-tenant");
  });
});

// ===========================================================================
// updateStatus
// ===========================================================================

describe("updateStatus", () => {
  it("updates status without assignee", async () => {
    await updateStatus("email-001", "approved");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("UPDATE emails SET status = ?");
    expect(call.sql).toContain("updated_at = ?");
    expect(call.sql).toContain("WHERE id = ?");
    expect(call.sql).not.toContain("assignee");
    expect(call.args[0]).toBe("approved");
    expect(typeof call.args[1]).toBe("string"); // updated_at timestamp
    expect(call.args[2]).toBe("email-001");
  });

  it("updates status with assignee when provided", async () => {
    await updateStatus("email-002", "assigned", "user@example.com");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("assignee = ?");
    expect(call.args[0]).toBe("assigned");
    expect(call.args[1]).toBe("user@example.com");
    expect(typeof call.args[2]).toBe("string"); // updated_at timestamp
    expect(call.args[3]).toBe("email-002");
  });
});

// ===========================================================================
// deleteEmail
// ===========================================================================

describe("deleteEmail", () => {
  it('delegates to updateStatus with status "deleted"', async () => {
    await deleteEmail("email-003");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("UPDATE emails SET status = ?");
    expect(call.args[0]).toBe("deleted");
    expect(call.args[2]).toBe("email-003");
  });
});

// ===========================================================================
// getAll
// ===========================================================================

describe("getAll", () => {
  it("returns empty grouped object when no rows exist", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await getAll();

    expect(result).toEqual({
      spam: [],
      ad: [],
      urgent: [],
      other: [],
      escalation: [],
      unsubscribe: [],
    });
  });

  it("groups emails by category with parsed payloads", async () => {
    const spamPayload = { email_id: "spam-001", subject: "Spam!" };
    const urgentPayload = { email_id: "urgent-001", subject: "Urgent!" };
    const otherPayload = { email_id: "other-001", subject: "Other" };

    mockExecute.mockResolvedValueOnce({
      rows: [
        { category: "SPAM", payload: JSON.stringify(spamPayload) },
        { category: "URGENT", payload: JSON.stringify(urgentPayload) },
        { category: "OTHER", payload: JSON.stringify(otherPayload) },
      ],
    });

    const result = await getAll();

    expect(result.spam).toEqual([spamPayload]);
    expect(result.urgent).toEqual([urgentPayload]);
    expect(result.other).toEqual([otherPayload]);
    expect(result.ad).toEqual([]);
    expect(result.escalation).toEqual([]);
    expect(result.unsubscribe).toEqual([]);
  });

  it("ignores rows with unknown categories", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { category: "MYSTERY", payload: JSON.stringify({ email_id: "x" }) },
      ],
    });

    const result = await getAll();

    expect(result.spam).toEqual([]);
    expect(result.ad).toEqual([]);
    expect(result.urgent).toEqual([]);
    expect(result.other).toEqual([]);
    expect(result.escalation).toEqual([]);
    expect(result.unsubscribe).toEqual([]);
  });

  it("executes correct SQL query scoped by tenant_id", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await getAll("test-tenant");

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("SELECT category, payload FROM emails");
    expect(call.sql).toContain("tenant_id = ?");
    expect(call.sql).toContain("status != 'deleted'");
    expect(call.sql).toContain("ORDER BY created_at ASC");
    expect(call.args[0]).toBe("test-tenant");
  });
});

// ===========================================================================
// getEmailById
// ===========================================================================

describe("getEmailById", () => {
  it("returns the email row when found", async () => {
    const mockRow = {
      id: "email-001",
      category: "SPAM",
      payload: "{}",
      status: "pending",
      assignee: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    mockExecute.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await getEmailById("email-001", "default");

    expect(result).toEqual(mockRow);

    const call = mockExecute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(call.sql).toContain("SELECT * FROM emails");
    expect(call.sql).toContain("tenant_id = ?");
    expect(call.sql).toContain("status != 'deleted'");
    expect(call.args[0]).toBe("email-001");
    expect(call.args[1]).toBe("default");
  });

  it("returns undefined when no row matches", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await getEmailById("nonexistent", "default");

    expect(result).toBeUndefined();
  });
});

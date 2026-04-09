import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../index.ts";
import { __resetClientsForTest } from "../sse.ts";
import { initDb, closeDb } from "../db.ts";
import { __setBasePathForTest } from "../tone-profile/store.ts";

let testDir: string;

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  __resetClientsForTest();
  initDb(":memory:");
  testDir = resolve(tmpdir(), `onboarding-integration-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
  __setBasePathForTest(testDir);
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
  rmSync(testDir, { recursive: true, force: true });
});

// ===========================================================================
// POST /api/onboarding/test-connection
// ===========================================================================

describe("POST /api/onboarding/test-connection", () => {
  it("rejects missing IMAP fields", async () => {
    const res = await request(app)
      .post("/api/onboarding/test-connection")
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapHost"');
    expect(res.body.error).toContain('"imapPort"');
    expect(res.body.error).toContain('"email"');
    expect(res.body.error).toContain('"password"');
  });

  it("rejects empty imapHost", async () => {
    const res = await request(app)
      .post("/api/onboarding/test-connection")
      .send({
        imapHost: "",
        imapPort: 993,
        email: "test@example.com",
        password: "secret",
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapHost"');
  });

  it("rejects non-number imapPort", async () => {
    const res = await request(app)
      .post("/api/onboarding/test-connection")
      .send({
        imapHost: "imap.example.com",
        imapPort: "not-a-number",
        email: "test@example.com",
        password: "secret",
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapPort"');
  });

  it("does not require tenant_id", async () => {
    const res = await request(app)
      .post("/api/onboarding/test-connection")
      .send({
        imapHost: "",
        imapPort: 993,
        email: "test@example.com",
        password: "secret",
      });

    // Should fail on "imapHost" validation, not on tenant_id
    expect(res.status).toBe(422);
    expect(res.body.error).not.toContain("tenant_id");
  });
});

// ===========================================================================
// POST /api/onboarding/scan-sent
// ===========================================================================

describe("POST /api/onboarding/scan-sent", () => {
  it("rejects missing IMAP fields", async () => {
    const res = await request(app).post("/api/onboarding/scan-sent").send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapHost"');
    expect(res.body.error).toContain('"imapPort"');
    expect(res.body.error).toContain('"email"');
    expect(res.body.error).toContain('"password"');
    expect(res.body.error).toContain('"tenant_id"');
  });

  it("rejects invalid tenant_id", async () => {
    const res = await request(app).post("/api/onboarding/scan-sent").send({
      imapHost: "imap.example.com",
      imapPort: 993,
      email: "test@example.com",
      password: "secret",
      tenant_id: "../hack",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("alphanumeric");
  });

  it("rejects empty imapHost", async () => {
    const res = await request(app).post("/api/onboarding/scan-sent").send({
      imapHost: "",
      imapPort: 993,
      email: "test@example.com",
      password: "secret",
      tenant_id: "test-tenant",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapHost"');
  });

  it("rejects non-number imapPort", async () => {
    const res = await request(app).post("/api/onboarding/scan-sent").send({
      imapHost: "imap.example.com",
      imapPort: "not-a-number",
      email: "test@example.com",
      password: "secret",
      tenant_id: "test-tenant",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"imapPort"');
  });
});

// ===========================================================================
// POST /api/onboarding/manual-profile
// ===========================================================================

describe("POST /api/onboarding/manual-profile", () => {
  it("rejects missing tenant_id", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({ example_emails: ["e1", "e2", "e3"] });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"tenant_id"');
  });

  it("rejects invalid tenant_id", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "has spaces",
        example_emails: ["e1", "e2", "e3"],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("alphanumeric");
  });

  it("rejects too few emails", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["e1", "e2"],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("3-5 items");
  });

  it("rejects too many emails", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["e1", "e2", "e3", "e4", "e5", "e6"],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("3-5 items");
  });

  it("rejects non-array example_emails", async () => {
    const res = await request(app).post("/api/onboarding/manual-profile").send({
      tenant_id: "test-tenant",
      example_emails: "not an array",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"example_emails" must be an array');
  });

  it("rejects empty string in example_emails", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["e1", "", "e3"],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('"example_emails[1]"');
  });

  it("returns 413 when payload exceeds body limit", async () => {
    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["e1", "e2", "x".repeat(50_001)],
      });

    // The global express.json({ limit: '16kb' }) rejects before route middleware
    expect(res.status).toBe(413);
  });

  it("returns 500 when SITEWARE_API_TOKEN is not set", async () => {
    const originalToken = process.env.SITEWARE_API_TOKEN;
    delete process.env.SITEWARE_API_TOKEN;

    const res = await request(app)
      .post("/api/onboarding/manual-profile")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["e1", "e2", "e3"],
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("SITEWARE_API_TOKEN");

    if (originalToken !== undefined) {
      process.env.SITEWARE_API_TOKEN = originalToken;
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../index.ts";
import { __resetClientsForTest } from "../sse.ts";
import { initDb, closeDb } from "../db.ts";
import { __setBasePathForTest } from "./store.ts";

let testDir: string;

function validProfile(tenantId = "test-tenant") {
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

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  __resetClientsForTest();
  initDb(":memory:");
  testDir = resolve(tmpdir(), `tone-integration-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
  __setBasePathForTest(testDir);
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
  rmSync(testDir, { recursive: true, force: true });
});

// ===========================================================================
// POST /api/tone-profile/analyze
// ===========================================================================

describe("POST /api/tone-profile/analyze", () => {
  it("returns analyzer prompt for valid request", async () => {
    const res = await request(app)
      .post("/api/tone-profile/analyze")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["Email 1", "Email 2", "Email 3"],
        language: "de",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.prompt).toContain("Email 1");
    expect(res.body.prompt).toContain("Email 2");
    expect(res.body.prompt).toContain("Email 3");
    expect(res.body.prompt).toContain("Analysiere");
  });

  it("rejects invalid request (too few emails)", async () => {
    const res = await request(app)
      .post("/api/tone-profile/analyze")
      .send({
        tenant_id: "test-tenant",
        example_emails: ["Email 1"],
        language: "de",
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("3-5 items");
  });

  it("rejects invalid tenant_id", async () => {
    const res = await request(app)
      .post("/api/tone-profile/analyze")
      .send({
        tenant_id: "../hack",
        example_emails: ["e1", "e2", "e3"],
        language: "de",
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("alphanumeric");
  });
});

// ===========================================================================
// PUT /api/tone-profile/:tenantId
// ===========================================================================

describe("PUT /api/tone-profile/:tenantId", () => {
  it("saves a valid profile", async () => {
    const res = await request(app)
      .put("/api/tone-profile/test-tenant")
      .send(validProfile());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects mismatched tenant_id", async () => {
    const res = await request(app)
      .put("/api/tone-profile/different-tenant")
      .send(validProfile("test-tenant"));

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("must match URL parameter");
  });

  it("rejects invalid profile body", async () => {
    const res = await request(app)
      .put("/api/tone-profile/test-tenant")
      .send({ tenant_id: "test-tenant" });

    expect(res.status).toBe(422);
  });

  it("rejects invalid tenantId in URL", async () => {
    const res = await request(app)
      .put("/api/tone-profile/has spaces")
      .send(validProfile());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid tenant_id");
  });
});

// ===========================================================================
// GET /api/tone-profile/:tenantId
// ===========================================================================

describe("GET /api/tone-profile/:tenantId", () => {
  it("retrieves a saved profile", async () => {
    await request(app)
      .put("/api/tone-profile/test-tenant")
      .send(validProfile());

    const res = await request(app).get("/api/tone-profile/test-tenant");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenant_id).toBe("test-tenant");
    expect(res.body.data.formality_level).toBe("formal");
  });

  it("returns 404 for nonexistent profile", async () => {
    const res = await request(app).get("/api/tone-profile/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });

  it("rejects invalid tenantId", async () => {
    const res = await request(app).get("/api/tone-profile/has spaces");

    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE /api/tone-profile/:tenantId
// ===========================================================================

describe("DELETE /api/tone-profile/:tenantId", () => {
  it("deletes an existing profile", async () => {
    await request(app)
      .put("/api/tone-profile/test-tenant")
      .send(validProfile());

    const res = await request(app).delete("/api/tone-profile/test-tenant");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get("/api/tone-profile/test-tenant");
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for nonexistent profile", async () => {
    const res = await request(app).delete("/api/tone-profile/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// GET /api/tone-profile/:tenantId/injection
// ===========================================================================

describe("GET /api/tone-profile/:tenantId/injection", () => {
  it("returns injection string for existing profile", async () => {
    await request(app)
      .put("/api/tone-profile/test-tenant")
      .send(validProfile());

    const res = await request(app).get(
      "/api/tone-profile/test-tenant/injection",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.injection).toContain("## Tone & Style Instructions");
    expect(res.body.injection).toContain("Sehr geehrte/r ...");
  });

  it("returns 404 for nonexistent profile", async () => {
    const res = await request(app).get(
      "/api/tone-profile/nonexistent/injection",
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// GET /api/tone-profiles
// ===========================================================================

describe("GET /api/tone-profiles", () => {
  it("returns empty array when no profiles exist", async () => {
    const res = await request(app).get("/api/tone-profiles");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("lists all saved tenant IDs", async () => {
    await request(app)
      .put("/api/tone-profile/tenant-a")
      .send(validProfile("tenant-a"));
    await request(app)
      .put("/api/tone-profile/tenant-b")
      .send(validProfile("tenant-b"));

    const res = await request(app).get("/api/tone-profiles");

    expect(res.status).toBe(200);
    expect(res.body.data.sort()).toEqual(["tenant-a", "tenant-b"]);
  });
});

// ===========================================================================
// Full round-trip
// ===========================================================================

describe("full round-trip", () => {
  it("analyze → save → get injection → delete", async () => {
    // 1. Analyze
    const analyzeRes = await request(app)
      .post("/api/tone-profile/analyze")
      .send({
        tenant_id: "roundtrip-tenant",
        example_emails: ["Hello world", "Good morning", "Best regards"],
        language: "en",
      });
    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.prompt).toBeTruthy();

    // 2. Save profile
    const saveRes = await request(app)
      .put("/api/tone-profile/roundtrip-tenant")
      .send(validProfile("roundtrip-tenant"));
    expect(saveRes.status).toBe(200);

    // 3. Get injection
    const injectionRes = await request(app).get(
      "/api/tone-profile/roundtrip-tenant/injection",
    );
    expect(injectionRes.status).toBe(200);
    expect(injectionRes.body.injection).toContain("Tone & Style Instructions");

    // 4. List profiles includes roundtrip-tenant
    const listRes = await request(app).get("/api/tone-profiles");
    expect(listRes.body.data).toContain("roundtrip-tenant");

    // 5. Delete
    const deleteRes = await request(app).delete(
      "/api/tone-profile/roundtrip-tenant",
    );
    expect(deleteRes.status).toBe(200);

    // 6. Verify deleted
    const getRes = await request(app).get("/api/tone-profile/roundtrip-tenant");
    expect(getRes.status).toBe(404);
  });
});

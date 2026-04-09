import { getTursoClient } from "../db-turso.js";
import type { ToneProfile } from "../../types/tone-profile.js";

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateTenantId(tenantId: string): void {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(
      "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    );
  }
}

export async function initToneProfilesTable(): Promise<void> {
  const db = getTursoClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tone_profiles (
      tenant_id TEXT PRIMARY KEY,
      profile TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export async function saveToneProfile(profile: ToneProfile): Promise<void> {
  validateTenantId(profile.tenant_id);
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO tone_profiles (tenant_id, profile, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(tenant_id) DO UPDATE SET
            profile = excluded.profile,
            updated_at = excluded.updated_at`,
    args: [profile.tenant_id, JSON.stringify(profile), now, now],
  });
}

export async function loadToneProfile(
  tenantId: string,
): Promise<ToneProfile | null> {
  validateTenantId(tenantId);
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT profile FROM tone_profiles WHERE tenant_id = ?`,
    args: [tenantId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return JSON.parse(result.rows[0].profile as string) as ToneProfile;
}

export async function listToneProfiles(): Promise<readonly string[]> {
  const db = getTursoClient();

  const result = await db.execute(
    `SELECT tenant_id FROM tone_profiles ORDER BY tenant_id ASC`,
  );

  return result.rows.map((row) => row.tenant_id as string);
}

export async function deleteToneProfile(tenantId: string): Promise<boolean> {
  validateTenantId(tenantId);
  const db = getTursoClient();

  const result = await db.execute({
    sql: `DELETE FROM tone_profiles WHERE tenant_id = ?`,
    args: [tenantId],
  });

  return result.rowsAffected > 0;
}

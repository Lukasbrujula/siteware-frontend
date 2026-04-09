import { createClient } from "@libsql/client";
import { encrypt, decrypt } from "./crypto.js";

let client = null;

function getTursoClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error(
        "TURSO_DATABASE_URL environment variable is not configured",
      );
    }

    client = createClient({ url, authToken });
  }
  return client;
}

export async function getTenantsWithImap() {
  const db = getTursoClient();

  const result = await db.execute(
    `SELECT tenant_id, imap_host, imap_port, imap_user, imap_password,
            smtp_host, smtp_port, smtp_user, smtp_password,
            triage_agent_id, reply_composer_agent_id, siteware_token
     FROM tenants
     WHERE imap_host IS NOT NULL AND imap_user IS NOT NULL AND active = 1`,
  );

  return result.rows.map((row) => ({
    ...row,
    imap_password: row.imap_password ? decrypt(row.imap_password) : null,
    smtp_password: row.smtp_password ? decrypt(row.smtp_password) : null,
  }));
}

export async function ensureTenantsTable() {
  const db = getTursoClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      siteware_token TEXT,
      siteware_api_url TEXT,
      triage_agent_id TEXT,
      reply_composer_agent_id TEXT,
      imap_host TEXT,
      imap_port INTEGER,
      imap_user TEXT,
      imap_password TEXT,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_user TEXT,
      smtp_password TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export async function upsertTenant(tenant) {
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO tenants (tenant_id, siteware_token, siteware_api_url, triage_agent_id, reply_composer_agent_id,
            imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password,
            created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id) DO UPDATE SET
            siteware_token = COALESCE(excluded.siteware_token, tenants.siteware_token),
            imap_host = COALESCE(excluded.imap_host, tenants.imap_host),
            imap_port = COALESCE(excluded.imap_port, tenants.imap_port),
            imap_user = COALESCE(excluded.imap_user, tenants.imap_user),
            imap_password = COALESCE(excluded.imap_password, tenants.imap_password),
            smtp_host = COALESCE(excluded.smtp_host, tenants.smtp_host),
            smtp_port = COALESCE(excluded.smtp_port, tenants.smtp_port),
            smtp_user = COALESCE(excluded.smtp_user, tenants.smtp_user),
            smtp_password = COALESCE(excluded.smtp_password, tenants.smtp_password),
            triage_agent_id = COALESCE(excluded.triage_agent_id, tenants.triage_agent_id),
            reply_composer_agent_id = COALESCE(excluded.reply_composer_agent_id, tenants.reply_composer_agent_id),
            updated_at = excluded.updated_at`,
    args: [
      tenant.tenant_id,
      tenant.siteware_token ?? null,
      tenant.siteware_api_url ?? null,
      tenant.triage_agent_id ?? null,
      tenant.reply_composer_agent_id ?? null,
      tenant.imap_host ?? null,
      tenant.imap_port ?? null,
      tenant.imap_user ?? null,
      tenant.imap_password ? encrypt(tenant.imap_password) : null,
      tenant.smtp_host ?? null,
      tenant.smtp_port ?? null,
      tenant.smtp_user ?? null,
      tenant.smtp_password ? encrypt(tenant.smtp_password) : null,
      now,
      now,
    ],
  });
}

import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const migrations = [
  `CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    email TEXT,
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_user TEXT,
    imap_password TEXT,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 465,
    smtp_user TEXT,
    smtp_password TEXT,
    triage_agent_id TEXT,
    reply_composer_agent_id TEXT,
    siteware_auth_token TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
];

async function run() {
  console.log("Connecting to Turso...");

  // Check existing schema first
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  console.log(
    "Existing tables:",
    tables.rows.map((r) => r.name),
  );

  // Check if emails table has tenant_id
  try {
    const emailCols = await db.execute("PRAGMA table_info(emails)");
    const hasTenantId = emailCols.rows.some((r) => r.name === "tenant_id");
    console.log("emails.tenant_id exists:", hasTenantId);

    if (!hasTenantId) {
      console.log("Adding tenant_id to emails...");
      await db.execute(
        "ALTER TABLE emails ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'",
      );
      console.log("Done.");
    }
  } catch (err) {
    console.log("emails table may not exist yet:", err.message);
  }

  // Check if audit_logs table has tenant_id
  try {
    const auditCols = await db.execute("PRAGMA table_info(audit_logs)");
    const hasTenantId = auditCols.rows.some((r) => r.name === "tenant_id");
    console.log("audit_logs.tenant_id exists:", hasTenantId);

    if (!hasTenantId) {
      console.log("Adding tenant_id to audit_logs...");
      await db.execute(
        "ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'",
      );
      console.log("Done.");
    }
  } catch (err) {
    console.log("audit_logs table may not exist yet:", err.message);
  }

  // Create tenants table
  for (const sql of migrations) {
    console.log("Running:", sql.slice(0, 60) + "...");
    await db.execute(sql);
    console.log("Done.");
  }

  // Verify
  const finalTables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  console.log(
    "Final tables:",
    finalTables.rows.map((r) => r.name),
  );

  console.log("Migration complete!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

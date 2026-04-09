import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { encrypt, decrypt } from "./crypto.js";

const DB_PATH = resolve(process.cwd(), "data", "emails.db");

type EmailRow = {
  readonly id: string;
  readonly category: string;
  readonly payload: string;
  readonly status: string;
  readonly assignee: string | null;
  readonly tenant_id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type CountRow = {
  readonly category: string;
  readonly count: number;
};

type CategoryCounts = {
  readonly spam: number;
  readonly ad: number;
  readonly draft: number;
  readonly escalation: number;
  readonly unsubscribe: number;
};

type TenantRow = {
  readonly tenant_id: string;
  readonly siteware_token: string | null;
  readonly siteware_api_url: string | null;
  readonly triage_agent_id: string | null;
  readonly reply_composer_agent_id: string | null;
  readonly imap_host: string | null;
  readonly imap_port: number | null;
  readonly imap_user: string | null;
  readonly imap_password: string | null;
  readonly smtp_host: string | null;
  readonly smtp_port: number | null;
  readonly smtp_user: string | null;
  readonly smtp_password: string | null;
  readonly active: number;
  readonly created_at: string;
  readonly updated_at: string;
};

function createDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assignee TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_emails_tenant_id ON emails(tenant_id)`,
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'success',
      category TEXT,
      context TEXT,
      source_ip TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL
    )
  `);

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_email_id ON audit_logs(email_id)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id)`,
  );

  // Migrate existing tables: add tenant_id if missing
  try {
    db.exec(
      `ALTER TABLE emails ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`,
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      `ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`,
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE tenants ADD COLUMN tone_profile TEXT`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE tenants ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE tenants ADD COLUMN access_token TEXT`);
  } catch {
    // Column already exists
  }

  return db;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = createDatabase(DB_PATH);
  }
  return db;
}

export function initDb(dbPath?: string): Database.Database {
  if (db) {
    db.close();
  }
  db = createDatabase(dbPath ?? DB_PATH);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Tenant CRUD
// ---------------------------------------------------------------------------

export function createTenant(tenant: {
  readonly tenant_id: string;
  readonly siteware_token?: string;
  readonly siteware_api_url?: string;
  readonly triage_agent_id?: string;
  readonly reply_composer_agent_id?: string;
  readonly imap_host?: string;
  readonly imap_port?: number;
  readonly imap_user?: string;
  readonly imap_password?: string;
  readonly smtp_host?: string;
  readonly smtp_port?: number;
  readonly smtp_user?: string;
  readonly smtp_password?: string;
}): TenantRow {
  const database = getDb();
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO tenants (tenant_id, siteware_token, siteware_api_url, triage_agent_id, reply_composer_agent_id,
       imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
    );

  const row = database
    .prepare(`SELECT * FROM tenants WHERE tenant_id = ?`)
    .get(tenant.tenant_id) as TenantRow;
  return {
    ...row,
    imap_password: row.imap_password ? decrypt(row.imap_password) : null,
    smtp_password: row.smtp_password ? decrypt(row.smtp_password) : null,
  };
}

export function getTenantConfig(tenantId: string): TenantRow | undefined {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM tenants WHERE tenant_id = ?`)
    .get(tenantId) as TenantRow | undefined;
  if (!row) return undefined;

  return {
    ...row,
    imap_password: row.imap_password ? decrypt(row.imap_password) : null,
    smtp_password: row.smtp_password ? decrypt(row.smtp_password) : null,
  };
}

export function upsertTenant(tenant: {
  readonly tenant_id: string;
  readonly imap_host?: string;
  readonly imap_port?: number;
  readonly imap_user?: string;
  readonly imap_password?: string;
  readonly smtp_host?: string;
  readonly smtp_port?: number;
  readonly smtp_user?: string;
  readonly smtp_password?: string;
  readonly tone_profile?: string;
}): TenantRow {
  const database = getDb();
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO tenants (tenant_id, imap_host, imap_port, imap_user, imap_password,
       smtp_host, smtp_port, smtp_user, smtp_password, tone_profile, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       imap_host = excluded.imap_host,
       imap_port = excluded.imap_port,
       imap_user = excluded.imap_user,
       imap_password = excluded.imap_password,
       smtp_host = excluded.smtp_host,
       smtp_port = excluded.smtp_port,
       smtp_user = excluded.smtp_user,
       smtp_password = excluded.smtp_password,
       tone_profile = excluded.tone_profile,
       updated_at = excluded.updated_at`,
    )
    .run(
      tenant.tenant_id,
      tenant.imap_host ?? null,
      tenant.imap_port ?? null,
      tenant.imap_user ?? null,
      tenant.imap_password ? encrypt(tenant.imap_password) : null,
      tenant.smtp_host ?? null,
      tenant.smtp_port ?? null,
      tenant.smtp_user ?? null,
      tenant.smtp_password ? encrypt(tenant.smtp_password) : null,
      tenant.tone_profile ?? null,
      now,
      now,
    );

  const upsertedRow = database
    .prepare(`SELECT * FROM tenants WHERE tenant_id = ?`)
    .get(tenant.tenant_id) as TenantRow;
  return {
    ...upsertedRow,
    imap_password: upsertedRow.imap_password
      ? decrypt(upsertedRow.imap_password)
      : null,
    smtp_password: upsertedRow.smtp_password
      ? decrypt(upsertedRow.smtp_password)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Email CRUD (tenant-scoped)
// ---------------------------------------------------------------------------

export function insertEmail(
  category: string,
  payload: Record<string, unknown>,
  tenantId: string = "default",
): void {
  const database = getDb();
  const emailId = (payload.email_id as string) ?? "";
  const now = new Date().toISOString();
  const safeTenantId =
    typeof tenantId === "string" && tenantId !== "" ? tenantId : "default";

  const stmt = database.prepare(`
    INSERT INTO emails (id, category, payload, status, tenant_id, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      category = excluded.category,
      tenant_id = COALESCE(excluded.tenant_id, emails.tenant_id, 'default'),
      updated_at = excluded.updated_at
  `);

  stmt.run(
    emailId,
    category.toUpperCase(),
    JSON.stringify(payload),
    safeTenantId,
    now,
    now,
  );
}

export function getEmailsByCategory(
  category: string,
  tenantId: string = "default",
): readonly Record<string, unknown>[] {
  const database = getDb();

  const rows = database
    .prepare(
      `SELECT payload FROM emails WHERE category = ? AND tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') ORDER BY created_at ASC`,
    )
    .all(category.toUpperCase(), tenantId) as readonly EmailRow[];

  return rows.map((row) => JSON.parse(row.payload) as Record<string, unknown>);
}

export function getAllPending(tenantId: string = "default"): CategoryCounts {
  const database = getDb();

  const rows = database
    .prepare(
      `SELECT category, COUNT(*) as count FROM emails WHERE tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') GROUP BY category`,
    )
    .all(tenantId) as readonly CountRow[];

  const counts: CategoryCounts = {
    spam: 0,
    ad: 0,
    draft: 0,
    escalation: 0,
    unsubscribe: 0,
  };

  const categoryMap: Record<string, keyof CategoryCounts> = {
    SPAM: "spam",
    AD: "ad",
    URGENT: "draft",
    OTHER: "draft",
    ESCALATION: "escalation",
    UNSUBSCRIBE: "unsubscribe",
  };

  return rows.reduce((acc, row) => {
    const key = categoryMap[row.category];
    if (key) {
      return { ...acc, [key]: acc[key] + row.count };
    }
    return acc;
  }, counts);
}

export function updateStatus(
  emailId: string,
  status: string,
  assignee?: string,
): void {
  const database = getDb();
  const now = new Date().toISOString();

  if (assignee !== undefined) {
    database
      .prepare(
        `UPDATE emails SET status = ?, assignee = ?, updated_at = ? WHERE id = ?`,
      )
      .run(status, assignee, now, emailId);
  } else {
    database
      .prepare(`UPDATE emails SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, now, emailId);
  }
}

export function deleteEmail(emailId: string): void {
  updateStatus(emailId, "deleted");
}

type GroupedEmails = {
  readonly spam: readonly Record<string, unknown>[];
  readonly ad: readonly Record<string, unknown>[];
  readonly urgent: readonly Record<string, unknown>[];
  readonly other: readonly Record<string, unknown>[];
  readonly escalation: readonly Record<string, unknown>[];
  readonly unsubscribe: readonly Record<string, unknown>[];
};

export function getAll(tenantId: string = "default"): GroupedEmails {
  const database = getDb();

  const rows = database
    .prepare(
      `SELECT category, payload FROM emails WHERE tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') ORDER BY created_at ASC`,
    )
    .all(tenantId) as readonly EmailRow[];

  const grouped: GroupedEmails = {
    spam: [],
    ad: [],
    urgent: [],
    other: [],
    escalation: [],
    unsubscribe: [],
  };

  const categoryMap: Record<string, keyof GroupedEmails> = {
    SPAM: "spam",
    AD: "ad",
    URGENT: "urgent",
    OTHER: "other",
    ESCALATION: "escalation",
    UNSUBSCRIBE: "unsubscribe",
  };

  return rows.reduce((acc, row) => {
    const key = categoryMap[row.category];
    if (key) {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      return { ...acc, [key]: [...acc[key], parsed] };
    }
    return acc;
  }, grouped);
}

export function insertAuditLog(
  event: {
    readonly action: string;
    readonly email_id: string;
    readonly result: string;
    readonly category?: string;
    readonly context?: Record<string, unknown>;
  },
  sourceIp?: string,
  tenantId: string = "default",
): void {
  const database = getDb();
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO audit_logs (email_id, action, result, category, context, source_ip, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.email_id,
      event.action,
      event.result,
      event.category ?? null,
      event.context ? JSON.stringify(event.context) : null,
      sourceIp ?? null,
      tenantId,
      now,
    );
}

export type SentEmailRow = {
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly draft_plain: string;
  readonly timestamp: string;
};

export function getSentEmails(
  tenantId: string = "default",
): readonly SentEmailRow[] {
  const database = getDb();

  // Include emails marked 'sent' (n8n callback) and 'approved' (user action with audit log)
  const rows = database
    .prepare(
      `SELECT
         id AS email_id,
         json_extract(payload, '$.sender_name') AS sender_name,
         json_extract(payload, '$.sender_email') AS sender_email,
         json_extract(payload, '$.subject') AS subject,
         json_extract(payload, '$.draft_plain') AS draft_plain,
         updated_at AS timestamp
       FROM emails
       WHERE status IN ('sent', 'approved')
         AND tenant_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(tenantId) as readonly Record<string, unknown>[];

  return rows.map((row) => ({
    email_id: row.email_id as string,
    sender_name: (row.sender_name as string) ?? "",
    sender_email: (row.sender_email as string) ?? "",
    subject: (row.subject as string) ?? "",
    draft_plain: (row.draft_plain as string) ?? "",
    timestamp: row.timestamp as string,
  }));
}

export function getEmailById(
  emailId: string,
  tenantId: string,
): EmailRow | undefined {
  const database = getDb();

  return database
    .prepare(
      `SELECT * FROM emails WHERE id = ? AND tenant_id = ? AND status != 'deleted'`,
    )
    .get(emailId, tenantId) as EmailRow | undefined;
}

// ---------------------------------------------------------------------------
// Access Token helpers
// ---------------------------------------------------------------------------

export function setAccessToken(tenantId: string, token: string): void {
  const database = getDb();
  database
    .prepare(`UPDATE tenants SET access_token = ? WHERE tenant_id = ?`)
    .run(token, tenantId);
}

export function getTenantByAccessToken(
  token: string,
): { readonly tenant_id: string; readonly imap_user: string } | undefined {
  const database = getDb();

  const row = database
    .prepare(
      `SELECT tenant_id, imap_user FROM tenants WHERE access_token = ? AND active = 1`,
    )
    .get(token) as { tenant_id: string; imap_user: string } | undefined;

  if (!row) return undefined;

  return {
    tenant_id: row.tenant_id,
    imap_user: row.imap_user ?? "",
  };
}

export type {
  TenantRow,
  EmailRow,
  CategoryCounts,
  GroupedEmails,
  SentEmailRow,
};

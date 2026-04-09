import { createClient, type Client } from "@libsql/client";
import { encrypt, decrypt } from "./crypto.js";

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

type GroupedEmails = {
  readonly spam: readonly Record<string, unknown>[];
  readonly ad: readonly Record<string, unknown>[];
  readonly urgent: readonly Record<string, unknown>[];
  readonly other: readonly Record<string, unknown>[];
  readonly escalation: readonly Record<string, unknown>[];
  readonly unsubscribe: readonly Record<string, unknown>[];
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
  readonly email_signature: string | null;
  readonly active: number;
  readonly created_at: string;
  readonly updated_at: string;
};

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error(
        "TURSO_DATABASE_URL environment variable is not configured",
      );
    }

    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

export async function initTursoDb(): Promise<void> {
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

  await db.execute(`
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

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_emails_tenant_id ON emails(tenant_id)`,
  );

  await db.execute(`
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

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_email_id ON audit_logs(email_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id)`,
  );

  // Migrate existing tables: add tenant_id column if missing
  // ALTER TABLE ADD COLUMN is safe to retry — it fails silently if column exists in libsql
  try {
    await db.execute(
      `ALTER TABLE emails ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`,
    );
  } catch {
    // Column already exists — expected for existing databases
  }

  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_emails_tenant_id ON emails(tenant_id)`,
    );
  } catch {
    // Index already exists
  }

  try {
    await db.execute(
      `ALTER TABLE tenants ADD COLUMN email_signature TEXT DEFAULT ''`,
    );
  } catch {
    // Column already exists
  }

  try {
    await db.execute(
      `ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`,
    );
  } catch {
    // Column already exists
  }

  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id)`,
    );
  } catch {
    // Index already exists
  }

  try {
    await db.execute(
      `ALTER TABLE tenants ADD COLUMN active INTEGER NOT NULL DEFAULT 1`,
    );
  } catch {
    // Column already exists
  }

  // Fix tenants where active=0 due to Turso not applying ALTER TABLE DEFAULT
  await db.execute(
    `UPDATE tenants SET active = 1 WHERE active = 0 OR active IS NULL`,
  );

  try {
    await db.execute(`ALTER TABLE tenants ADD COLUMN access_token TEXT`);
  } catch {
    // Column already exists
  }
}

// ---------------------------------------------------------------------------
// Tenant CRUD
// ---------------------------------------------------------------------------

export async function createTenant(tenant: {
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
  readonly email_signature?: string;
}): Promise<TenantRow> {
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO tenants (tenant_id, siteware_token, siteware_api_url, triage_agent_id, reply_composer_agent_id,
            imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password,
            email_signature, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      tenant.email_signature ?? "",
      now,
      now,
    ],
  });

  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE tenant_id = ?`,
    args: [tenant.tenant_id],
  });

  const createdRow = result.rows[0] as unknown as TenantRow;
  return {
    ...createdRow,
    imap_password: createdRow.imap_password
      ? decrypt(createdRow.imap_password)
      : null,
    smtp_password: createdRow.smtp_password
      ? decrypt(createdRow.smtp_password)
      : null,
  };
}

export async function upsertTenant(tenant: {
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
  readonly email_signature?: string;
}): Promise<TenantRow> {
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO tenants (tenant_id, siteware_token, siteware_api_url, triage_agent_id, reply_composer_agent_id,
            imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password,
            email_signature, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(tenant_id) DO UPDATE SET
            siteware_token = COALESCE(excluded.siteware_token, tenants.siteware_token),
            siteware_api_url = COALESCE(excluded.siteware_api_url, tenants.siteware_api_url),
            triage_agent_id = COALESCE(excluded.triage_agent_id, tenants.triage_agent_id),
            reply_composer_agent_id = COALESCE(excluded.reply_composer_agent_id, tenants.reply_composer_agent_id),
            imap_host = COALESCE(excluded.imap_host, tenants.imap_host),
            imap_port = COALESCE(excluded.imap_port, tenants.imap_port),
            imap_user = COALESCE(excluded.imap_user, tenants.imap_user),
            imap_password = COALESCE(excluded.imap_password, tenants.imap_password),
            smtp_host = COALESCE(excluded.smtp_host, tenants.smtp_host),
            smtp_port = COALESCE(excluded.smtp_port, tenants.smtp_port),
            smtp_user = COALESCE(excluded.smtp_user, tenants.smtp_user),
            smtp_password = COALESCE(excluded.smtp_password, tenants.smtp_password),
            email_signature = COALESCE(excluded.email_signature, tenants.email_signature),
            active = 1,
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
      tenant.email_signature ?? null,
      now,
      now,
    ],
  });

  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE tenant_id = ?`,
    args: [tenant.tenant_id],
  });

  const upsertedRow = result.rows[0] as unknown as TenantRow;
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

export async function getTenantConfig(
  tenantId: string,
): Promise<TenantRow | undefined> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE tenant_id = ?`,
    args: [tenantId],
  });

  const row = result.rows[0] as unknown as TenantRow | undefined;
  if (!row) return undefined;

  return {
    ...row,
    imap_password: row.imap_password ? decrypt(row.imap_password) : null,
    smtp_password: row.smtp_password ? decrypt(row.smtp_password) : null,
  };
}

// ---------------------------------------------------------------------------
// Email CRUD (tenant-scoped)
// ---------------------------------------------------------------------------

export async function insertEmail(
  category: string,
  payload: Record<string, unknown>,
  tenantId: string = "default",
): Promise<void> {
  const db = getTursoClient();
  const emailId = (payload.email_id as string) ?? "";
  const now = new Date().toISOString();
  const safeTenantId =
    typeof tenantId === "string" && tenantId !== "" ? tenantId : "default";

  await db.execute({
    sql: `INSERT INTO emails (id, category, payload, status, tenant_id, created_at, updated_at)
          VALUES (?, ?, ?, 'pending', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            category = excluded.category,
            tenant_id = COALESCE(excluded.tenant_id, emails.tenant_id, 'default'),
            updated_at = excluded.updated_at`,
    args: [
      emailId,
      category.toUpperCase(),
      JSON.stringify(payload),
      safeTenantId,
      now,
      now,
    ],
  });
}

export async function getEmailsByCategory(
  category: string,
  tenantId: string = "default",
): Promise<readonly Record<string, unknown>[]> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT payload FROM emails WHERE category = ? AND tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') ORDER BY created_at ASC`,
    args: [category.toUpperCase(), tenantId],
  });

  return result.rows.map(
    (row) => JSON.parse(row.payload as string) as Record<string, unknown>,
  );
}

export async function getAllPending(
  tenantId: string = "default",
): Promise<CategoryCounts> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT category, COUNT(*) as count FROM emails WHERE tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') GROUP BY category`,
    args: [tenantId],
  });

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

  return (result.rows as unknown as readonly CountRow[]).reduce((acc, row) => {
    const key = categoryMap[row.category];
    if (key) {
      return { ...acc, [key]: acc[key] + row.count };
    }
    return acc;
  }, counts);
}

export async function updateStatus(
  emailId: string,
  status: string,
  assignee?: string,
): Promise<void> {
  const db = getTursoClient();
  const now = new Date().toISOString();

  if (assignee !== undefined) {
    await db.execute({
      sql: `UPDATE emails SET status = ?, assignee = ?, updated_at = ? WHERE id = ?`,
      args: [status, assignee, now, emailId],
    });
  } else {
    await db.execute({
      sql: `UPDATE emails SET status = ?, updated_at = ? WHERE id = ?`,
      args: [status, now, emailId],
    });
  }
}

export async function deleteEmail(emailId: string): Promise<void> {
  await updateStatus(emailId, "deleted");
}

export async function getAll(
  tenantId: string = "default",
): Promise<GroupedEmails> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT category, payload FROM emails WHERE tenant_id = ? AND status NOT IN ('deleted', 'sent', 'rejected') ORDER BY created_at ASC`,
    args: [tenantId],
  });

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

  return (result.rows as unknown as readonly EmailRow[]).reduce((acc, row) => {
    const key = categoryMap[row.category];
    if (key) {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      return { ...acc, [key]: [...acc[key], parsed] };
    }
    return acc;
  }, grouped);
}

export async function insertAuditLog(
  event: {
    readonly action: string;
    readonly email_id: string;
    readonly result: string;
    readonly category?: string;
    readonly context?: Record<string, unknown>;
  },
  sourceIp?: string,
  tenantId: string = "default",
): Promise<void> {
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO audit_logs (email_id, action, result, category, context, source_ip, tenant_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      event.email_id,
      event.action,
      event.result,
      event.category ?? null,
      event.context ? JSON.stringify(event.context) : null,
      sourceIp ?? null,
      tenantId,
      now,
    ],
  });
}

export type SentEmailRow = {
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly draft_plain: string;
  readonly timestamp: string;
};

export async function getSentEmails(
  tenantId: string = "default",
): Promise<readonly SentEmailRow[]> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT
            a.email_id,
            json_extract(e.payload, '$.sender_name') AS sender_name,
            json_extract(e.payload, '$.sender_email') AS sender_email,
            json_extract(e.payload, '$.subject') AS subject,
            json_extract(e.payload, '$.draft_plain') AS draft_plain,
            a.created_at AS timestamp
          FROM audit_logs a
          JOIN emails e ON e.id = a.email_id
          WHERE a.action = 'draft_approved'
            AND a.result = 'success'
            AND a.tenant_id = ?
          ORDER BY a.created_at DESC`,
    args: [tenantId],
  });

  return result.rows.map((row) => ({
    email_id: row.email_id as string,
    sender_name: (row.sender_name as string) ?? "",
    sender_email: (row.sender_email as string) ?? "",
    subject: (row.subject as string) ?? "",
    draft_plain: (row.draft_plain as string) ?? "",
    timestamp: row.timestamp as string,
  }));
}

export async function getEmailById(
  emailId: string,
  tenantId: string,
): Promise<EmailRow | undefined> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT * FROM emails WHERE id = ? AND tenant_id = ? AND status != 'deleted'`,
    args: [emailId, tenantId],
  });

  return result.rows[0] as unknown as EmailRow | undefined;
}

// ---------------------------------------------------------------------------
// Tenant Admin (settings page)
// ---------------------------------------------------------------------------

export async function listTenants(): Promise<readonly TenantRow[]> {
  const db = getTursoClient();

  const result = await db.execute(
    `SELECT tenant_id, imap_user, smtp_user, active, created_at, updated_at
     FROM tenants
     ORDER BY created_at ASC`,
  );

  return result.rows as unknown as readonly TenantRow[];
}

export async function setTenantActive(
  tenantId: string,
  active: boolean,
): Promise<void> {
  const db = getTursoClient();
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE tenants SET active = ?, updated_at = ? WHERE tenant_id = ?`,
    args: [active ? 1 : 0, now, tenantId],
  });
}

export async function deleteTenantCascade(tenantId: string): Promise<void> {
  const db = getTursoClient();

  await db.execute({
    sql: `DELETE FROM audit_logs WHERE tenant_id = ?`,
    args: [tenantId],
  });
  await db.execute({
    sql: `DELETE FROM emails WHERE tenant_id = ?`,
    args: [tenantId],
  });

  try {
    await db.execute({
      sql: `DELETE FROM tone_profiles WHERE tenant_id = ?`,
      args: [tenantId],
    });
  } catch {
    // tone_profiles table may not exist yet
  }

  await db.execute({
    sql: `DELETE FROM tenants WHERE tenant_id = ?`,
    args: [tenantId],
  });
}

// ---------------------------------------------------------------------------
// Access Token helpers
// ---------------------------------------------------------------------------

export async function setAccessToken(
  tenantId: string,
  token: string,
): Promise<void> {
  const db = getTursoClient();
  await db.execute({
    sql: `UPDATE tenants SET access_token = ? WHERE tenant_id = ?`,
    args: [token, tenantId],
  });
}

export async function getTenantByAccessToken(
  token: string,
): Promise<
  { readonly tenant_id: string; readonly imap_user: string } | undefined
> {
  const db = getTursoClient();

  const result = await db.execute({
    sql: `SELECT tenant_id, imap_user FROM tenants WHERE access_token = ?`,
    args: [token],
  });

  const row = result.rows[0];
  if (!row) return undefined;

  return {
    tenant_id: row.tenant_id as string,
    imap_user: (row.imap_user as string) ?? "",
  };
}

export type { TenantRow, EmailRow, CategoryCounts, GroupedEmails };

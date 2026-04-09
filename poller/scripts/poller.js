import { getTenantsWithImap, ensureTenantsTable } from "./lib/db-client.js";
import { fetchUnseenEmails, markAsSeen } from "./lib/imap-client.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

async function postToWebhook(payload) {
  if (!N8N_WEBHOOK_URL) {
    log("warn", "N8N_WEBHOOK_URL not set — skipping webhook POST", {
      tenant_id: payload.tenant_id,
      subject: payload.subject,
    });
    return false;
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    log("error", "Webhook POST failed", {
      tenant_id: payload.tenant_id,
      subject: payload.subject,
      status: response.status,
      statusText: response.statusText,
    });
    return false;
  }

  return true;
}

async function processTenant(tenant) {
  const tenantId = tenant.tenant_id;
  log("info", `Processing tenant`, { tenant_id: tenantId });

  const { emails } = await fetchUnseenEmails(tenant);

  if (emails.length === 0) {
    log("info", "No unseen emails", { tenant_id: tenantId });
    return;
  }

  log("info", `Found ${emails.length} unseen email(s)`, {
    tenant_id: tenantId,
  });

  for (const email of emails) {
    const { uid, ...payload } = email;

    log("info", "Processing email", {
      tenant_id: tenantId,
      email_id: payload.email_id,
      subject: payload.subject,
    });

    try {
      const success = await postToWebhook(payload);

      if (success) {
        await markAsSeen(tenant, uid);
        log("info", "Email processed and marked as seen", {
          tenant_id: tenantId,
          email_id: payload.email_id,
          subject: payload.subject,
        });
      } else {
        log("warn", "Webhook POST failed — leaving email as UNSEEN", {
          tenant_id: tenantId,
          email_id: payload.email_id,
          subject: payload.subject,
        });
      }
    } catch (error) {
      log("error", "Failed to process email", {
        tenant_id: tenantId,
        email_id: payload.email_id,
        subject: payload.subject,
        error: error.message,
      });
    }
  }
}

async function pollAllTenants() {
  log("info", "Starting poll cycle");

  let tenants;
  try {
    tenants = await getTenantsWithImap();
  } catch (error) {
    log("error", "Failed to fetch tenants from Turso", {
      error: error.message,
    });
    return;
  }

  if (tenants.length === 0) {
    log("info", "No tenants with IMAP configured");
    return;
  }

  log("info", `Found ${tenants.length} tenant(s) with IMAP configured`);

  for (const tenant of tenants) {
    try {
      await processTenant(tenant);
    } catch (error) {
      log("error", "Tenant processing failed — continuing to next", {
        tenant_id: tenant.tenant_id,
        error: error.message,
      });
    }
  }

  log("info", "Poll cycle complete");
}

const ONCE_MODE = process.argv.includes("--once");

async function main() {
  log("info", "IMAP Poller starting", {
    mode: ONCE_MODE ? "once" : "loop",
    poll_interval_ms: ONCE_MODE ? null : POLL_INTERVAL_MS,
    webhook_url: N8N_WEBHOOK_URL ? "(configured)" : "(not set)",
  });

  await ensureTenantsTable();

  await pollAllTenants();

  if (!ONCE_MODE) {
    setInterval(pollAllTenants, POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  log("error", "Fatal error in poller", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

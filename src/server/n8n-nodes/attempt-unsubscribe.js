/**
 * n8n Code Node: Attempt Unsubscribe
 *
 * Replaces the mock "Attempt Unsubscribe" node in the email_inbox workflow.
 * Receives one item per execution with unsubscribe metadata from the
 * classification step.
 *
 * Input fields:
 *   - email_id        (string)
 *   - sender          (string)
 *   - unsubscribe_url (string | null)  — List-Unsubscribe one-click URL
 *   - unsubscribe_mailto (string | null) — List-Unsubscribe mailto address
 *   - unsubscribe_method ("one-click" | "mailto" | "not-found")
 *   - can_attempt     (boolean)
 *
 * Output matches validateUnsubscribePayload schema:
 *   { email_id, sender, unsubscribe_method, status, reason, timestamp }
 */

const items = $input.all();
const results = [];

for (const item of items) {
  const {
    email_id,
    sender,
    unsubscribe_url,
    unsubscribe_mailto,
    unsubscribe_method,
    can_attempt,
  } = item.json;

  const timestamp = new Date().toISOString();

  // Guard: if the upstream node says we cannot attempt, skip
  if (!can_attempt) {
    results.push({
      json: {
        email_id,
        sender,
        unsubscribe_method: unsubscribe_method || "not-found",
        status: "nicht erfolgreich",
        reason: "Abmeldeversuch nicht möglich (can_attempt = false)",
        timestamp,
      },
    });
    continue;
  }

  // -----------------------------------------------------------------------
  // Strategy 1: One-Click Unsubscribe (RFC 8058)
  // -----------------------------------------------------------------------
  if (unsubscribe_method === "one-click" && unsubscribe_url) {
    try {
      const response = await fetch(unsubscribe_url, {
        method: "POST",
        headers: {
          "List-Unsubscribe": "One-Click",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "List-Unsubscribe=One-Click",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok || (response.status >= 300 && response.status < 400)) {
        results.push({
          json: {
            email_id,
            sender,
            unsubscribe_method: "one-click",
            status: "erfolgreich",
            reason: `HTTP ${response.status} — Abmeldung erfolgreich`,
            timestamp,
          },
        });
      } else {
        const body = await response.text().catch(() => "");
        const detail = body.slice(0, 200);
        results.push({
          json: {
            email_id,
            sender,
            unsubscribe_method: "one-click",
            status: "nicht erfolgreich",
            reason: `HTTP ${response.status} — ${response.statusText}${detail ? ": " + detail : ""}`,
            timestamp,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        json: {
          email_id,
          sender,
          unsubscribe_method: "one-click",
          status: "nicht erfolgreich",
          reason: `Netzwerkfehler: ${message}`,
          timestamp,
        },
      });
    }

    continue;
  }

  // -----------------------------------------------------------------------
  // Strategy 2: Mailto Unsubscribe
  // Cannot send emails from a Code node — requires n8n Email Send node.
  // Flag for manual action or downstream SMTP node.
  // -----------------------------------------------------------------------
  if (unsubscribe_method === "mailto" && unsubscribe_mailto) {
    results.push({
      json: {
        email_id,
        sender,
        unsubscribe_method: "mailto",
        status: "nicht erfolgreich",
        reason: `Mailto-Abmeldung benötigt SMTP — zur manuellen Bearbeitung markiert (${unsubscribe_mailto})`,
        timestamp,
        _mailto_address: unsubscribe_mailto,
      },
    });
    continue;
  }

  // -----------------------------------------------------------------------
  // Strategy 3: Not Found
  // -----------------------------------------------------------------------
  results.push({
    json: {
      email_id,
      sender,
      unsubscribe_method: unsubscribe_method || "not-found",
      status: "nicht erfolgreich",
      reason: "Kein Abmeldelink in den E-Mail-Headern gefunden",
      timestamp,
    },
  });
}

return results;

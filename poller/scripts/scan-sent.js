import { ImapFlow } from "imapflow";

const MAX_EMAILS = 20;
const CONNECTION_TIMEOUT_MS = 30_000;
const MAX_BODY_LENGTH = 5_000;

const SENT_FOLDER_CANDIDATES = [
  "[Gmail]/Sent Mail",
  "Sent",
  "Sent Items",
  "Sent Messages",
  "Gesendet",
  "INBOX.Sent",
  "INBOX.Sent Items",
  "INBOX.Gesendet",
];

/**
 * Detect the Sent folder path on the IMAP account.
 * 1. Try \Sent special-use flag (RFC 6154)
 * 2. Fall back to known folder name candidates
 */
async function detectSentFolder(client) {
  const mailboxes = await client.list();

  for (const box of mailboxes) {
    if (box.specialUse === "\\Sent") {
      return box.path;
    }
  }

  const pathMap = new Map(mailboxes.map((b) => [b.path.toLowerCase(), b.path]));
  for (const candidate of SENT_FOLDER_CANDIDATES) {
    const match = pathMap.get(candidate.toLowerCase());
    if (match) return match;
  }

  return null;
}

/**
 * Strip quoted reply blocks.
 * Removes "On ... wrote:" / "Am ... schrieb:" markers and everything after,
 * then strips individual ">"-quoted lines.
 */
function stripQuotedReplies(text) {
  const markerIndex = text.search(/^(On .+ wrote:|Am .+ schrieb\b.*:)/im);
  const beforeMarker = markerIndex === -1 ? text : text.slice(0, markerIndex);
  const lines = beforeMarker.split("\n");
  return lines
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .trim();
}

/**
 * Strip email signature (RFC 3676 "-- " delimiter).
 */
function stripSignature(text) {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trimEnd();
    if (trimmed === "--" || trimmed === "-- ") {
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return text.trim();
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function decodeBody(body, headers) {
  if (headers.includes("content-transfer-encoding: quoted-printable")) {
    return decodeQuotedPrintable(body);
  }
  if (headers.includes("content-transfer-encoding: base64")) {
    try {
      return Buffer.from(body.replace(/[\r\n\s]/g, ""), "base64").toString(
        "utf-8",
      );
    } catch {
      return body;
    }
  }
  return body;
}

function extractPlainText(raw) {
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    const altEnd = raw.indexOf("\n\n");
    if (altEnd === -1) return raw;
    return raw.slice(altEnd + 2);
  }

  const headers = raw.slice(0, headerEnd).toLowerCase();
  const body = raw.slice(headerEnd + 4);

  if (
    headers.includes("content-type: text/plain") ||
    !headers.includes("content-type:")
  ) {
    return decodeBody(body, headers);
  }

  const boundaryMatch = headers.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) return body;

  const boundary = boundaryMatch[1].trim();
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (
      partLower.includes("content-type: text/plain") ||
      partLower.includes("content-type:text/plain")
    ) {
      const partBodyStart = part.indexOf("\r\n\r\n");
      if (partBodyStart !== -1)
        return decodeBody(part.slice(partBodyStart + 4), partLower);
      const altStart = part.indexOf("\n\n");
      if (altStart !== -1)
        return decodeBody(part.slice(altStart + 2), partLower);
    }
  }

  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (
      partLower.includes("content-type: text/html") ||
      partLower.includes("content-type:text/html")
    ) {
      const partBodyStart = part.indexOf("\r\n\r\n");
      if (partBodyStart !== -1)
        return stripHtml(decodeBody(part.slice(partBodyStart + 4), partLower));
    }
  }

  return body;
}

/**
 * Full cleaning pipeline: strip HTML → strip quotes → strip signature → truncate.
 */
function cleanEmailBody(raw) {
  const noHtml = stripHtml(raw);
  const noQuotes = stripQuotedReplies(noHtml);
  const noSig = stripSignature(noQuotes);
  const trimmed = noSig.replace(/\n{3,}/g, "\n\n").trim();
  return trimmed.length > MAX_BODY_LENGTH
    ? trimmed.slice(0, MAX_BODY_LENGTH)
    : trimmed;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Connect to an IMAP account, find the Sent folder, and fetch
 * the last 20 sent emails with cleaned body text.
 *
 * @param {object} imapConfig
 * @param {string} imapConfig.host
 * @param {number} imapConfig.port
 * @param {string} imapConfig.user
 * @param {string} imapConfig.password
 * @param {boolean} [imapConfig.tls=true]
 * @returns {Promise<Array<{subject: string, body: string, date: string}>>}
 */
export async function scanSentEmails(imapConfig) {
  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.tls !== false,
    auth: {
      user: imapConfig.user,
      pass: imapConfig.password,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();

    const sentFolder = await detectSentFolder(client);
    if (!sentFolder) {
      throw new Error("Could not find Sent folder on this IMAP account");
    }

    const lock = await client.getMailboxLock(sentFolder);
    const emails = [];

    try {
      const messages = await client.fetchAll(
        "1:*",
        { envelope: true, uid: true },
        { uid: true },
      );

      const sorted = [...messages]
        .sort((a, b) => b.uid - a.uid)
        .slice(0, MAX_EMAILS);

      for (const msg of sorted) {
        const subject = msg.envelope?.subject ?? "(no subject)";
        const date = msg.envelope?.date
          ? new Date(msg.envelope.date).toISOString()
          : new Date().toISOString();

        let body = "";
        try {
          const download = await client.download(String(msg.uid), undefined, {
            uid: true,
          });
          const raw = await streamToString(download.content);
          body = cleanEmailBody(extractPlainText(raw));
        } catch (err) {
          console.error(
            `Failed to download body for UID ${msg.uid}:`,
            err.message,
          );
          body = subject;
        }

        emails.push({ subject, body, date });
      }
    } finally {
      lock.release();
    }

    return emails;
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

// --- CLI mode ---
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMainModule) {
  const config = {
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    tls: process.env.IMAP_TLS !== "false",
  };

  if (!config.user || !config.password) {
    console.error(
      "Error: IMAP_USER and IMAP_PASSWORD environment variables are required",
    );
    console.error(
      "Usage: IMAP_USER=x IMAP_PASSWORD=y node poller/scripts/scan-sent.js",
    );
    process.exit(1);
  }

  console.error(
    `Scanning sent emails for ${config.user} on ${config.host}:${config.port}...`,
  );

  scanSentEmails(config)
    .then((emails) => {
      console.log(JSON.stringify(emails, null, 2));
      console.error(`Done — found ${emails.length} email(s)`);
    })
    .catch((err) => {
      console.error("Fatal error:", err.message);
      process.exit(1);
    });
}
